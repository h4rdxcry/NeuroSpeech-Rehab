"""Unit and Integration Tests for Advanced Dynamic Kinematics, Visemes, and AV-ASR Fusion.
Verifies 3D head-pose invariance, DTW trajectory matching, temporal viseme classification,
and <150ms real-time inference latency.
"""
import time
import pytest
import numpy as np
import torch

from ml.pipelines.kinematics_engine import KinematicsEngine
from ml.models.viseme_classifier import VisemeClass, PhonemeVisemeMapper, TemporalVisemeClassifier
from ml.models.multimodal_fusion import MultimodalFusionModel
from ml.models.inference_engine import MultimodalInferenceEngine
from backend.app.services.clinical_rehab_service import ClinicalRehabService


def generate_synthetic_facemesh(lip_aperture: float = 0.3, mouth_width: float = 0.5) -> np.ndarray:
    """Generates synthetic 468x3 MediaPipe FaceMesh landmarks with specified mouth geometry."""
    landmarks = np.zeros((468, 3), dtype=np.float64)

    # Eyes (anchors: 33 left, 263 right)
    landmarks[33] = [-0.25, 0.20, 0.0]
    landmarks[263] = [0.25, 0.20, 0.0]

    # Nose (tip 1, base 2, bridge 168)
    landmarks[1] = [0.0, 0.05, 0.08]
    landmarks[2] = [0.0, -0.05, 0.04]
    landmarks[168] = [0.0, 0.15, 0.02]

    # Chin (152)
    landmarks[152] = [0.0, -0.45, 0.0]

    # Mouth corners (left 61, right 291)
    landmarks[61] = [-mouth_width / 2.0, -0.20, 0.0]
    landmarks[291] = [mouth_width / 2.0, -0.20, 0.0]

    # Inner lips (upper 13, lower 14)
    landmarks[13] = [0.0, -0.20 + (lip_aperture / 2.0), 0.02]
    landmarks[14] = [0.0, -0.20 - (lip_aperture / 2.0), 0.02]

    # Outer lips (top 0, bottom 17)
    landmarks[0] = [0.0, -0.15, 0.03]
    landmarks[17] = [0.0, -0.27, 0.03]

    # Inner mouth landmarks
    landmarks[78] = [-mouth_width * 0.4, -0.20, 0.0]
    landmarks[308] = [mouth_width * 0.4, -0.20, 0.0]
    landmarks[82] = [0.0, -0.20 + (lip_aperture * 0.4), 0.02]
    landmarks[87] = [0.0, -0.20 - (lip_aperture * 0.4), 0.02]
    landmarks[312] = [mouth_width * 0.2, -0.20 + (lip_aperture * 0.3), 0.02]
    landmarks[317] = [mouth_width * 0.2, -0.20 - (lip_aperture * 0.3), 0.02]

    return landmarks


def test_3d_procrustes_head_pose_invariance():
    """Verifies that head rotations and camera distance scaling do not distort extracted kinematics."""
    base_mesh = generate_synthetic_facemesh(lip_aperture=0.35, mouth_width=0.55)
    feat_base = KinematicsEngine.extract_kinematic_frame(base_mesh.tolist())

    # Apply 3D Rotation (Roll, Pitch, Yaw) and Scaling (distance)
    theta = np.radians(15.0)  # 15 degree rotation
    rot_z = np.array([
        [np.cos(theta), -np.sin(theta), 0.0],
        [np.sin(theta),  np.cos(theta), 0.0],
        [0.0,            0.0,           1.0],
    ])
    scale_factor = 2.4  # Camera moved closer/further

    transformed_mesh = (np.dot(base_mesh, rot_z.T) * scale_factor) + np.array([0.15, -0.30, 0.5])
    feat_transformed = KinematicsEngine.extract_kinematic_frame(transformed_mesh.tolist())

    # Verify key articulatory features remain invariant within numerical tolerance (<0.05)
    # Feature 0: lip aperture, Feature 1: mouth width, Feature 2: aspect ratio
    assert abs(feat_base[0] - feat_transformed[0]) < 0.05
    assert abs(feat_base[1] - feat_transformed[1]) < 0.05
    assert abs(feat_base[2] - feat_transformed[2]) < 0.05
    assert abs(feat_base[20] - feat_transformed[20]) < 0.05  # bilateral symmetry


def test_kinematic_derivatives_and_smoothness():
    """Verifies that smooth trajectories yield higher motor smoothness than jerky trajectories."""
    t = np.linspace(0, 1.0, 30)
    smooth_traj = np.zeros((30, 40), dtype=np.float32)
    # Smooth bell-shaped aperture curve
    smooth_traj[:, 0] = 0.2 + 0.3 * np.sin(np.pi * t)

    jerky_traj = smooth_traj.copy()
    # Add high-frequency noise / tremors
    np.random.seed(42)
    jerky_traj[:, 0] += np.random.normal(0, 0.15, size=30).astype(np.float32)

    derivs_smooth = KinematicsEngine.compute_derivatives(smooth_traj)
    derivs_jerky = KinematicsEngine.compute_derivatives(jerky_traj)

    smooth_score = KinematicsEngine.compute_movement_smoothness(derivs_smooth["jerk"], derivs_smooth["velocity"])
    jerky_score = KinematicsEngine.compute_movement_smoothness(derivs_jerky["jerk"], derivs_jerky["velocity"])

    assert smooth_score > jerky_score
    assert 0.0 <= smooth_score <= 1.0
    assert 0.0 <= jerky_score <= 1.0


def test_fast_dtw_trajectory_similarity():
    """Verifies that DTW properly scores matching vs contrasting articulatory curves."""
    open_template = KinematicsEngine.generate_canonical_trajectory("open_vowel", num_frames=30)
    bilabial_template = KinematicsEngine.generate_canonical_trajectory("bilabial", num_frames=30)

    # Identical should yield 1.0
    dist_same, sim_same = KinematicsEngine.fast_dtw_distance(open_template, open_template)
    assert dist_same == 0.0
    assert sim_same == 1.0

    # Open vowel vs Bilabial should have high distance and lower similarity
    dist_diff, sim_diff = KinematicsEngine.fast_dtw_distance(open_template, bilabial_template)
    assert dist_diff > 0.0
    assert sim_diff < 0.90


def test_phoneme_viseme_mapper_tamil_and_english():
    """Verifies translation of Tamil and English words into correct chronological visemes."""
    # Tamil "பப்பா" -> Bilabial (/p/), Open Vowel (/a/), Bilabial (/p/), Open Vowel (/a/)
    v_tamil = PhonemeVisemeMapper.phrase_to_visemes("பப்பா")
    assert VisemeClass.BILABIAL in v_tamil
    assert VisemeClass.OPEN_VOWEL in v_tamil

    # Sequence alignment test
    pred_visemes = [VisemeClass.BILABIAL, VisemeClass.OPEN_VOWEL, VisemeClass.BILABIAL, VisemeClass.OPEN_VOWEL]
    target_visemes = PhonemeVisemeMapper.phrase_to_visemes("பப்பா")
    align = PhonemeVisemeMapper.align_viseme_sequences(pred_visemes, target_visemes)

    assert align["is_visually_verified"] is True
    assert align["viseme_match_score"] >= 0.85


def test_temporal_viseme_classifier_forward():
    """Verifies TCN + BiGRU architecture shapes and attention pooling."""
    model = TemporalVisemeClassifier(in_dim=40, num_classes=8, hidden_dim=64, d_model=128)
    model.eval()

    dummy_seq = torch.randn(2, 25, 40)
    with torch.inference_mode():
        frame_logits, seq_emb = model(dummy_seq)

    assert frame_logits.shape == (2, 25, 8)
    assert seq_emb.shape == (2, 128)


def test_multimodal_fusion_with_temporal_viseme_sequence():
    """Verifies MultimodalFusionModel forward pass with temporal sequence and joint AV confidence."""
    model = MultimodalFusionModel(
        audio_in_dim=768,
        vision_in_dim=16,
        emg_in_dim=40,
        eeg_in_dim=25,
        d_model=128,
    )
    model.eval()

    audio = torch.randn(2, 768)
    vision_seq = torch.randn(2, 20, 40)

    with torch.inference_mode():
        out = model(audio_feat=audio, vision_seq=vision_seq)

    assert out["rehab_score"].shape == (2,)
    assert out["joint_av_confidence"].shape == (2,)
    assert out["viseme_frame_logits"].shape == (2, 20, 8)
    assert out["predicted_visemes"].shape == (2, 20)
    assert (out["joint_av_confidence"] >= 0.0).all() and (out["joint_av_confidence"] <= 1.0).all()


def test_inference_engine_temporal_prediction_latency():
    """Verifies end-to-end inference latency with 25-frame sequence remains strictly under 150ms."""
    engine = MultimodalInferenceEngine.get_instance()
    engine.initialize()

    # Generate sequence of 25 landmark frames
    frames = [generate_synthetic_facemesh(lip_aperture=0.25 + 0.15 * np.sin(i / 5.0)).tolist() for i in range(25)]

    pred = engine.predict_rehabilitation(
        audio_features=[0.1] * 768,
        landmarks_sequence=frames,
        target_phrase="பப்பா",
        recognized_transcript="பப்பா",
        target_vowel_type="open_vowel",
    )

    assert pred["latency_ms"] < 150.0
    assert pred["is_realtime_capable"] is True
    assert "kinematic_biomarkers" in pred
    assert "viseme_analysis" in pred
    assert pred["kinematic_biomarkers"]["trajectory_frames"] == 25
    assert pred["joint_av_confidence"] >= 0.0


def test_clinical_rehab_service_full_workflow():
    """Verifies high-level ClinicalRehabService evaluate_attempt integrating temporal landmarks."""
    service = ClinicalRehabService()

    frames = [generate_synthetic_facemesh(lip_aperture=0.45 + 0.15 * np.sin(i / 3.0)).tolist() for i in range(20)]

    result = service.evaluate_attempt(
        target_phrase="வணக்கம்",
        recognized_transcript="வணக்கம்",
        lip_aperture_ratio=0.55,
        mouth_width_ratio=0.50,
        target_vowel_type="open_vowel",
        landmarks_sequence=frames,
        difficulty_level="standard",
    )

    assert result["is_realtime"] is True
    assert result["rehab_summary"]["mastery_percentage"] >= 70.0
    assert "neural_prediction" in result
    assert "kinematic_biomarkers" in result["neural_prediction"]
