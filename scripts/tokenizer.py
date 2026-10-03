def tokenize(moves_data):
    tokens = moves_data.split()
    tokens_correct = []
    for token in tokens:
        if not token.endswith('.') and token not in ['1-0', '0-1',\
                                                        '1/2-1/2', '*']:
            tokens_correct.append(token)
    return tokens_correct