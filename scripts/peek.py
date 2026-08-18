import requests, zstandard, io, chess.pgn

url = 'https://database.lichess.org/standard/lichess_db_standard_rated_2013-01.pgn.zst'

response = requests.get(url, stream=True)
decompress = zstandard.ZstdDecompressor()
reader = decompress.stream_reader(response.raw)
reader_text = io.TextIOWrapper(reader, encoding='utf-8')
game = chess.pgn.read_game(reader_text)

print(game.headers)