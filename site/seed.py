# Builds seed/games.sql from ../data/games.jsonl (run scripts/collect.py first).
# Apply the output with `npm run db:seed:local` / `npm run db:seed`.
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
SOURCE = HERE.parent / 'data' / 'games.jsonl'
OUT = HERE / 'seed' / 'games.sql'
ROWS_PER_INSERT = 50

OUT.parent.mkdir(exist_ok=True)

rows = []
for i, line in enumerate(open(SOURCE, encoding='utf-8'), start=1):
    r = json.loads(line)
    moves = json.dumps(r['moves'], separators=(',', ':'))
    clocks = "'" + json.dumps(r['clocks'], separators=(',', ':')) + "'" if r['clocks'] else 'NULL'
    rows.append(f"({i},{r['white_elo']},{r['black_elo']},'{r['time_control']}',"
                f"'{r['result']}','{r['termination']}','{moves}',{clocks})")

with open(OUT, 'w', encoding='utf-8') as f:
    f.write('DELETE FROM games;\n')
    for start in range(0, len(rows), ROWS_PER_INSERT):
        chunk = rows[start:start + ROWS_PER_INSERT]
        f.write('INSERT INTO games (id,white_elo,black_elo,time_control,result,'
                'termination,moves,clocks) VALUES\n')
        f.write(',\n'.join(chunk) + ';\n')

print(len(rows), 'games ->', OUT)
