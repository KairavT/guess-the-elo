from config import TRAIN_PATH, TEST_PATH

import numpy as np
import json

elos_train = []
events_count = {'Rated Blitz game':0,
                'Rated Rapid game':0,
                'Rated Bullet game':0}

with open(TRAIN_PATH, 'r') as in_file:
    for line in in_file:
        game = json.loads(line)
        elos_train += [game['white_elo'], game['black_elo']]
        events_count[game['event']] += 1



elos_test = []
with open(TEST_PATH) as in_file:
    for line in in_file:
        game = json.loads(line)
        elos_test += [game['white_elo'], game['black_elo']]
elos_test = np.array(elos_test)

mean_train = np.mean(elos_train)
stdev_train = np.std(elos_train)
rmse_test = np.sqrt(np.mean((elos_test - mean_train) ** 2))

print(f'Average elo:{mean_train}, Standard deviation: {stdev_train}, RMSE: {rmse_test}')
print(events_count)
