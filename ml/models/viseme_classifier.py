"""Viseme Sequence Classifier & Phonetic Mapping Engine.
Provides 8-class clinical viseme classification from 40-dim kinematic trajectories,
CTC-style sequence decoding, and Tamil/English phoneme-to-viseme alignment for visual speech recognition.
"""
from typing import Dict, List, Tuple, Optional, Any
import unicodedata
import torch
import torch.nn as nn
import torch.nn.functional as F
import numpy as np


class VisemeClass:
    BILABIAL = 0        # /p, b, m/
    LABIODENTAL = 1     # /f, v/
    DENTAL_ALVEOLAR = 2 # /t, d, s, z, n, l/
    VELAR_PALATAL = 3   # /k, g, c, j/
    OPEN_VOWEL = 4      # /a, aa/
    SPREAD_VOWEL = 5    # /i, e, ee/
    ROUNDED_VOWEL = 6   # /u, o, oo/
    NEUTRAL_REST = 7    # silence, schwa

    NAMES = [
        "BILABIAL (/p, b, m/)",
        "LABIODENTAL (/f, v/)",
        "DENTAL_ALVEOLAR (/t, d, s, z, n, l/)",
        "VELAR_PALATAL (/k, g, c, j/)",
        "OPEN_VOWEL (/a, aa/)",
        "SPREAD_VOWEL (/i, e, ee/)",
        "ROUNDED_VOWEL (/u, o, oo/)",
        "NEUTRAL_REST (rest/neutral)",
    ]


class PhonemeVisemeMapper:
    """Maps Tamil and English phrases to target viseme sequences and performs sequence alignment."""

    # Tamil Grapheme to Viseme Mapping
    TAMIL_CONSONANTS = {
        "ப": VisemeClass.BILABIAL,
        "ம": VisemeClass.BILABIAL,
        "வ": VisemeClass.LABIODENTAL,
        "த": VisemeClass.DENTAL_ALVEOLAR,
        "ந": VisemeClass.DENTAL_ALVEOLAR,
        "ற": VisemeClass.DENTAL_ALVEOLAR,
        "ன": VisemeClass.DENTAL_ALVEOLAR,
        "ட": VisemeClass.DENTAL_ALVEOLAR,
        "ண": VisemeClass.DENTAL_ALVEOLAR,
        "ல": VisemeClass.DENTAL_ALVEOLAR,
        "ள": VisemeClass.DENTAL_ALVEOLAR,
        "ழ": VisemeClass.DENTAL_ALVEOLAR,
        "ர": VisemeClass.DENTAL_ALVEOLAR,
        "ச": VisemeClass.DENTAL_ALVEOLAR,
        "ஸ": VisemeClass.DENTAL_ALVEOLAR,
        "ஷ": VisemeClass.DENTAL_ALVEOLAR,
        "ஜ": VisemeClass.VELAR_PALATAL,
        "க": VisemeClass.VELAR_PALATAL,
        "ங": VisemeClass.VELAR_PALATAL,
        "ய": VisemeClass.VELAR_PALATAL,
        "ஹ": VisemeClass.NEUTRAL_REST,
    }

    TAMIL_INDEPENDENT_VOWELS = {
        "அ": VisemeClass.OPEN_VOWEL,
        "ஆ": VisemeClass.OPEN_VOWEL,
        "இ": VisemeClass.SPREAD_VOWEL,
        "ஈ": VisemeClass.SPREAD_VOWEL,
        "உ": VisemeClass.ROUNDED_VOWEL,
        "ஊ": VisemeClass.ROUNDED_VOWEL,
        "எ": VisemeClass.SPREAD_VOWEL,
        "ஏ": VisemeClass.SPREAD_VOWEL,
        "ஐ": VisemeClass.SPREAD_VOWEL,
        "ஒ": VisemeClass.ROUNDED_VOWEL,
        "ஓ": VisemeClass.ROUNDED_VOWEL,
        "ஔ": VisemeClass.ROUNDED_VOWEL,
    }

    TAMIL_VOWEL_SIGNS = {
        "ா": VisemeClass.OPEN_VOWEL,
        "ி": VisemeClass.SPREAD_VOWEL,
        "ீ": VisemeClass.SPREAD_VOWEL,
        "ு": VisemeClass.ROUNDED_VOWEL,
        "ூ": VisemeClass.ROUNDED_VOWEL,
        "ெ": VisemeClass.SPREAD_VOWEL,
        "ே": VisemeClass.SPREAD_VOWEL,
        "ை": VisemeClass.SPREAD_VOWEL,
        "ொ": VisemeClass.ROUNDED_VOWEL,
        "ோ": VisemeClass.ROUNDED_VOWEL,
        "ௌ": VisemeClass.ROUNDED_VOWEL,
    }

    # English Letter/Digraph Mapping
    ENGLISH_VISEME_MAP = {
        "p": VisemeClass.BILABIAL, "b": VisemeClass.BILABIAL, "m": VisemeClass.BILABIAL,
        "f": VisemeClass.LABIODENTAL, "v": VisemeClass.LABIODENTAL,
        "t": VisemeClass.DENTAL_ALVEOLAR, "d": VisemeClass.DENTAL_ALVEOLAR,
        "s": VisemeClass.DENTAL_ALVEOLAR, "z": VisemeClass.DENTAL_ALVEOLAR,
        "n": VisemeClass.DENTAL_ALVEOLAR, "l": VisemeClass.DENTAL_ALVEOLAR,
        "r": VisemeClass.DENTAL_ALVEOLAR, "th": VisemeClass.DENTAL_ALVEOLAR,
        "k": VisemeClass.VELAR_PALATAL, "g": VisemeClass.VELAR_PALATAL,
        "c": VisemeClass.VELAR_PALATAL, "j": VisemeClass.VELAR_PALATAL,
        "a": VisemeClass.OPEN_VOWEL,
        "e": VisemeClass.SPREAD_VOWEL, "i": VisemeClass.SPREAD_VOWEL, "y": VisemeClass.SPREAD_VOWEL,
        "o": VisemeClass.ROUNDED_VOWEL, "u": VisemeClass.ROUNDED_VOWEL, "w": VisemeClass.ROUNDED_VOWEL,
    }

    @classmethod
    def phrase_to_visemes(cls, phrase: str) -> List[int]:
        """Translates a target phrase into a canonical expected sequence of Viseme classes."""
        if not phrase:
            return []

        clean_phrase = unicodedata.normalize("NFC", phrase.strip())
        visemes: List[int] = []
        i = 0
        n = len(clean_phrase)

        while i < n:
            ch = clean_phrase[i]

            if ch in [" ", "\t", "\n", "-", ".", ",", "!", "?"]:
                visemes.append(VisemeClass.NEUTRAL_REST)
                i += 1
            elif ch in cls.TAMIL_INDEPENDENT_VOWELS:
                visemes.append(cls.TAMIL_INDEPENDENT_VOWELS[ch])
                i += 1
            elif ch in cls.TAMIL_CONSONANTS:
                c_vis = cls.TAMIL_CONSONANTS[ch]
                visemes.append(c_vis)
                # Check next character
                if i + 1 < n:
                    nxt = clean_phrase[i + 1]
                    if nxt == "\u0BCD":  # Tamil Virama / Pulli (suppresses vowel)
                        i += 2
                    elif nxt in cls.TAMIL_VOWEL_SIGNS:
                        visemes.append(cls.TAMIL_VOWEL_SIGNS[nxt])
                        i += 2
                    else:
                        # Inherent /a/ open vowel
                        visemes.append(VisemeClass.OPEN_VOWEL)
                        i += 1
                else:
                    # Inherent /a/ at word end
                    visemes.append(VisemeClass.OPEN_VOWEL)
                    i += 1
            elif ch in cls.TAMIL_VOWEL_SIGNS:
                visemes.append(cls.TAMIL_VOWEL_SIGNS[ch])
                i += 1
            elif ch.lower() in cls.ENGLISH_VISEME_MAP:
                visemes.append(cls.ENGLISH_VISEME_MAP[ch.lower()])
                i += 1
            else:
                i += 1

        # Collapse immediate duplicates (e.g. [OPEN, OPEN] -> [OPEN])
        collapsed: List[int] = []
        for v in visemes:
            if not collapsed or collapsed[-1] != v:
                collapsed.append(v)

        return collapsed if collapsed else [VisemeClass.NEUTRAL_REST]

    @staticmethod
    def align_viseme_sequences(predicted_visemes: List[int], target_visemes: List[int]) -> Dict[str, Any]:
        """Aligns predicted sequence of visemes against target visemes using Needleman-Wunsch/Levenshtein."""
        # Collapse consecutive identical predictions (CTC greedy decode style)
        pred_collapsed: List[int] = []
        for p in predicted_visemes:
            if not pred_collapsed or pred_collapsed[-1] != p:
                pred_collapsed.append(p)

        # Filter out trailing neutral/rest
        p_filtered = [v for v in pred_collapsed if v != VisemeClass.NEUTRAL_REST]
        t_filtered = [v for v in target_visemes if v != VisemeClass.NEUTRAL_REST]

        if not t_filtered:
            return {
                "viseme_match_score": 1.0 if not p_filtered else 0.5,
                "target_visemes": target_visemes,
                "predicted_visemes": pred_collapsed,
                "matched_count": len(p_filtered),
                "is_visually_verified": True,
            }

        if not p_filtered:
            return {
                "viseme_match_score": 0.0,
                "target_visemes": target_visemes,
                "predicted_visemes": pred_collapsed,
                "matched_count": 0,
                "is_visually_verified": False,
            }

        # Edit distance
        n, m = len(p_filtered), len(t_filtered)
        dp = np.zeros((n + 1, m + 1), dtype=int)
        for i in range(n + 1):
            dp[i, 0] = i
        for j in range(m + 1):
            dp[0, j] = j

        for i in range(1, n + 1):
            for j in range(1, m + 1):
                cost = 0 if p_filtered[i - 1] == t_filtered[j - 1] else 1
                dp[i, j] = min(
                    dp[i - 1, j] + 1,      # deletion
                    dp[i, j - 1] + 1,      # insertion
                    dp[i - 1, j - 1] + cost # substitution
                )

        edit_dist = int(dp[n, m])
        max_len = max(n, m)
        match_score = max(0.0, 1.0 - (edit_dist / max_len))

        # Check if all target visemes are present in the predicted sequence in order
        target_idx = 0
        for p_val in p_filtered:
            if target_idx < len(t_filtered) and p_val == t_filtered[target_idx]:
                target_idx += 1
        subsequence_ratio = target_idx / len(t_filtered)

        composite_score = round(float((match_score * 0.6) + (subsequence_ratio * 0.4)), 4)
        is_verified = bool(composite_score >= 0.70)

        return {
            "viseme_match_score": composite_score,
            "edit_distance": edit_dist,
            "target_visemes": target_visemes,
            "predicted_visemes": pred_collapsed,
            "is_visually_verified": is_verified,
            "subsequence_ratio": round(float(subsequence_ratio), 4),
        }


class TemporalVisemeClassifier(nn.Module):
    """1D-TCN + Bidirectional GRU Model for Temporal Viseme Sequence Classification and Embedding."""

    def __init__(self, in_dim: int = 40, num_classes: int = 8, hidden_dim: int = 64, d_model: int = 128):
        super().__init__()
        self.in_proj = nn.Sequential(
            nn.Linear(in_dim, hidden_dim),
            nn.LayerNorm(hidden_dim),
            nn.GELU(),
            nn.Dropout(0.1),
        )

        # 1D Temporal Convolution
        self.tcn = nn.Sequential(
            nn.Conv1d(hidden_dim, hidden_dim, kernel_size=3, padding=1),
            nn.BatchNorm1d(hidden_dim),
            nn.GELU(),
            nn.Dropout(0.1),
        )

        # Bidirectional GRU
        self.gru = nn.GRU(
            input_size=hidden_dim,
            hidden_size=hidden_dim,
            num_layers=2,
            batch_first=True,
            bidirectional=True,
            dropout=0.1,
        )

        # Frame-level classifier head
        self.frame_head = nn.Sequential(
            nn.Linear(hidden_dim * 2, hidden_dim),
            nn.GELU(),
            nn.Linear(hidden_dim, num_classes),
        )

        # Sequence Attention Pooling
        self.attn_query = nn.Parameter(torch.randn(1, 1, hidden_dim * 2) * 0.02)
        self.seq_proj = nn.Sequential(
            nn.Linear(hidden_dim * 2, d_model),
            nn.LayerNorm(d_model),
        )

    def forward(self, x: torch.Tensor) -> Tuple[torch.Tensor, torch.Tensor]:
        """
        Args:
            x: (Batch, T, in_dim) kinematic features.
        Returns:
            frame_logits: (Batch, T, num_classes) frame-level viseme logits.
            seq_embedding: (Batch, d_model) pooled visual sequence embedding.
        """
        # Batch size and sequence length
        b, t, d = x.shape

        # Linear projection: (B, T, D) -> (B, T, hidden)
        h = self.in_proj(x)

        # TCN: transpose to (B, hidden, T)
        h_tcn = self.tcn(h.transpose(1, 2)).transpose(1, 2)
        h = h + h_tcn  # residual connection

        # BiGRU: (B, T, hidden*2)
        gru_out, _ = self.gru(h)

        # Frame-level logits: (B, T, num_classes)
        frame_logits = self.frame_head(gru_out)

        # Attention pooling across time
        attn_scores = torch.bmm(gru_out, self.attn_query.expand(b, -1, -1).transpose(1, 2))  # (B, T, 1)
        attn_weights = F.softmax(attn_scores, dim=1)  # (B, T, 1)
        pooled = torch.sum(gru_out * attn_weights, dim=1)  # (B, hidden*2)

        # Project to d_model for multimodal cross-attention
        seq_embedding = self.seq_proj(pooled)

        return frame_logits, seq_embedding

    _priors_cache: Optional[Dict[str, Any]] = None

    @classmethod
    def get_empirical_priors(cls) -> Optional[Dict[str, Any]]:
        """Loads and caches empirical viseme kinematic distributions extracted from open-source benchmarks."""
        if cls._priors_cache is not None:
            return cls._priors_cache
        try:
            from pathlib import Path
            import json
            priors_path = Path(__file__).resolve().parent / "empirical_viseme_priors.json"
            if priors_path.exists():
                with open(priors_path, "r", encoding="utf-8") as f:
                    cls._priors_cache = json.load(f)
                return cls._priors_cache
        except Exception:
            pass
        return None

    @classmethod
    def classify_frame_empirical(
        cls, 
        feature_40d: List[float], 
        ap_vel: float = 0.0, 
        w_vel: float = 0.0, 
        prev_viseme: Optional[int] = None
    ) -> Tuple[int, float, Dict[int, float]]:
        """Classifies a 40-D kinematic frame using empirical multivariate Gaussian log-likelihoods.
        
        Args:
            feature_40d: 40-D kinematic vector.
            ap_vel: Aperture velocity (delta aperture / delta t).
            w_vel: Mouth width velocity (delta width / delta t).
            prev_viseme: Optional previous viseme class index for coarticulation transition priors.
        Returns:
            (best_viseme_class, confidence_0_to_1, posterior_probabilities_dict)
        """
        if len(feature_40d) < 40:
            return VisemeClass.NEUTRAL_REST, 0.5, {v: 0.125 for v in range(8)}

        priors_bundle = cls.get_empirical_priors()
        if not priors_bundle or "empirical_priors" not in priors_bundle:
            fallback = cls.classify_frame_heuristic(feature_40d)
            return fallback, 0.80, {fallback: 0.80}

        empirical = priors_bundle["empirical_priors"]
        trans_matrix = priors_bundle.get("transition_matrix")

        aperture = feature_40d[0]
        width = feature_40d[1]
        x = np.array([aperture, width, ap_vel, w_vel], dtype=np.float64)

        log_scores = np.zeros(8, dtype=np.float64)

        for v_idx in range(8):
            v_key = str(v_idx)
            if v_key not in empirical:
                continue

            v_prior = empirical[v_key]
            g4d = v_prior["gaussian_4d"]
            mean_vec = np.array(g4d["mean"], dtype=np.float64)
            inv_cov = np.array(g4d["inv_cov"], dtype=np.float64)
            cov_diag = np.array(g4d["cov_diag"], dtype=np.float64)

            # Mahalanobis distance squared: (x - mu)^T * inv_cov * (x - mu)
            diff = x - mean_vec
            # Weight velocity slightly less if velocities are zero (e.g. single frame evaluation)
            if ap_vel == 0.0 and w_vel == 0.0:
                diff[2] = 0.0
                diff[3] = 0.0

            mahalanobis_sq = float(np.dot(diff, np.dot(inv_cov, diff)))
            log_det = float(np.sum(np.log(np.maximum(cov_diag, 1e-6))))

            log_likelihood = -0.5 * (mahalanobis_sq + log_det)

            # Add transition prior if prev_viseme provided
            if prev_viseme is not None and trans_matrix and 0 <= prev_viseme < 8:
                t_prob = trans_matrix[prev_viseme][v_idx]
                log_likelihood += np.log(max(t_prob, 1e-4)) * 0.4

            log_scores[v_idx] = log_likelihood

        # Softmax over log scores with numerical stability
        max_log = np.max(log_scores)
        exp_scores = np.exp(np.clip(log_scores - max_log, -50.0, 0.0))
        probabilities = exp_scores / np.sum(exp_scores)

        best_viseme = int(np.argmax(probabilities))
        confidence = float(probabilities[best_viseme])
        prob_dict = {i: round(float(probabilities[i]), 4) for i in range(8)}

        return best_viseme, round(confidence, 4), prob_dict

    @classmethod
    def classify_frame_heuristic(cls, feature_40d: List[float]) -> int:
        """Robust classifier for single 40-dim kinematic frames, combining empirical Gaussian and geometry."""
        if len(feature_40d) < 40:
            return VisemeClass.NEUTRAL_REST

        # Try empirical model first
        try:
            best_vis, conf, _ = cls.classify_frame_empirical(feature_40d)
            if conf >= 0.50:
                return best_vis
        except Exception:
            pass

        lip_aperture = feature_40d[0]
        mouth_width = feature_40d[1]
        aspect_ratio = feature_40d[2]
        jaw_depression = feature_40d[14]

        # 1. Bilabial closure check
        if lip_aperture < 0.08:
            return VisemeClass.BILABIAL

        # 2. Labiodental check (tucked lower lip, slight asymmetry/depth)
        if 0.08 <= lip_aperture < 0.18 and mouth_width >= 0.45:
            return VisemeClass.LABIODENTAL

        # 3. Open vowel check (wide aperture & high jaw depression)
        if lip_aperture >= 0.38 or jaw_depression >= 0.85:
            return VisemeClass.OPEN_VOWEL

        # 4. Spread vowel check (wide mouth, low/medium aperture)
        if mouth_width >= 0.60 and lip_aperture < 0.32:
            return VisemeClass.SPREAD_VOWEL

        # 5. Rounded vowel check (puckered, narrow mouth width)
        if mouth_width < 0.42 and 0.15 <= lip_aperture <= 0.38:
            return VisemeClass.ROUNDED_VOWEL

        # 6. Dental / Alveolar (moderate aperture, teeth visible)
        if 0.15 <= lip_aperture < 0.32 and 0.42 <= mouth_width < 0.60:
            return VisemeClass.DENTAL_ALVEOLAR

        # 7. Default neutral rest
        return VisemeClass.NEUTRAL_REST
