from config import OUTPUT_PATH

import numpy as np
import json

elos = []
events_count = {'Rated Blitz game':0,
                'Rated Rapid game':0,
                'Rated Bullet game':0}

with open(OUTPUT_PATH, 'r') as in_file:
    for line in in_file:
        game = json.loads(line)
        elos += [game['white_elo'], game['black_elo']]
        events_count[game['event']] += 1

mean_elo = np.mean(elos)
stdev_elo = np.std(elos)
print(f'Average elo:{mean_elo}, Standard deviation: {stdev_elo}')
print(events_count)