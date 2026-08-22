import requests, zstandard, io, json, chess.pgn

from config import URL, ALLOWED_CATEGORIES, MIN_PLY, NUM_GAMES, OUTPUT_PATH

OUTPUT_PATH.parent.mkdir(exist_ok=True)

with requests.get(URL, stream=True) as response, \
        open(OUTPUT_PATH, 'w') as output:
    decompress = zstandard.ZstdDecompressor()
    reader = decompress.stream_reader(response.raw)
    reader_text = io.TextIOWrapper(reader, encoding='utf-8')

    count_games = 0
    while count_games < NUM_GAMES:
        game = chess.pgn.read_game(reader_text)
        if not game:
            break
        headers = game.headers
        if headers.get('Event') not in ALLOWED_CATEGORIES:
            continue
        if headers.get('WhiteTitle') == 'BOT' or \
            headers.get('BlackTitle') == 'BOT':
            continue
        if not headers.get('WhiteElo', '').isdigit() or \
            not headers.get('BlackElo', '').isdigit():
            continue

        moves, clocks = [], []
        for node in game.mainline():
            moves.append(node.move.uci())
            clocks.append(node.clock())
        if len(moves) < MIN_PLY:
            continue

        record = {
            'white_elo': int(headers['WhiteElo']),
            'black_elo': int(headers['BlackElo']),
            'time_control': headers.get('TimeControl'),
            'result': headers.get('Result'),
            'termination': headers.get('Termination'),
            'moves': moves,
            'clocks': clocks if None not in clocks else None,
        }
        output.write(json.dumps(record) + '\n')
        count_games += 1
        if count_games % 1000 == 0:
            print(count_games, 'games collected')

print(count_games, 'games written to', OUTPUT_PATH)
