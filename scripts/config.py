from pathlib import Path

URL = 'https://database.lichess.org/standard/lichess_db_standard_rated_2026-06.pgn.zst'
NUM_GAMES = 100000
ALLOWED_CATEGORIES = ['Rated Blitz game', 'Rated Rapid game']
MIN_PLY = 10 
SCRIPT_DIR = Path(__file__).resolve().parent
OUTPUT_PATH = SCRIPT_DIR.parent / 'data' / 'games.jsonl'
RANDOM_SEED = 123