-- Schema for the Guess the Elo site.
-- Apply with:
--   npm run db:init:local   (local dev)
--   npm run db:init         (production)
-- Then seed the game pool (build seed/games.sql with `py seed.py` first):
--   npm run db:seed:local / npm run db:seed

-- The pool of real Lichess games players guess on. `moves` is a JSON array of
-- UCI moves, `clocks` a JSON array of the mover's remaining seconds after each
-- move (from the PGN %clk comments), NULL when the dump had no clock data.
CREATE TABLE IF NOT EXISTS games (
  id           INTEGER PRIMARY KEY,
  white_elo    INTEGER NOT NULL,
  black_elo    INTEGER NOT NULL,
  time_control TEXT,
  result       TEXT,
  termination  TEXT,
  moves        TEXT    NOT NULL,
  clocks       TEXT
);

-- One row per person on the leaderboard. `rating` starts at 1000 and moves
-- +/-30 max per guess (see ratingDelta in src/index.js). `best_guess` is the
-- smallest error they've ever achieved.
CREATE TABLE IF NOT EXISTS players (
  name         TEXT    PRIMARY KEY COLLATE NOCASE,
  rating       INTEGER NOT NULL,
  games_played INTEGER NOT NULL DEFAULT 0,
  best_guess   INTEGER,
  created_at   INTEGER NOT NULL
);

-- One row per guess. UNIQUE(player, game_id) means a game can only ever be
-- guessed once per player, and /api/game only deals games not in here.
CREATE TABLE IF NOT EXISTS guesses (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  player     TEXT    NOT NULL COLLATE NOCASE,
  game_id    INTEGER NOT NULL,
  guess      INTEGER NOT NULL,
  actual     INTEGER NOT NULL,
  err        INTEGER NOT NULL,
  delta      INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  UNIQUE(player, game_id)
);

CREATE INDEX IF NOT EXISTS idx_guesses_player ON guesses (player, created_at DESC);
