// Guess the Elo — API Worker. The static frontend lives in public/ and is
// served by the asset layer; anything that reaches this code is an /api/* call.
//
// Ratings never leave the server before a guess: /api/game deals a game with
// the elos stripped, /api/guess scores it server-side and reveals them.

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

async function getGame(url, env) {
  const player = (url.searchParams.get('player') || '').trim();
  if (!validName(player)) return json({ error: 'invalid player name' }, 400);

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
  const gameId = Number(body.gameId);
  const guess = Number(body.guess);
  if (!validName(player)) return json({ error: 'invalid player name' }, 400);
  if (!Number.isInteger(gameId) || !Number.isInteger(guess) || guess < 100 || guess > 4000) {
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

  await env.DB.prepare(
    `INSERT INTO players (name, rating, games_played, best_guess, created_at)
     VALUES (?1, ?2 + ?3, 1, ?4, ?5)
     ON CONFLICT(name) DO UPDATE SET
       rating = rating + ?3,
       games_played = games_played + 1,
       best_guess = MIN(COALESCE(best_guess, ?4), ?4)`
  ).bind(player, START_RATING, delta, err, now).run();

  const p = await env.DB.prepare(
    'SELECT rating, games_played FROM players WHERE name = ?1'
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
  });
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

  const { results } = await env.DB.prepare(
    `SELECT game_id, guess, actual, err, delta, created_at FROM guesses
     WHERE player = ?1 ORDER BY created_at DESC LIMIT 10`
  ).bind(player).all();
  return json(results);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    try {
      if (url.pathname === '/api/game' && request.method === 'GET') return await getGame(url, env);
      if (url.pathname === '/api/guess' && request.method === 'POST') return await postGuess(request, env);
      if (url.pathname === '/api/leaderboard' && request.method === 'GET') return await getLeaderboard(env);
      if (url.pathname === '/api/history' && request.method === 'GET') return await getHistory(url, env);
      return json({ error: 'not found' }, 404);
    } catch (err) {
      console.log(JSON.stringify({ level: 'error', path: url.pathname, message: err.message }));
      return json({ error: 'internal error' }, 500);
    }
  },
};
