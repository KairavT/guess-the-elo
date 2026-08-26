import json, random

from config import OUTPUT_PATH, RANDOM_SEED

usernames = set()

with open(OUTPUT_PATH, 'r') as in_file:
    for line in in_file:
        data = json.loads(line)
        usernames.update([data['white_user'], data['black_user']])

print(len(usernames))

