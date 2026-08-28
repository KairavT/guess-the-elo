from config import TRAIN_PATH, TEST_PATH, RANDOM_SEED

from sklearn.ensemble import GradientBoostingRegressor

import numpy as np
import json


elos_train = []
features_train = []
targets_train = []

with open(TRAIN_PATH, 'r') as in_file:
    for line in in_file:
        train_featurelist = []
        game = json.loads(line)
        elos_train += [game['white_elo'], game['black_elo']]
        train_featurelist += [len(game['moves'].split())] 
        train_featurelist += [int(t) for t in game['time_control'].split('+')]
        features_train.append(train_featurelist)
        targets_train.append((game['white_elo']+ game['black_elo'])/2)

elos_test = []
features_test = []
targets_test = []
with open(TEST_PATH) as in_file:
    for line in in_file:
        test_featurelist = []
        game = json.loads(line)
        elos_test += [game['white_elo'], game['black_elo']]
        test_featurelist += [len(game['moves'].split())] 
        test_featurelist += [int(t) for t in game['time_control'].split('+')]
        features_test.append(test_featurelist)
        targets_test.append((game['white_elo'] + game['black_elo'])/2)

elos_test = np.array(elos_test)

mean_train = np.mean(elos_train)
stdev_train = np.std(elos_train)
rmse_test = np.sqrt(np.mean((elos_test - mean_train) ** 2))

features_train = np.array(features_train)
targets_train = np.array(targets_train)

features_test = np.array(features_test)
targets_test = np.array(targets_test)

print(f'Average elo:{mean_train}, Standard deviation: {stdev_train}, RMSE: {rmse_test}')

gbr = GradientBoostingRegressor(n_estimators=100, learning_rate=0.1, max_depth=3, random_state=RANDOM_SEED)
gbr.fit(features_train, targets_train)

test_pred = gbr.predict(features_test)
rmse_pred = np.sqrt(np.mean((test_pred - targets_test) ** 2))
rmse_targets = np.sqrt(np.mean((targets_test - mean_train) ** 2))
print('Model RMSE:', rmse_pred, 'Mean-predictor RMSE:', rmse_targets)