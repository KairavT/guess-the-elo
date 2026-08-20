import requests, zstandard, io, chess.pgn

from config import URL, ALLOWED_CATEGORIES, MIN_PLY

with requests.get(URL, stream=True) as response:
    decompress = zstandard.ZstdDecompressor()
    reader = decompress.stream_reader(response.raw)
    reader_text = io.TextIOWrapper(reader, encoding='utf-8')

    count_games = 0
    limit = 100
    while True:
        game = chess.pgn.read_game(reader_text)
        if not game or count_games == limit:
            break
        if game.headers.get('Event')\
              not in ALLOWED_CATEGORIES:
            continue
        if game.headers.get('WhiteTitle') == 'BOT' or \
            game.headers.get('BlackTitle') == 'BOT':
            continue
        if game.end().ply() < MIN_PLY:
            continue

        count_games += 1
    print(count_games)

