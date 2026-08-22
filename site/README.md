# Guess the Elo — web app

Watch a real Lichess game replay (moves + real clocks), guess the average
rating of the two players, and climb the leaderboard. One Cloudflare Worker
serves both the static frontend (`public/`) and the JSON API (`src/index.js`);
games, players, and guesses live in a D1 database.

## How scoring works

- Everyone starts at **1000**.
- Each guess moves your rating by `clamp((300 - error) / 10, -30, +30)`:
  a perfect guess is **+30**, a 300-point error breaks even, 600+ off is **-30**.
- Elos never leave the server before you guess, and each game can only be
  guessed once per player (enforced by a UNIQUE index), so no rating farming.

## Local dev

```
npm install
py seed.py                # data/games.jsonl -> seed/games.sql (run scripts/collect.py first)
npm run db:init:local
npm run db:seed:local
npm run dev               # http://localhost:8790
```

## Deploy

```
npm run deploy            # auto-provisions the D1 database on first deploy
npm run db:init
npm run db:seed
```

## API

| Route | Method | Purpose |
|---|---|---|
| `/api/game?player=NAME` | GET | Deal a random game the player hasn't guessed (elos stripped) |
| `/api/guess` | POST | `{player, gameId, guess}` -> score, reveal elos, update rating |
| `/api/leaderboard` | GET | Top 50 by rating |
| `/api/history?player=NAME` | GET | Player's last 10 guesses |
