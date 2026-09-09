"""Biosignal Encoders for Facial sEMG, EEG, and Facial Articulatory Kinematics.
Designed for research-grade multimodal speech rehabilitation.
"""
from typing import Dict, Optional
import torch
import torch.nn as nn
import torch.nn.functional as F


class ResidualBlock1D(nn.Module):
    def __init__(self, channels: int, dropout: float = 0.1):
        super().__init__()
        self.fc1 = nn.Linear(channels, channels)
        self.norm1 = nn.LayerNorm(channels)
        self.fc2 = nn.Linear(channels, channels)
        self.norm2 = nn.LayerNorm(channels)
        self.dropout = nn.Dropout(dropout)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        residual = x
        out = F.gelu(self.norm1(self.fc1(x)))
        out = self.dropout(out)
        out = self.norm2(self.fc2(out))
        return F.gelu(out + residual)


class FacialEMGEncoder(nn.Module):
    """Encodes 8-channel facial sEMG features (MAV, RMS, envelope, waveform length, median frequency)
    from datasets such as Zenodo Facial sEMG into a latent neuromuscular embedding.
    """
    def __init__(self, in_features: int = 40, latent_dim: int = 64, dropout: float = 0.1):
        super().__init__()
        self.input_proj = nn.Sequential(
            nn.Linear(in_features, 128),
            nn.LayerNorm(128),
            nn.GELU(),
            nn.Dropout(dropout),
        )
        self.res_block = ResidualBlock1D(128, dropout=dropout)
        self.output_proj = nn.Sequential(
            nn.Linear(128, latent_dim),
            nn.LayerNorm(latent_dim),
        )

    def forward(self, emg_features: torch.Tensor) -> torch.Tensor:
        # emg_features: (batch_size, in_features)
        h = self.input_proj(emg_features)
        h = self.res_block(h)
        return self.output_proj(h)


class EEGMotorEncoder(nn.Module):
    """Encodes EEG spectral band powers (delta, theta, alpha, beta, gamma)
    and mu-rhythm suppression from datasets such as OpenNeuro ds007808 into a cortical readiness embedding.
    """
    def __init__(self, in_features: int = 25, latent_dim: int = 64, dropout: float = 0.1):
        super().__init__()
        self.input_proj = nn.Sequential(
            nn.Linear(in_features, 128),
            nn.LayerNorm(128),
            nn.GELU(),
            nn.Dropout(dropout),
        )
        self.res_block = ResidualBlock1D(128, dropout=dropout)
        self.output_proj = nn.Sequential(
            nn.Linear(128, latent_dim),
            nn.LayerNorm(latent_dim),
        )

    def forward(self, eeg_features: torch.Tensor) -> torch.Tensor:
        # eeg_features: (batch_size, in_features)
        h = self.input_proj(eeg_features)
        h = self.res_block(h)
        return self.output_proj(h)


class FacialKinematicsEncoder(nn.Module):
    """Encodes 3D facial tracking kinematics (lip aperture ratio, mouth width ratio,
    lip aspect ratio, jaw displacement, bilateral symmetry) from MediaPipe FaceMesh.
    """
    def __init__(self, in_features: int = 16, latent_dim: int = 64, dropout: float = 0.1):
        super().__init__()
        self.input_proj = nn.Sequential(
            nn.Linear(in_features, 64),
            nn.LayerNorm(64),
            nn.GELU(),
            nn.Dropout(dropout),
        )
        self.res_block = ResidualBlock1D(64, dropout=dropout)
        self.output_proj = nn.Sequential(
            nn.Linear(64, latent_dim),
            nn.LayerNorm(latent_dim),
        )

    def forward(self, face_features: torch.Tensor) -> torch.Tensor:
        # face_features: (batch_size, in_features)
        h = self.input_proj(face_features)
        h = self.res_block(h)
        return self.output_proj(h)


class AcousticEmbeddingEncoder(nn.Module):
    """Encodes acoustic phonetic features from Wav2Vec2 pooler embeddings
    or acoustic descriptors (MFCCs, spectral centroid, formants) into an acoustic embedding.
    """
    def __init__(self, in_features: int = 768, latent_dim: int = 128, dropout: float = 0.1):
        super().__init__()
        self.input_proj = nn.Sequential(
            nn.Linear(in_features, 256),
            nn.LayerNorm(256),
            nn.GELU(),
            nn.Dropout(dropout),
        )
        self.res_block = ResidualBlock1D(256, dropout=dropout)
        self.output_proj = nn.Sequential(
            nn.Linear(256, latent_dim),
            nn.LayerNorm(latent_dim),
        )

    def forward(self, audio_features: torch.Tensor) -> torch.Tensor:
        # audio_features: (batch_size, in_features)
        h = self.input_proj(audio_features)
        h = self.res_block(h)
        return self.output_proj(h)
