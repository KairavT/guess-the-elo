// Guess the Elo — API Worker. The frontend lives on alexanderli.dev/elo.html
// (the site's letterpress design); this Worker is the JSON API plus a redirect
// that sends anyone who lands on the workers.dev URL over to the real page.
//
// Ratings never leave the server before a guess: /api/game deals a game with
// the elos stripped, /api/guess scores it server-side and reveals them.

const GAME_URL = 'https://alexanderli.dev/elo.html';

// The site is on Vercel, the API is here — cross-origin, so the browser
// preflights POSTs and checks every response. Localhost is allowed so the
// page can be developed against `wrangler dev` / the deployed API directly.
const ALLOWED_ORIGINS = new Set([
  'https://alexanderli.dev',
  'https://www.alexanderli.dev',
  'http://localhost:5199',
  'http://127.0.0.1:5199',
]);

function corsHeaders(request) {
  const origin = request.headers.get('Origin');
  if (!origin || !ALLOWED_ORIGINS.has(origin)) return {};
  return { 'access-control-allow-origin': origin, 'vary': 'Origin' };
}

const START_RATING = 1000;

// Everyone starts at 1000. Break-even is a 300-point error; a perfect guess
// gains 30, anything 600+ off loses 30.
function ratingDelta(err) {
  return Math.max(-30, Math.min(30, Math.round((300 - err) / 10)));
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function validName(name) {
  return typeof name === 'string' && /^\w[\w .-]{0,19}$/.test(name);
}

function validSecret(secret) {
  return typeof secret === 'string' && /^[\w-]{8,64}$/.test(secret);
}

// Name claiming, no accounts: the first browser to play a name stores a random
// secret against it; from then on only requests carrying that secret may play
// as the name. A request with NO secret may still play names nobody has
// claimed (this is also what keeps cached copies of the old page working) —
// it just can never touch a claimed one, which is the entire point.
// Rows from before this existed (secret NULL) count as unclaimed until a
// secret-bearing client adopts them. Returns true when the caller may act.
async function claimOk(env, player, secret) {
  const has = validSecret(secret);
  const row = await env.DB.prepare('SELECT secret FROM players WHERE name = ?1')
    .bind(player).first();
  if (!row) return true;                       // no row yet — first guess claims it
  if (row.secret === null) {
    if (has) {
      await env.DB.prepare('UPDATE players SET secret = ?2 WHERE name = ?1 AND secret IS NULL')
        .bind(player, secret).run();
    }
    return true;
  }
  return has && row.secret === secret;
}

async function getGame(url, env) {
  const player = (url.searchParams.get('player') || '').trim();
  if (!validName(player)) return json({ error: 'invalid player name' }, 400);
  if (!(await claimOk(env, player, url.searchParams.get('secret') || ''))) {
    return json({ error: 'name taken' }, 403);
  }

  const row = await env.DB.prepare(
    `SELECT id, time_control, result, termination, moves, clocks FROM games
     WHERE id NOT IN (SELECT game_id FROM guesses WHERE player = ?1)
     ORDER BY RANDOM() LIMIT 1`
  ).bind(player).first();
  if (!row) return json({ done: true });

  return json({
    id: row.id,
    timeControl: row.time_control,
    result: row.result,
    termination: row.termination,
    moves: JSON.parse(row.moves),
    clocks: row.clocks ? JSON.parse(row.clocks) : null,
  });
}

async function postGuess(request, env) {
  const body = await request.json().catch(() => null);
  if (!body) return json({ error: 'bad json' }, 400);

  const player = String(body.player || '').trim();
  const secret = String(body.secret || '');
  const gameId = Number(body.gameId);
  const guess = Number(body.guess);
  if (!validName(player)) return json({ error: 'invalid player name' }, 400);
  if (!(await claimOk(env, player, secret))) return json({ error: 'name taken' }, 403);
  // Same range the UI enforces — a scripted client gets no wider a dial than
  // a slider user.
  if (!Number.isInteger(gameId) || !Number.isInteger(guess) || guess < 400 || guess > 3200) {
    return json({ error: 'invalid guess' }, 400);
  }

  const game = await env.DB.prepare(
    'SELECT white_elo, black_elo FROM games WHERE id = ?1'
  ).bind(gameId).first();
  if (!game) return json({ error: 'no such game' }, 404);

  const actual = Math.round((game.white_elo + game.black_elo) / 2);
  const err = Math.abs(guess - actual);
  const delta = ratingDelta(err);
  const now = Date.now();

  // The UNIQUE(player, game_id) index makes a second guess on the same game a
  // no-op, so a replayed request can't farm rating.
  const inserted = await env.DB.prepare(
    `INSERT OR IGNORE INTO guesses (player, game_id, guess, actual, err, delta, created_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`
  ).bind(player, gameId, guess, actual, err, delta, now).run();
  if (!inserted.meta.changes) return json({ error: 'already guessed this game' }, 409);

  // secret lands only on INSERT — the claiming moment — and only when the
  // client actually sent one (NULL keeps the name adoptable). The conflict
  // branch never touches it, so an existing claim can't be overwritten here.
  await env.DB.prepare(
    `INSERT INTO players (name, rating, games_played, best_guess, created_at, secret)
     VALUES (?1, ?2 + ?3, 1, ?4, ?5, ?6)
     ON CONFLICT(name) DO UPDATE SET
       rating = rating + ?3,
       games_played = games_played + 1,
       best_guess = MIN(COALESCE(best_guess, ?4), ?4)`
  ).bind(player, START_RATING, delta, err, now, validSecret(secret) ? secret : null).run();

  const p = await env.DB.prepare(
    'SELECT rating, games_played, best_guess FROM players WHERE name = ?1'
  ).bind(player).first();

  return json({
    whiteElo: game.white_elo,
    blackElo: game.black_elo,
    actual,
    guess,
    err,
    delta,
    rating: p.rating,
    gamesPlayed: p.games_played,
    bestGuess: p.best_guess,
  });
}

// One player's own stats — the leaderboard is LIMIT 50, so anyone below the
// cut would otherwise never see their rating on the page.
async function getPlayer(url, env) {
  const player = (url.searchParams.get('player') || '').trim();
  if (!validName(player)) return json({ error: 'invalid player name' }, 400);
  const p = await env.DB.prepare(
    'SELECT rating, games_played, best_guess FROM players WHERE name = ?1'
  ).bind(player).first();
  return json(p || {});
}

async function getLeaderboard(env) {
  const { results } = await env.DB.prepare(
    `SELECT p.name, p.rating, p.games_played, p.best_guess,
            (SELECT CAST(ROUND(AVG(err)) AS INTEGER) FROM guesses g WHERE g.player = p.name) AS avg_err
     FROM players p
     ORDER BY p.rating DESC, p.games_played DESC
     LIMIT 50`
  ).all();
  return json(results);
}

async function getHistory(url, env) {
  const player = (url.searchParams.get('player') || '').trim();
  if (!validName(player)) return json({ error: 'invalid player name' }, 400);
  if (!(await claimOk(env, player, url.searchParams.get('secret') || ''))) {
    return json({ error: 'name taken' }, 403);
  }

  const { results } = await env.DB.prepare(
    `SELECT game_id, guess, actual, err, delta, created_at FROM guesses
     WHERE player = ?1 ORDER BY created_at DESC LIMIT 10`
  ).bind(player).all();
  return json(results);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const cors = corsHeaders(request);

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          ...cors,
          'access-control-allow-methods': 'GET, POST, OPTIONS',
          'access-control-allow-headers': 'content-type',
          'access-control-max-age': '86400',
        },
      });
    }

    // Anything that isn't the API is someone visiting the workers.dev URL —
    // send them to the game's real home on the site.
    if (!url.pathname.startsWith('/api/')) return Response.redirect(GAME_URL, 302);

    let res;
    try {
      if (url.pathname === '/api/game' && request.method === 'GET') res = await getGame(url, env);
      else if (url.pathname === '/api/guess' && request.method === 'POST') res = await postGuess(request, env);
      else if (url.pathname === '/api/leaderboard' && request.method === 'GET') res = await getLeaderboard(env);
      else if (url.pathname === '/api/history' && request.method === 'GET') res = await getHistory(url, env);
      else if (url.pathname === '/api/player' && request.method === 'GET') res = await getPlayer(url, env);
      else res = json({ error: 'not found' }, 404);
    } catch (err) {
      console.log(JSON.stringify({ level: 'error', path: url.pathname, message: err.message }));
      res = json({ error: 'internal error' }, 500);
    }
    for (const [k, v] of Object.entries(cors)) res.headers.set(k, v);
    return res;
  },
};
