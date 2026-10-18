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
