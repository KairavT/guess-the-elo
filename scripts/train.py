import torch, torch.nn as nn
from torch.utils.data import DataLoader, random_split
from dataset import ChessDataset
from model import EloModel

from config import BATCH_SIZE, LEARNING_RATE,EPOCHS, TRAIN_PATH,\
                   RANDOM_SEED, VAL_FRACTION, MODEL_PATH, TRAIN_STDEV

device = 'mps' if torch.backends.mps.is_available() else 'cpu'

train_data = ChessDataset(TRAIN_PATH)
train_split, val_split = random_split(train_data, [1-VAL_FRACTION, VAL_FRACTION], generator=torch.Generator().manual_seed(RANDOM_SEED))
train_loader = DataLoader(train_split,
                          batch_size=BATCH_SIZE,
                          shuffle=True
                          )
val_loader = DataLoader(val_split,
                          batch_size=BATCH_SIZE,
                          shuffle=False
                          )

model = EloModel().to(device)
loss_fn = nn.MSELoss()
optim = torch.optim.AdamW(model.parameters(), lr=LEARNING_RATE)


best_val = float('inf')
for epoch in range(EPOCHS):
    model.train()
    total_loss = 0
    for batch in train_loader:
        ids, mask, targets = batch
        ids, mask, targets = ids.to(device), mask.to(device), targets.to(device)

        preds = model(ids, mask)
        loss = loss_fn(preds, targets)
        optim.zero_grad()
        loss.backward()
        optim.step()
        total_loss += loss.item()
    avg_loss = total_loss/len(train_loader)

    model.eval()
    rss = count = 0
    with torch.no_grad():
        for batch in val_loader:
            ids, mask, targets = batch
            ids, mask, targets = ids.to(device), mask.to(device), targets.to(device)
            preds = model(ids,mask)
            rss += ((preds - targets)**2).sum().item()
            count += targets.numel()
    val_rmse = ((rss/count)**0.5) * TRAIN_STDEV

    print(epoch, avg_loss, val_rmse)
    if val_rmse < best_val:
        torch.save(model.state_dict(), MODEL_PATH)
        best_val = val_rmse

