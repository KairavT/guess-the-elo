import torch, tokenizer, json
from config import VOCAB_PATH, TRAIN_PATH, MAX_SEQ_LEN, MEAN_ELO, TRAIN_STDEV
from torch.utils.data import Dataset

class ChessDataset(Dataset):
    def __init__(self, path):
        self.games = []
        with open(path, 'r') as games_file:
            for line in games_file:
                self.games.append(json.loads(line))
        with open(VOCAB_PATH, 'r') as vocab_file:
            self.vocab = json.load(vocab_file)
    def __len__(self):
        return len(self.games)
    def __getitem__(self, idx):
        game = self.games[idx]
        moves = tokenizer.tokenize(game['moves'])
        if len(moves) > MAX_SEQ_LEN -1:
            moves = moves[1-MAX_SEQ_LEN:]
        ids = [self.vocab.get(move, self.vocab['<unk>'])\
                for move in moves]
        ids = [self.vocab['<cls>']] + ids
        mask = [1] * len(ids)
        ids = ids + [self.vocab['<pad>']] * (MAX_SEQ_LEN-len(mask))
        mask += ([0] * (MAX_SEQ_LEN-len(mask)))
        targets = [(game['white_elo'] - MEAN_ELO)/TRAIN_STDEV,
                   (game['black_elo'] - MEAN_ELO)/TRAIN_STDEV]
        return torch.tensor(ids, dtype=torch.long), torch.tensor(mask, dtype=torch.long), torch.tensor(targets, dtype=torch.float32)
        
