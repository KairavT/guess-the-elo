# Guess the Elo — API Worker

Watch a real Lichess game replay (moves + real clocks), guess the average
rating of the two players, and climb the leaderboard.

**The frontend lives on [alexanderli.dev/elo.html](https://alexanderli.dev/elo.html)**
(the website repo), in the site's own letterpress design. This Worker is the
JSON API plus a redirect that sends anyone landing on the workers.dev URL over
to the real page. Games, players, and guesses live in a D1 database; ratings
never leave the server before a guess.

Deployed at: `https://guess-the-elo.thefaix.workers.dev`

## How scoring works

- Everyone starts at **1000**.
- Each guess moves your rating by `clamp((300 - error) / 10, -30, +30)`:
  a perfect guess is **+30**, a 300-point error breaks even, 600+ off is **-30**.
- Elos never leave the server before you guess, and each game can only be
  guessed once per player (enforced by a UNIQUE index), so no rating farming.

## Name claiming (no accounts)

The first browser to play a name claims it: the page generates a random
`secret` once (localStorage), sends it with every player-scoped request, and
the Worker stores it on the player row at the claiming moment. A request for a
claimed name without the matching secret gets `403 {"error":"name taken"}`.
Requests with no secret may still play **unclaimed** names (this also keeps
cached copies of the old page working) — they just can never touch a claimed
one. Clearing browser storage loses the claim; there is deliberately no
recovery path.

## Local dev

```
npm install
py seed.py                # data/games.jsonl -> seed/games.sql (run scripts/collect.py first)
npm run db:init:local
npm run db:seed:local
npm run dev               # API on http://localhost:8791
```

Then serve the website repo locally and open its `/elo.html` — the page talks
to `localhost:8791` automatically when it is itself served from localhost.
The Worker's CORS allowlist covers `localhost:5199` (the website's dev port)
and the production origins.

## Deploy

```
npm run deploy            # auto-provisions the D1 database on first deploy
npm run db:init
npm run db:seed
```

## API

| Route | Method | Purpose |
|---|---|---|
| `/api/game?player=NAME&secret=S` | GET | Deal a random game the player hasn't guessed (elos stripped) |
| `/api/guess` | POST | `{player, gameId, guess, secret}` -> score, reveal elos, update rating |
| `/api/leaderboard` | GET | Top 50 by rating |
| `/api/history?player=NAME&secret=S` | GET | Player's last 10 guesses |
| `/api/player?player=NAME` | GET | One player's public stats |

Anything outside `/api/` 302-redirects to the game page on the site.
