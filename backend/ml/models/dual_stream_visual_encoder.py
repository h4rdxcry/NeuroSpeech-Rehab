"""Dual-Stream Visual Speech Network.
Fuses 40-dim Kinematic Trajectories (Stream 1) with 3D-CNN Mouth Appearance Pixels (Stream 2)
via adaptive cross-modal gating and anticipatory coarticulation temporal attention.
"""
from typing import Dict, List, Optional, Tuple, Any
import torch
import torch.nn as nn
import torch.nn.functional as F

from ml.models.mouth_3d_cnn import MouthVisual3DCNN


class AnticipatoryCoarticulationBlock(nn.Module):
    """Bidirectional Temporal Attention Block capturing phoneme transitions and anticipatory mouth shaping."""

    def __init__(self, dim: int = 64, num_heads: int = 4, dropout: float = 0.1):
        super().__init__()
        self.attn = nn.MultiheadAttention(embed_dim=dim, num_heads=num_heads, dropout=dropout, batch_first=True)
        self.norm1 = nn.LayerNorm(dim)
        self.ffn = nn.Sequential(
            nn.Linear(dim, dim * 2),
            nn.GELU(),
            nn.Dropout(dropout),
            nn.Linear(dim * 2, dim),
        )
        self.norm2 = nn.LayerNorm(dim)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        # x: (Batch, T, dim)
        attn_out, _ = self.attn(x, x, x)
        x = self.norm1(x + attn_out)
        ffn_out = self.ffn(x)
        return self.norm2(x + ffn_out)


class DualStreamVisualSpeechEncoder(nn.Module):
    """Dual-Stream Gated Visual Speech Recognition Network."""

    def __init__(
        self,
        kinematics_dim: int = 40,
        pixel_channels: int = 1,
        hidden_dim: int = 64,
        d_model: int = 128,
        num_viseme_classes: int = 8,
        dropout: float = 0.1,
    ):
        super().__init__()
        self.hidden_dim = hidden_dim
        self.d_model = d_model

        # Stream 1: Kinematic Geometric Encoder
        self.kinematics_encoder = nn.Sequential(
            nn.Linear(kinematics_dim, hidden_dim),
            nn.LayerNorm(hidden_dim),
            nn.GELU(),
            nn.Dropout(dropout),
            nn.Linear(hidden_dim, hidden_dim),
            nn.LayerNorm(hidden_dim),
        )

        # Stream 2: Spatio-Temporal 3D-CNN Mouth Pixel Encoder
        self.pixel_3d_cnn = MouthVisual3DCNN(
            in_channels=pixel_channels,
            out_dim=hidden_dim,
            dropout=dropout,
        )

        # Adaptive Cross-Modal Gating: dynamically weights geometry vs appearance
        self.gate_net = nn.Sequential(
            nn.Linear(hidden_dim * 2, hidden_dim),
            nn.GELU(),
            nn.Linear(hidden_dim, hidden_dim),
            nn.Sigmoid(),
        )

        # Anticipatory Coarticulation Temporal Transformer
        self.coarticulation = AnticipatoryCoarticulationBlock(
            dim=hidden_dim,
            num_heads=4,
            dropout=dropout,
        )

        # Frame-level Viseme Classification Head
        self.viseme_head = nn.Sequential(
            nn.Linear(hidden_dim, hidden_dim),
            nn.GELU(),
            nn.Linear(hidden_dim, num_viseme_classes),
        )

        # Sequence Attention Pooling -> d_model
        self.pool_query = nn.Parameter(torch.randn(1, 1, hidden_dim) * 0.02)
        self.seq_proj = nn.Sequential(
            nn.Linear(hidden_dim, d_model),
            nn.LayerNorm(d_model),
        )

    def forward(
        self,
        kinematics_seq: Optional[torch.Tensor] = None,
        pixel_seq: Optional[torch.Tensor] = None,
    ) -> Dict[str, torch.Tensor]:
        """
        Args:
            kinematics_seq: (Batch, T, 40) trajectory tensor.
            pixel_seq: (Batch, 1, T, 48, 48) or (Batch, T, 1, 48, 48) mouth video tensor.
        Returns:
            Dict containing:
                "viseme_logits": (Batch, T, 8)
                "visual_embedding": (Batch, d_model)
                "gating_weights": (Batch, T, hidden_dim) or None
                "predicted_visemes": (Batch, T)
        """
        device = next(self.parameters()).device

        k_feat: Optional[torch.Tensor] = None
        p_feat: Optional[torch.Tensor] = None

        if kinematics_seq is not None:
            k_feat = self.kinematics_encoder(kinematics_seq.to(device))

        if pixel_seq is not None:
            p_feat = self.pixel_3d_cnn(pixel_seq.to(device))

        # Stream Fusion
        gating: Optional[torch.Tensor] = None
        if k_feat is not None and p_feat is not None:
            # Match temporal lengths if slight discrepancy
            min_t = min(k_feat.shape[1], p_feat.shape[1])
            k_feat = k_feat[:, :min_t, :]
            p_feat = p_feat[:, :min_t, :]

            # Adaptive gating
            concat = torch.cat([k_feat, p_feat], dim=-1)
            gating = self.gate_net(concat)  # (Batch, T, hidden_dim) in [0, 1]
            fused_stream = (gating * k_feat) + ((1.0 - gating) * p_feat)

        elif k_feat is not None:
            fused_stream = k_feat
        elif p_feat is not None:
            fused_stream = p_feat
        else:
            raise ValueError("Either kinematics_seq or pixel_seq must be provided to DualStreamVisualSpeechEncoder")

        # Anticipatory Coarticulation Modeling
        coarticulated = self.coarticulation(fused_stream)

        # Frame-level viseme logits: (Batch, T, 8)
        viseme_logits = self.viseme_head(coarticulated)

        # Sequence Attention Pooling
        b = coarticulated.shape[0]
        attn_scores = torch.bmm(coarticulated, self.pool_query.expand(b, -1, -1).transpose(1, 2))  # (B, T, 1)
        attn_weights = F.softmax(attn_scores, dim=1)
        pooled = torch.sum(coarticulated * attn_weights, dim=1)  # (B, hidden_dim)

        # Project to d_model (128)
        seq_emb = self.seq_proj(pooled)

        return {
            "viseme_logits": viseme_logits,
            "visual_embedding": seq_emb,
            "gating_weights": gating,
            "predicted_visemes": torch.argmax(viseme_logits, dim=-1),
            "coarticulated_features": coarticulated,
        }
