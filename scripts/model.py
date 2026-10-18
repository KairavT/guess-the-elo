import torch
from torch import nn
from config import VOCAB_SIZE, D_MODEL, MAX_SEQ_LEN, N_HEADS,  N_LAYERS, DROPOUT

class EloModel(nn.Module):
    def __init__(self):
        super().__init__()
        self.move_embed = nn.Embedding(num_embeddings=(VOCAB_SIZE+3), embedding_dim=D_MODEL, padding_idx=0)
        self.pos_embed = nn.Embedding(num_embeddings=MAX_SEQ_LEN, embedding_dim=D_MODEL)
        encoder_layer = nn.TransformerEncoderLayer(
            d_model=D_MODEL,
            nhead=N_HEADS,
            dim_feedforward=4*D_MODEL,
            dropout=DROPOUT,
            batch_first=True
        )
        self.encoder = nn.TransformerEncoder(encoder_layer=encoder_layer, num_layers=N_LAYERS)
        self.head = nn.Linear(in_features=D_MODEL, out_features=2)

    def forward(self, ids, mask):
        pos = torch.arange(start=0, end=MAX_SEQ_LEN, device=ids.device)
        x = self.move_embed(ids) + self.pos_embed(pos)
        x = self.encoder(x, src_key_padding_mask=(mask==0))
        x = x[:,0,:]
        return self.head(x)
    
from dataset import ChessDataset
from torch.utils.data import DataLoader
from config import TRAIN_PATH

if __name__ == '__main__':
    model = EloModel()
    d = ChessDataset(TRAIN_PATH)
    loader = DataLoader(d, batch_size=64, shuffle=True)
    ids, mask, targets = next(iter(loader))
    out = model(ids, mask)
    print(out.shape)
    print(sum(p.numel() for p in model.parameters()))
