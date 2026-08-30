import json, random

from collections import Counter
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

count_tokens = Counter()
with open(TRAIN_PATH, 'r') as train_file:
    for line in train_file:
        data = json.loads(line)
        moves_data = data['moves']
        tokens = moves_data.split()
        tokens_correct = []
        for token in tokens:
            if not token.endswith('.') and token not in ['1-0', '0-1',\
                                                    '1/2-1/2', '*']:
                tokens_correct.append(token)
        count_tokens.update(tokens_correct)
        
single_count = 0
for count in count_tokens:
    if count_tokens[count] == 1:
        single_count += 1
    
        
print(f'Unique Tokens: {len(count_tokens)}')
print(f'Top 10: {count_tokens.most_common(10)}')
print(f'# of Singles: {single_count}')