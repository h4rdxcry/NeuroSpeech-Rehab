"""Multi-Stream Cross-Attention Multimodal Fusion Network.
Fuses Speech Audio, 3D Facial Kinematics, Viseme Sequences, Facial sEMG, and EEG
for Clinical Speech Rehabilitation, Visual Speech Recognition, and Multimodal Biofeedback.
"""
from typing import Dict, List, Optional, Tuple, Any
import torch
import torch.nn as nn
import torch.nn.functional as F

from ml.models.biosignal_encoders import (
    AcousticEmbeddingEncoder,
    FacialKinematicsEncoder,
    FacialEMGEncoder,
    EEGMotorEncoder,
)
from ml.models.viseme_classifier import TemporalVisemeClassifier


class MultimodalFusionModel(nn.Module):
    """Multi-Stream Cross-Attention Fusion Architecture for Speech Rehabilitation.

    Supports dynamic modality availability, temporal viseme sequences, and research ablation studies.
    """
    MODALITIES = ["AUDIO", "VISION", "EMG", "EEG"]

    def __init__(
        self,
        audio_in_dim: int = 768,
        vision_in_dim: int = 16,
        emg_in_dim: int = 40,
        eeg_in_dim: int = 25,
        d_model: int = 128,
        num_heads: int = 4,
        dropout: float = 0.1,
    ):
        super().__init__()
        self.d_model = d_model

        # Modality Encoders
        self.audio_encoder = AcousticEmbeddingEncoder(in_features=audio_in_dim, latent_dim=d_model, dropout=dropout)
        self.vision_encoder = FacialKinematicsEncoder(in_features=vision_in_dim, latent_dim=d_model, dropout=dropout)
        self.vision_40_proj = nn.Linear(40, vision_in_dim)  # Adapter for 40-dim single frame kinematics
        self.temporal_viseme_encoder = TemporalVisemeClassifier(in_dim=40, num_classes=8, hidden_dim=64, d_model=d_model)
        self.emg_encoder = FacialEMGEncoder(in_features=emg_in_dim, latent_dim=d_model, dropout=dropout)
        self.eeg_encoder = EEGMotorEncoder(in_features=eeg_in_dim, latent_dim=d_model, dropout=dropout)

        # Modality Positional / Identification Embeddings
        self.modality_embed = nn.Parameter(torch.randn(4, d_model) * 0.02)

        # Cross-Modal Multi-Head Self-Attention
        self.attention = nn.MultiheadAttention(embed_dim=d_model, num_heads=num_heads, dropout=dropout, batch_first=True)
        self.norm1 = nn.LayerNorm(d_model)
        self.feed_forward = nn.Sequential(
            nn.Linear(d_model, d_model * 2),
            nn.GELU(),
            nn.Dropout(dropout),
            nn.Linear(d_model * 2, d_model),
        )
        self.norm2 = nn.LayerNorm(d_model)

        # Audio-Visual Cross-Modal Interaction Head
        self.av_cross_attention = nn.MultiheadAttention(embed_dim=d_model, num_heads=num_heads, dropout=dropout, batch_first=True)
        self.av_joint_head = nn.Sequential(
            nn.Linear(d_model * 2, 64),
            nn.GELU(),
            nn.Linear(64, 1),
            nn.Sigmoid(),
        )

        # Classification & Biofeedback Heads
        # 1. Rehabilitation Mastery Score (0.0 to 1.0)
        self.rehab_score_head = nn.Sequential(
            nn.Linear(d_model, 64),
            nn.GELU(),
            nn.Linear(64, 1),
            nn.Sigmoid(),
        )

        # 2. Articulatory Mastery Category (0: NEEDS_PRACTICE, 1: APPROXIMATED, 2: TARGET_MASTERED)
        self.category_head = nn.Sequential(
            nn.Linear(d_model, 64),
            nn.GELU(),
            nn.Linear(64, 3),
        )

        # 3. Kinematic Articulation Guidance (Predicted Lip Aperture Ratio 0-1)
        self.kinematic_head = nn.Sequential(
            nn.Linear(d_model, 32),
            nn.GELU(),
            nn.Linear(32, 1),
            nn.Sigmoid(),
        )

        # 4. Confidence / Uncertainty Head
        self.confidence_head = nn.Sequential(
            nn.Linear(d_model, 32),
            nn.GELU(),
            nn.Linear(32, 1),
            nn.Sigmoid(),
        )

        # 5. Articulatory Motor Coordination Head
        self.motor_score_head = nn.Sequential(
            nn.Linear(d_model, 32),
            nn.GELU(),
            nn.Linear(32, 1),
            nn.Sigmoid(),
        )

    def forward(
        self,
        audio_feat: Optional[torch.Tensor] = None,
        vision_feat: Optional[torch.Tensor] = None,
        emg_feat: Optional[torch.Tensor] = None,
        eeg_feat: Optional[torch.Tensor] = None,
        vision_seq: Optional[torch.Tensor] = None,
        active_modalities: Optional[List[str]] = None,
    ) -> Dict[str, torch.Tensor]:
        """Forward pass with optional dynamic modality masking and temporal viseme integration."""
        device = next(self.parameters()).device
        batch_size = 1

        # Determine batch size from first non-None tensor
        for feat in (audio_feat, vision_feat, vision_seq, emg_feat, eeg_feat):
            if feat is not None:
                batch_size = feat.shape[0]
                break

        tokens: List[torch.Tensor] = []
        mask: List[bool] = []  # True = valid, False = masked

        # Encode Audio
        a_emb: Optional[torch.Tensor] = None
        if audio_feat is not None and (active_modalities is None or "AUDIO" in active_modalities):
            a_emb = self.audio_encoder(audio_feat)
            tokens.append((a_emb + self.modality_embed[0]).unsqueeze(1))
            mask.append(False)  # Not ignored
        else:
            dummy = torch.zeros(batch_size, 1, self.d_model, device=device)
            tokens.append(dummy)
            mask.append(True)  # Ignored by attention

        # Encode Vision (Temporal sequence takes precedence if provided)
        v_emb: Optional[torch.Tensor] = None
        viseme_frame_logits: Optional[torch.Tensor] = None
        if (vision_seq is not None or vision_feat is not None) and (active_modalities is None or "VISION" in active_modalities):
            if vision_seq is not None:
                # Sequence: (B, T, 40)
                viseme_frame_logits, v_emb = self.temporal_viseme_encoder(vision_seq)
            elif vision_feat is not None:
                if vision_feat.shape[-1] == 40:
                    v_16 = self.vision_40_proj(vision_feat)
                    v_emb = self.vision_encoder(v_16)
                else:
                    v_emb = self.vision_encoder(vision_feat)

            tokens.append((v_emb + self.modality_embed[1]).unsqueeze(1))
            mask.append(False)
        else:
            dummy = torch.zeros(batch_size, 1, self.d_model, device=device)
            tokens.append(dummy)
            mask.append(True)

        # Encode EMG
        if emg_feat is not None and (active_modalities is None or "EMG" in active_modalities):
            e_emb = self.emg_encoder(emg_feat) + self.modality_embed[2]
            tokens.append(e_emb.unsqueeze(1))
            mask.append(False)
        else:
            dummy = torch.zeros(batch_size, 1, self.d_model, device=device)
            tokens.append(dummy)
            mask.append(True)

        # Encode EEG
        if eeg_feat is not None and (active_modalities is None or "EEG" in active_modalities):
            g_emb = self.eeg_encoder(eeg_feat) + self.modality_embed[3]
            tokens.append(g_emb.unsqueeze(1))
            mask.append(False)
        else:
            dummy = torch.zeros(batch_size, 1, self.d_model, device=device)
            tokens.append(dummy)
            mask.append(True)

        # Sequence of modality tokens: (batch_size, 4, d_model)
        seq = torch.cat(tokens, dim=1)
        key_padding_mask = torch.tensor([mask] * batch_size, dtype=torch.bool, device=device)

        # If all modalities are masked, unmask first to prevent NaN
        if all(mask):
            key_padding_mask[:, 0] = False

        # Multi-Head Attention
        attn_out, attn_weights = self.attention(
            seq, seq, seq, key_padding_mask=key_padding_mask, need_weights=True
        )
        x = self.norm1(seq + attn_out)
        ff_out = self.feed_forward(x)
        fused_seq = self.norm2(x + ff_out)

        # Masked Average Pooling over active modalities
        weights = (~key_padding_mask).float().unsqueeze(-1)  # (batch, 4, 1)
        pooled = (fused_seq * weights).sum(dim=1) / weights.sum(dim=1).clamp(min=1.0)

        # Audio-Visual Cross Attention & Joint Confidence
        if a_emb is not None and v_emb is not None:
            a_token = a_emb.unsqueeze(1)  # (B, 1, d_model)
            v_token = v_emb.unsqueeze(1)  # (B, 1, d_model)
            av_attn, _ = self.av_cross_attention(a_token, v_token, v_token)
            av_cat = torch.cat([a_token.squeeze(1), av_attn.squeeze(1)], dim=-1)
            joint_av_conf = self.av_joint_head(av_cat).squeeze(-1)
        elif a_emb is not None or v_emb is not None:
            joint_av_conf = self.confidence_head(pooled).squeeze(-1)
        else:
            joint_av_conf = torch.zeros(batch_size, device=device)

        # Predict clinical scores
        rehab_score = self.rehab_score_head(pooled).squeeze(-1)  # (batch,)
        category_logits = self.category_head(pooled)             # (batch, 3)
        kinematic_target = self.kinematic_head(pooled).squeeze(-1)
        confidence = self.confidence_head(pooled).squeeze(-1)
        motor_score = self.motor_score_head(pooled).squeeze(-1)

        # Compute modality contribution weights from attention
        modality_contributions = attn_weights.mean(dim=1) if attn_weights is not None else None

        result: Dict[str, Any] = {
            "rehab_score": rehab_score,
            "category_logits": category_logits,
            "predicted_category": torch.argmax(category_logits, dim=-1),
            "target_lip_aperture": kinematic_target,
            "confidence": confidence,
            "joint_av_confidence": joint_av_conf,
            "motor_score": motor_score,
            "modality_contributions": modality_contributions,
            "fused_embedding": pooled,
        }

        if viseme_frame_logits is not None:
            result["viseme_frame_logits"] = viseme_frame_logits
            result["predicted_visemes"] = torch.argmax(viseme_frame_logits, dim=-1)

        return result
