import requests, zstandard, io, chess.pgn, json

from config import URL, ALLOWED_CATEGORIES, MIN_PLY, OUTPUT_PATH, \
                    NUM_GAMES

with requests.get(URL, stream=True) as response, \
    open(OUTPUT_PATH, 'w') as out_file:

    decompress = zstandard.ZstdDecompressor()
    reader = decompress.stream_reader(response.raw)
    reader_text = io.TextIOWrapper(reader, encoding='utf-8')

    count_games = 0
    limit = NUM_GAMES
    reject_counter = {"Wrong Event": 0,
                      "Bot Game": 0,
                      "Too Short":0}
    while True:
        game = chess.pgn.read_game(reader_text)
        if game is None or count_games == limit:
            break
        if game.headers.get('Event')\
              not in ALLOWED_CATEGORIES:
            reject_counter['Wrong Event'] += 1
            continue
        if game.headers.get('WhiteTitle') == 'BOT' or \
            game.headers.get('BlackTitle') == 'BOT':
            reject_counter['Bot Game'] += 1
            continue
        if game.end().ply() < MIN_PLY:
            reject_counter['Too Short'] += 1
            continue
        game_info = {
            "white_elo": int(game.headers.get('WhiteElo')),
            "black_elo": int(game.headers.get('BlackElo')),
            "time_control": game.headers.get('TimeControl'),
            "event": game.headers.get('Event'),
            "result": game.headers.get('Result'),
            "termination": game.headers.get('Termination'),
            "moves": str(game.accept(chess.pgn.StringExporter(headers=False, variations=False, comments=False)))
        }
        info_str = json.dumps(game_info) + '\n'
        out_file.write(info_str)
        count_games += 1
    print(count_games)
    print(game_info)
    print(reject_counter)

