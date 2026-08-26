import json, random

from config import OUTPUT_PATH, RANDOM_SEED, TEST_FRACTION,\
                   TEST_PATH, TRAIN_PATH


random.seed(RANDOM_SEED)


usernames = set()

with open(OUTPUT_PATH, 'r') as in_file:
    for line in in_file:
        data = json.loads(line)
        usernames.update([data['white_user'], data['black_user']])



users_list = list(usernames)
users_list.sort()
random.shuffle(users_list)
test_users = set(users_list\
                 [:int(len(usernames)*TEST_FRACTION)])

kept_games = {
    'test':0,
    'train':0,
    'remove':0
}

with open(OUTPUT_PATH, 'r') as in_file,\
     open(TRAIN_PATH, 'w') as train_file,\
     open(TEST_PATH, 'w') as test_file:
    for line in in_file:
        data = json.loads(line)
        if data['white_user'] in test_users and\
        data['black_user'] in test_users:
            kept_games['test'] += 1
            test_file.write(line)

        elif data['white_user'] not in test_users and\
        data['black_user'] not in test_users:
            kept_games['train'] += 1
            train_file.write(line)

        else:
            kept_games['remove'] += 1
