/* Guess the Elo — frontend. Replays UCI move lists on a CSS-grid board,
   shows the real per-move clocks, and talks to the /api/* Worker. */

'use strict';

// ── chess board replay ──────────────────────────────────────────────────────
// Board = array of 64, index 0 = a1 … 63 = h8. Uppercase = white pieces.
// UCI needs no legality checking; only castling, en passant and promotion
// need special handling.

const GLYPH = { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' };

function startBoard() {
  const b = new Array(64).fill(null);
  const back = ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R'];
  for (let f = 0; f < 8; f++) {
    b[f] = back[f];
    b[8 + f] = 'P';
    b[48 + f] = 'p';
    b[56 + f] = back[f].toLowerCase();
  }
  return b;
}

const sq = s => (s.charCodeAt(1) - 49) * 8 + (s.charCodeAt(0) - 97);
const sqName = i => 'abcdefgh'[i % 8] + (Math.floor(i / 8) + 1);

// Applies one UCI move in place; returns {from, to, label} where label is a
// SAN-ish string for the move strip (no disambiguation or check marks).
function applyMove(board, uci) {
  const from = sq(uci.slice(0, 2));
  const to = sq(uci.slice(2, 4));
  const promo = uci[4];
  const piece = board[from];
  const white = piece === piece.toUpperCase();
  let capture = !!board[to];
  let label;

  // en passant: a pawn moving diagonally onto an empty square
  if (piece.toLowerCase() === 'p' && from % 8 !== to % 8 && !board[to]) {
    board[white ? to - 8 : to + 8] = null;
    capture = true;
  }

  if (piece.toLowerCase() === 'k' && Math.abs((to % 8) - (from % 8)) === 2) {
    const rank = from - (from % 8);
    if (to % 8 === 6) { board[rank + 5] = board[rank + 7]; board[rank + 7] = null; }
    else { board[rank + 3] = board[rank]; board[rank] = null; }
    label = to % 8 === 6 ? 'O-O' : 'O-O-O';
  } else if (piece.toLowerCase() === 'p') {
    label = (capture ? uci[0] + 'x' : '') + sqName(to) + (promo ? '=' + promo.toUpperCase() : '');
  } else {
    label = GLYPH[piece.toLowerCase()] + (capture ? 'x' : '') + sqName(to);
  }

  board[to] = promo ? (white ? promo.toUpperCase() : promo.toLowerCase()) : piece;
  board[from] = null;
  return { from, to, label };
}

// Precomputes every position of a game so stepping is O(1).
function buildReplay(moves) {
  const positions = [startBoard()];
  const highlights = [null];
  const labels = [];
  let board = positions[0];
  for (const uci of moves) {
    board = board.slice();
    const { from, to, label } = applyMove(board, uci);
    positions.push(board);
    highlights.push([from, to]);
    labels.push(label);
  }
  return { positions, highlights, labels };
}

// ── state ───────────────────────────────────────────────────────────────────

const SPEEDS = [{ label: '1×', ms: 1500 }, { label: '2×', ms: 800 }, { label: '4×', ms: 400 }, { label: '8×', ms: 200 }];
const NAME_RE = /^\w[\w .-]{0,19}$/;

const state = {
  name: localStorage.getItem('gte-name') || '',
  game: null,        // current game from /api/game
  replay: null,      // {positions, highlights, labels}
  ply: 0,
  playing: false,
  timer: null,
  speedIdx: 0,
  baseSeconds: 0,
  guessed: false,
};

const $ = id => document.getElementById(id);

// ── board rendering ─────────────────────────────────────────────────────────

function renderBoard() {
  const el = $('board');
  el.innerHTML = '';
  const board = state.replay ? state.replay.positions[state.ply] : startBoard();
  const hl = state.replay ? state.replay.highlights[state.ply] : null;

  for (let rank = 7; rank >= 0; rank--) {
    for (let file = 0; file < 8; file++) {
      const i = rank * 8 + file;
      const cell = document.createElement('div');
      cell.className = 'sq ' + ((rank + file) % 2 ? 'light' : 'dark');
      if (hl && (hl[0] === i || hl[1] === i)) cell.classList.add('hl');
      if (rank === 0) cell.insertAdjacentHTML('beforeend', `<span class="coord file">${'abcdefgh'[file]}</span>`);
      if (file === 0) cell.insertAdjacentHTML('beforeend', `<span class="coord rank">${rank + 1}</span>`);
      const piece = board[i];
      if (piece) {
        const span = document.createElement('span');
        span.className = 'piece ' + (piece === piece.toUpperCase() ? 'w' : 'b');
        span.textContent = GLYPH[piece.toLowerCase()];
        cell.appendChild(span);
      }
      el.appendChild(cell);
    }
  }
}

// ── clocks ──────────────────────────────────────────────────────────────────

function fmtClock(s) {
  if (s == null) return '–:––';
  s = Math.max(0, Math.round(s));
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
}

// clocks[i] = mover's remaining time after move i (white = even i).
function clockAt(color, ply) {
  const clocks = state.game && state.game.clocks;
  if (!clocks) return null;
  const parity = color === 'w' ? 0 : 1;
  for (let i = ply - 1; i >= 0; i--) if (i % 2 === parity) return clocks[i];
  return state.baseSeconds;
}

function renderClocks() {
  const total = state.replay ? state.replay.labels.length : 0;
  for (const [color, id] of [['w', 'clockWhite'], ['b', 'clockBlack']]) {
    const el = $(id);
    const secs = clockAt(color, state.ply);
    el.textContent = fmtClock(secs);
    const toMove = state.ply < total && (state.ply % 2 === 0 ? 'w' : 'b') === color;
    el.classList.toggle('active', toMove);
    el.classList.toggle('low', secs != null && secs < 20);
  }
}

// ── meta / move strip ───────────────────────────────────────────────────────

function tcInfo(tc) {
  const [base, inc] = (tc || '0+0').split('+').map(Number);
  const est = base + 40 * inc;
  const cat = est < 30 ? 'UltraBullet' : est < 180 ? 'Bullet' : est < 480 ? 'Blitz' : est < 1500 ? 'Rapid' : 'Classical';
  return { base, label: `${Math.floor(base / 60)}+${inc} · ${cat}` };
}

function resultText(g) {
  const res = g.result === '1/2-1/2' ? '½–½' : g.result.replace('-', '–');
  const how = g.termination === 'Time forfeit' ? ' · on time' : '';
  return res + how;
}

function renderMeta() {
  const total = state.replay.labels.length;
  $('plyCounter').textContent = `${state.ply} / ${total}`;
  const strip = $('moveStrip');
  strip.innerHTML = '';
  state.replay.labels.forEach((label, i) => {
    const btn = document.createElement('button');
    btn.className = 'mv' + (i === state.ply - 1 ? ' current' : '');
    btn.innerHTML = (i % 2 === 0 ? `<span class="mv-num">${i / 2 + 1}.</span>` : '') + label;
    btn.onclick = () => goto(i + 1);
    strip.appendChild(btn);
  });
  // Scroll only the strip itself — scrollIntoView would drag the whole page.
  const cur = strip.querySelector('.current');
  if (cur) strip.scrollLeft = cur.offsetLeft - strip.clientWidth / 2 + cur.clientWidth / 2;
}

// ── replay control ──────────────────────────────────────────────────────────

function goto(ply) {
  const total = state.replay ? state.replay.labels.length : 0;
  state.ply = Math.max(0, Math.min(total, ply));
  renderBoard();
  renderClocks();
  renderMeta();
  if (state.ply === total) pause();
}

function tick() {
  if (state.ply >= state.replay.labels.length) return pause();
  goto(state.ply + 1);
}

function play() {
  if (!state.replay || state.ply >= state.replay.labels.length) return;
  state.playing = true;
  $('btnPlay').textContent = '⏸';
  clearInterval(state.timer);
  state.timer = setInterval(tick, SPEEDS[state.speedIdx].ms);
}

function pause() {
  state.playing = false;
  $('btnPlay').textContent = '▶';
  clearInterval(state.timer);
}

// ── API ─────────────────────────────────────────────────────────────────────

async function api(path, opts) {
  const res = await fetch(path, opts);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || res.status);
  return data;
}

async function loadGame() {
  pause();
  $('eloWhite').textContent = '';
  $('eloBlack').textContent = '';
  $('revealCard').classList.add('hidden');
  $('guessCard').classList.remove('hidden');
  state.guessed = false;

  const g = await api('/api/game?player=' + encodeURIComponent(state.name));
  if (g.done) {
    $('guessCard').innerHTML = '<h2>Your guess</h2><p class="hint">You have guessed every game in the pool. 🎉</p>';
    return;
  }
  state.game = g;
  state.replay = buildReplay(g.moves);
  const tc = tcInfo(g.timeControl);
  state.baseSeconds = tc.base;
  $('tcBadge').textContent = tc.label;
  $('metaResult').textContent = resultText(g);
  $('btnGuess').disabled = false;
  goto(0);
}

async function submitGuess() {
  if (state.guessed || !state.game) return;
  const guess = Number($('guessNumber').value);
  if (!Number.isInteger(guess) || guess < 100 || guess > 4000) return;
  $('btnGuess').disabled = true;

  try {
    const r = await api('/api/guess', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ player: state.name, gameId: state.game.id, guess }),
    });
    state.guessed = true;
    $('eloWhite').textContent = r.whiteElo;
    $('eloBlack').textContent = r.blackElo;
    $('revealActual').textContent = r.actual;
    $('revealElos').textContent = `White ${r.whiteElo} · Black ${r.blackElo}`;
    $('revealGuess').textContent = r.guess;
    $('revealErr').textContent = r.err;
    const d = $('revealDelta');
    d.textContent = (r.delta >= 0 ? '+' : '') + r.delta;
    d.className = 'stat-num ' + (r.delta >= 0 ? 'pos' : 'neg');
    $('chipRating').textContent = r.rating;
    $('guessCard').classList.add('hidden');
    $('revealCard').classList.remove('hidden');
    goto(state.replay.labels.length);
    await Promise.all([loadLeaderboard(), loadHistory()]);
  } catch (err) {
    $('btnGuess').disabled = false;
    alert('Guess failed: ' + err.message);
  }
}

async function loadLeaderboard() {
  const rows = await api('/api/leaderboard');
  const body = $('lbBody');
  if (!rows.length) return;
  body.innerHTML = '';
  rows.forEach((p, i) => {
    const tr = document.createElement('tr');
    if (p.name.toLowerCase() === state.name.toLowerCase()) {
      tr.className = 'me';
      $('chipRating').textContent = p.rating;
    }
    tr.innerHTML = `<td>${i + 1}</td><td>${p.name.replace(/</g, '&lt;')}</td>` +
      `<td class="lb-rating">${p.rating}</td><td>${p.games_played}</td><td>${p.avg_err ?? '—'}</td>`;
    body.appendChild(tr);
  });
}

async function loadHistory() {
  const rows = await api('/api/history?player=' + encodeURIComponent(state.name));
  const list = $('historyList');
  if (!rows.length) return;
  list.innerHTML = '';
  for (const h of rows) {
    const li = document.createElement('li');
    const cls = h.delta >= 0 ? 'pos' : 'neg';
    li.innerHTML = `<span>guessed ${h.guess}, was ${h.actual}</span>` +
      `<span>off ${h.err} <span class="h-delta ${cls}">${h.delta >= 0 ? '+' : ''}${h.delta}</span></span>`;
    list.appendChild(li);
  }
}

// ── wiring ──────────────────────────────────────────────────────────────────

$('btnStart').onclick = () => goto(0);
$('btnPrev').onclick = () => { pause(); goto(state.ply - 1); };
$('btnNext').onclick = () => { pause(); goto(state.ply + 1); };
$('btnEnd').onclick = () => goto(state.replay ? state.replay.labels.length : 0);
$('btnPlay').onclick = () => (state.playing ? pause() : play());
$('btnSpeed').onclick = () => {
  state.speedIdx = (state.speedIdx + 1) % SPEEDS.length;
  $('btnSpeed').textContent = SPEEDS[state.speedIdx].label;
  if (state.playing) play();
};

$('guessSlider').oninput = e => { $('guessNumber').value = e.target.value; };
$('guessNumber').oninput = e => { $('guessSlider').value = e.target.value; };
$('btnGuess').onclick = submitGuess;
$('btnNextGame').onclick = () => {
  $('guessSlider').value = 1500;
  $('guessNumber').value = 1500;
  loadGame().catch(err => alert('Could not load game: ' + err.message));
};

document.addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT' || !$('nameModal').classList.contains('hidden')) return;
  if (e.key === 'ArrowLeft') { pause(); goto(state.ply - 1); }
  else if (e.key === 'ArrowRight') { pause(); goto(state.ply + 1); }
  else if (e.key === ' ') { e.preventDefault(); state.playing ? pause() : play(); }
  else if (e.key === 'Home') goto(0);
  else if (e.key === 'End') goto(state.replay ? state.replay.labels.length : 0);
});

// ── name modal ──────────────────────────────────────────────────────────────

function showNameModal() {
  $('nameInput').value = state.name;
  $('nameModal').classList.remove('hidden');
  $('nameInput').focus();
}

function join() {
  const name = $('nameInput').value.trim();
  if (!NAME_RE.test(name)) return $('nameError').classList.remove('hidden');
  $('nameError').classList.add('hidden');
  state.name = name;
  localStorage.setItem('gte-name', name);
  $('chipName').textContent = name;
  $('chipRating').textContent = '';
  $('nameModal').classList.add('hidden');
  loadGame().catch(err => alert('Could not load game: ' + err.message));
  loadLeaderboard().catch(() => {});
  loadHistory().catch(() => {});
}

$('btnJoin').onclick = join;
$('nameInput').addEventListener('keydown', e => { if (e.key === 'Enter') join(); });
$('playerChip').onclick = showNameModal;

// ── boot ────────────────────────────────────────────────────────────────────

$('btnSpeed').textContent = SPEEDS[state.speedIdx].label;
renderBoard();
if (state.name) {
  $('chipName').textContent = state.name;
  loadGame().catch(err => alert('Could not load game: ' + err.message));
  loadLeaderboard().catch(() => {});
  loadHistory().catch(() => {});
} else {
  showNameModal();
}
