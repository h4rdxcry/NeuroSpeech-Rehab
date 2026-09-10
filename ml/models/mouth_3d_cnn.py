"""Spatio-Temporal 3D-CNN Mouth Visual Speech Feature Extractor.
Extracts 64-dim visual appearance embeddings from 48x48 mouth video ROI sequences,
capturing tongue position, teeth contact, and oral cavity transitions.
"""
from typing import Optional, Tuple
import torch
import torch.nn as nn
import torch.nn.functional as F


class ResidualBlock3D(nn.Module):
    """3D Spatio-Temporal Residual Convolutional Block."""

    def __init__(self, in_channels: int, out_channels: int, stride_spatial: int = 1):
        super().__init__()
        self.conv1 = nn.Conv3d(
            in_channels,
            out_channels,
            kernel_size=(3, 3, 3),
            stride=(1, stride_spatial, stride_spatial),
            padding=(1, 1, 1),
            bias=False,
        )
        self.bn1 = nn.BatchNorm3d(out_channels)
        self.conv2 = nn.Conv3d(
            out_channels,
            out_channels,
            kernel_size=(3, 3, 3),
            stride=1,
            padding=(1, 1, 1),
            bias=False,
        )
        self.bn2 = nn.BatchNorm3d(out_channels)

        if in_channels != out_channels or stride_spatial != 1:
            self.shortcut = nn.Sequential(
                nn.Conv3d(
                    in_channels,
                    out_channels,
                    kernel_size=1,
                    stride=(1, stride_spatial, stride_spatial),
                    bias=False,
                ),
                nn.BatchNorm3d(out_channels),
            )
        else:
            self.shortcut = nn.Identity()

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        res = self.shortcut(x)
        out = F.gelu(self.bn1(self.conv1(x)))
        out = self.bn2(self.conv2(out))
        return F.gelu(out + res)


class MouthVisual3DCNN(nn.Module):
    """3D-CNN Spatio-Temporal Backbone for Pixel-Level Lip & Oral Feature Extraction."""

    def __init__(self, in_channels: int = 1, out_dim: int = 64, dropout: float = 0.1):
        super().__init__()
        self.out_dim = out_dim

        # Initial 3D Spatio-Temporal Convolution (48x48 -> 24x24 -> 12x12)
        self.stem = nn.Sequential(
            nn.Conv3d(
                in_channels,
                32,
                kernel_size=(3, 5, 5),
                stride=(1, 2, 2),
                padding=(1, 2, 2),
                bias=False,
            ),
            nn.BatchNorm3d(32),
            nn.GELU(),
            nn.MaxPool3d(kernel_size=(1, 2, 2), stride=(1, 2, 2)),
        )

        # Stage 1: 32 -> 64 channels, spatial downsampling 12x12 -> 6x6
        self.stage1 = ResidualBlock3D(32, 64, stride_spatial=2)

        # Stage 2: 64 -> 64 channels refinement (6x6)
        self.stage2 = ResidualBlock3D(64, 64, stride_spatial=1)

        # Spatio-temporal adaptive pooling: collapses spatial (H, W) -> (1, 1) while preserving T
        self.spatial_pool = nn.AdaptiveAvgPool3d((None, 1, 1))

        # Temporal output projection
        self.proj = nn.Sequential(
            nn.Linear(64, out_dim),
            nn.LayerNorm(out_dim),
            nn.Dropout(dropout),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """
        Args:
            x: Tensor of shape (Batch, 1, T, H, W) or (Batch, T, 1, H, W).
        Returns:
            visual_seq: (Batch, T, out_dim) temporal visual appearance features.
        """
        # Ensure input is (Batch, C, T, H, W)
        if x.ndim == 4:
            # (Batch, T, H, W) -> (Batch, 1, T, H, W)
            x = x.unsqueeze(1)
        elif x.ndim == 5 and x.shape[2] == 1 and x.shape[1] > 1:
            # (Batch, T, 1, H, W) -> (Batch, 1, T, H, W)
            x = x.permute(0, 2, 1, 3, 4)

        b, c, t, h, w = x.shape

        # Handle single-frame edge case by temporal replication
        is_single_frame = (t == 1)
        if is_single_frame:
            x = x.repeat(1, 1, 3, 1, 1)

        # Forward 3D CNN
        h_feat = self.stem(x)        # (B, 32, T, 12, 12)
        h_feat = self.stage1(h_feat) # (B, 64, T, 6, 6)
        h_feat = self.stage2(h_feat) # (B, 64, T, 6, 6)

        # Pool spatial dimensions: (B, 64, T, 1, 1)
        pooled = self.spatial_pool(h_feat)

        # Permute to (B, T, 64)
        seq = pooled.squeeze(-1).squeeze(-1).transpose(1, 2)

        if is_single_frame:
            seq = seq[:, :1, :]

        # Linear projection to out_dim
        out = self.proj(seq)
        return out
