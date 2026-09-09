"""Tests for Multimodal AI Fusion Model, Articulation Scorer, and Inference Engine.
Verifies 95%+ Target Articulation Verification and <150ms inference latency.
"""
import time
import pytest
import torch
import numpy as np

from ml.models.biosignal_encoders import (
    FacialEMGEncoder,
    EEGMotorEncoder,
    FacialKinematicsEncoder,
    AcousticEmbeddingEncoder,
)
from ml.models.multimodal_fusion import MultimodalFusionModel
from ml.models.articulation_scorer import ArticulationScorer
from ml.models.inference_engine import MultimodalInferenceEngine
from ml.pipelines.multimodal_feature_extractor import MultimodalFeatureExtractor


def test_encoders_output_shapes():
    audio_enc = AcousticEmbeddingEncoder(in_features=768, latent_dim=128)
    vision_enc = FacialKinematicsEncoder(in_features=16, latent_dim=64)
    emg_enc = FacialEMGEncoder(in_features=40, latent_dim=64)
    eeg_enc = EEGMotorEncoder(in_features=25, latent_dim=64)

    a_out = audio_enc(torch.randn(2, 768))
    v_out = vision_enc(torch.randn(2, 16))
    e_out = emg_enc(torch.randn(2, 40))
    g_out = eeg_enc(torch.randn(2, 25))

    assert a_out.shape == (2, 128)
    assert v_out.shape == (2, 64)
    assert e_out.shape == (2, 64)
    assert g_out.shape == (2, 64)


def test_multimodal_fusion_forward_and_ablation():
    model = MultimodalFusionModel(
        audio_in_dim=768,
        vision_in_dim=16,
        emg_in_dim=40,
        eeg_in_dim=25,
        d_model=128,
    )
    model.eval()

    audio = torch.randn(4, 768)
    vision = torch.randn(4, 16)
    emg = torch.randn(4, 40)
    eeg = torch.randn(4, 25)

    # 1. Full Multimodal forward
    with torch.inference_mode():
        out = model(audio, vision, emg, eeg)
    assert out["rehab_score"].shape == (4,)
    assert out["category_logits"].shape == (4, 3)
    assert out["predicted_category"].shape == (4,)
    assert out["target_lip_aperture"].shape == (4,)
    assert (out["rehab_score"] >= 0.0).all() and (out["rehab_score"] <= 1.0).all()

    # 2. Ablation: Audio + Vision only
    with torch.inference_mode():
        out_ab = model(audio, vision, None, None, active_modalities=["AUDIO", "VISION"])
    assert out_ab["rehab_score"].shape == (4,)

    # 3. Ablation: Vision only (silent articulation)
    with torch.inference_mode():
        out_v = model(None, vision, None, None, active_modalities=["VISION"])
    assert out_v["rehab_score"].shape == (4,)


def test_articulation_scorer_exact_match():
    target = "வணக்கம்"
    recognized = "வணக்கம்"
    result = ArticulationScorer.compute_target_match(target, recognized)
    assert result["is_target_mastered"] is True
    assert result["target_match_ratio"] >= 0.95
    assert result["character_error_rate"] == 0.0


def test_articulation_scorer_phonetic_variation():
    target = "காலை வணக்கம்"
    recognized = "காலை வணக்க"  # Minor ending omission
    result = ArticulationScorer.compute_target_match(target, recognized)
    assert result["target_match_ratio"] >= 0.80
    assert result["edit_distance"] >= 1


def test_lip_kinematics_evaluation():
    # Test open vowel /a/ target
    eval_good = ArticulationScorer.evaluate_lip_kinematics(
        lip_aperture_ratio=0.55,
        mouth_width_ratio=0.50,
        target_vowel_type="open_vowel",
    )
    assert eval_good["within_target_bounds"] is True
    assert eval_good["kinematic_score"] >= 0.90
    assert "Perfect" in eval_good["biofeedback_cue"]

    # Test mouth too closed
    eval_closed = ArticulationScorer.evaluate_lip_kinematics(
        lip_aperture_ratio=0.15,
        mouth_width_ratio=0.50,
        target_vowel_type="open_vowel",
    )
    assert eval_closed["within_target_bounds"] is False
    assert "Open mouth slightly wider" in eval_closed["biofeedback_cue"]


def test_composite_rehab_scoring():
    summary_master = ArticulationScorer.compute_composite_rehab_score(
        acoustic_match=0.98,
        kinematic_score=0.95,
        emg_symmetry=0.92,
        eeg_engagement=0.90,
    )
    assert summary_master["clinical_category"] == "TARGET_MASTERED"
    assert summary_master["mastery_percentage"] >= 95.0
    assert summary_master["game_stars"] == 3

    summary_approx = ArticulationScorer.compute_composite_rehab_score(
        acoustic_match=0.75,
        kinematic_score=0.70,
    )
    assert summary_approx["clinical_category"] in ("APPROXIMATED", "STRONG_PROGRESS")
    assert summary_approx["game_stars"] in (1, 2)


def test_feature_extractor_facemesh():
    # 468 dummy landmarks with realistic face structure
    landmarks = [[float(i % 10) * 0.05, float(i // 10) * 0.05, 0.0] for i in range(468)]
    # Set outer eye corners (33 and 263)
    landmarks[33] = [0.2, 0.4, 0.0]
    landmarks[263] = [0.8, 0.4, 0.0]
    # Set lips (13 and 14)
    landmarks[13] = [0.5, 0.65, 0.0]
    landmarks[14] = [0.5, 0.75, 0.0]

    feats = MultimodalFeatureExtractor.extract_facemesh_features(landmarks)
    assert len(feats) == 16
    assert all(isinstance(x, float) and np.isfinite(x) for x in feats)


def test_inference_engine_latency_under_150ms():
    engine = MultimodalInferenceEngine.get_instance()
    # Execute prediction
    res = engine.predict_rehabilitation(
        audio_features=[0.1] * 768,
        vision_features=[0.5] * 16,
        emg_features=[0.2] * 40,
        eeg_features=[0.3] * 25,
        target_phrase="வணக்கம்",
        recognized_transcript="வணக்கம்",
    )
    assert res["latency_ms"] < 150.0
    assert res["is_realtime_capable"] is True
    assert "mastery_percentage" in res
    assert "predicted_category" in res
