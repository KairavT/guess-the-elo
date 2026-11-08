import torch
from torch.utils.data import DataLoader
from dataset import ChessDataset
from model import EloModel
from config import TEST_PATH, MODEL_PATH, BATCH_SIZE, MEAN_ELO, TRAIN_STDEV

device = 'mps' if torch.backends.mps.is_available() else 'cpu'

test_data = DataLoader(
    dataset=ChessDataset(TEST_PATH),
    shuffle=False,
    batch_size=BATCH_SIZE
)

model = EloModel()
model.load_state_dict(torch.load(MODEL_PATH, map_location=device))
model.to(device)
model.eval()

all_preds, all_targets = [], []

with torch.no_grad():
    for batch in test_data:
        ids, mask, targets = batch
        ids, mask = ids.to(device), mask.to(device)
        preds = model(ids,mask)

        all_preds.append(preds.cpu())
        all_targets.append(targets)

all_preds = torch.cat(all_preds)
all_targets = torch.cat(all_targets)

all_preds = all_preds*TRAIN_STDEV + MEAN_ELO
all_targets = all_targets*TRAIN_STDEV + MEAN_ELO

pt_rmse = ((all_preds - all_targets) ** 2).mean() ** 0.5
game_avg = ((all_preds.mean(dim=1) - all_targets.mean(dim=1)) ** 2).mean() ** 0.5
mean_pred = ((MEAN_ELO - all_targets) ** 2).mean() ** 0.5

print(pt_rmse.item(), game_avg.item(), mean_pred.item())