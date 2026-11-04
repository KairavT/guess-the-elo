import torch, torch.nn as nn
from torch.utils.data import DataLoader
from dataset import ChessDataset
from model import EloModel

from config import BATCH_SIZE, LEARNING_RATE,EPOCHS, TRAIN_PATH

device = 'mps' if torch.backends.mps.is_available() else 'cpu'

train_data = ChessDataset(TRAIN_PATH)
train_loader = DataLoader(train_data,
                          batch_size=BATCH_SIZE,
                          shuffle=True
                          )
model = EloModel().to(device)
loss_fn = nn.MSELoss()
optim = torch.optim.AdamW(model.parameters(), lr=LEARNING_RATE)

model.train()

for i, batch in enumerate(train_loader):
    ids, mask, targets = batch
    ids, mask, targets = ids.to(device), mask.to(device), targets.to(device)

    preds = model(ids, mask)
    loss = loss_fn(preds, targets)
    optim.zero_grad()
    loss.backward()
    optim.step()
    if i %100 == 0:
        print(i, loss.item())
