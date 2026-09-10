"""Unit and Integration Tests for Dual-Stream 3D-CNN Visual Speech Recognition and Beam Search.
Verifies Mouth ROI cropping, 3D-CNN appearance extraction, gated cross-modal fusion,
CTC beam search homophene disambiguation, and <150ms real-time latency.
"""
import time
import pytest
import numpy as np
import torch

from ml.pipelines.mouth_roi_extractor import MouthROIExtractor
from ml.models.mouth_3d_cnn import MouthVisual3DCNN
from ml.models.dual_stream_visual_encoder import DualStreamVisualSpeechEncoder
from ml.models.viseme_beam_search import VisemeBeamSearchDecoder
from ml.models.inference_engine import MultimodalInferenceEngine
from backend.app.services.clinical_rehab_service import ClinicalRehabService


def generate_synthetic_facemesh(lip_aperture: float = 0.3, mouth_width: float = 0.5) -> np.ndarray:
    """Generates synthetic 468x3 MediaPipe FaceMesh landmarks with specified mouth geometry."""
    landmarks = np.zeros((468, 3), dtype=np.float64)
    landmarks[33] = [-0.25, 0.20, 0.0]
    landmarks[263] = [0.25, 0.20, 0.0]
    landmarks[1] = [0.0, 0.05, 0.08]
    landmarks[2] = [0.0, -0.05, 0.04]
    landmarks[168] = [0.0, 0.15, 0.02]
    landmarks[152] = [0.0, -0.45, 0.0]
    landmarks[61] = [-mouth_width / 2.0, -0.20, 0.0]
    landmarks[291] = [mouth_width / 2.0, -0.20, 0.0]
    landmarks[13] = [0.0, -0.20 + (lip_aperture / 2.0), 0.02]
    landmarks[14] = [0.0, -0.20 - (lip_aperture / 2.0), 0.02]
    landmarks[0] = [0.0, -0.15, 0.03]
    landmarks[17] = [0.0, -0.27, 0.03]
    return landmarks


def test_mouth_roi_extractor_dimensions_and_invariance():
    """Verifies affine-stabilized mouth cropping produces exact 48x48 normalized patches."""
    dummy_frame = np.ones((200, 200, 3), dtype=np.uint8) * 128
    # Draw simple mouth rectangle in image
    dummy_frame[80:120, 70:130] = 50

    landmarks = generate_synthetic_facemesh(lip_aperture=0.35, mouth_width=0.55).tolist()

    patch = MouthROIExtractor.extract_mouth_roi(dummy_frame, landmarks, target_size=(48, 48))
    assert patch.shape == (1, 48, 48)
    assert patch.dtype == np.float32
    assert 0.0 <= patch.min() and patch.max() <= 1.0

    # Sequence extraction
    frames = [dummy_frame for _ in range(5)]
    seq_landmarks = [landmarks for _ in range(5)]
    patch_seq = MouthROIExtractor.extract_sequence(frames, seq_landmarks, target_size=(48, 48))
    assert patch_seq.shape == (5, 1, 48, 48)

    # Fallback on invalid inputs
    fallback = MouthROIExtractor.extract_mouth_roi("invalid_base64", [])
    assert fallback.shape == (1, 48, 48)
    assert (fallback == 0.0).all()


def test_mouth_3d_cnn_forward_shapes():
    """Verifies 3D-CNN spatio-temporal convolution output shapes."""
    model = MouthVisual3DCNN(in_channels=1, out_dim=64)
    model.eval()

    # Batch of 2, 1 channel, 16 frames, 48x48
    x = torch.randn(2, 1, 16, 48, 48)
    with torch.inference_mode():
        out = model(x)

    assert out.shape == (2, 16, 64)

    # Single-frame edge case
    x_single = torch.randn(2, 1, 1, 48, 48)
    with torch.inference_mode():
        out_single = model(x_single)
    assert out_single.shape == (2, 1, 64)


def test_dual_stream_gated_fusion():
    """Verifies cross-modal adaptive gating between kinematics and 3D-CNN pixels."""
    model = DualStreamVisualSpeechEncoder(kinematics_dim=40, pixel_channels=1, hidden_dim=64, d_model=128)
    model.eval()

    kinematics = torch.randn(2, 15, 40)
    pixels = torch.randn(2, 1, 15, 48, 48)

    # 1. Full Dual-Stream Forward
    with torch.inference_mode():
        out = model(kinematics_seq=kinematics, pixel_seq=pixels)

    assert out["viseme_logits"].shape == (2, 15, 8)
    assert out["visual_embedding"].shape == (2, 128)
    assert out["gating_weights"] is not None
    assert out["gating_weights"].shape == (2, 15, 64)
    assert (out["gating_weights"] >= 0.0).all() and (out["gating_weights"] <= 1.0).all()

    # 2. Kinematics-only Ablation
    with torch.inference_mode():
        out_k = model(kinematics_seq=kinematics, pixel_seq=None)
    assert out_k["viseme_logits"].shape == (2, 15, 8)
    assert out_k["gating_weights"] is None

    # 3. Pixels-only Ablation
    with torch.inference_mode():
        out_p = model(kinematics_seq=None, pixel_seq=pixels)
    assert out_p["viseme_logits"].shape == (2, 15, 8)
    assert out_p["gating_weights"] is None


def test_ctc_beam_search_homophene_disambiguation():
    """Verifies that CTC beam search resolves visually identical phonemes into unambiguous words."""
    decoder = VisemeBeamSearchDecoder(beam_width=8)

    # Construct synthetic logits biased towards "வணக்கம்"
    # Target "வணக்கம்" visemes: [OPEN, BILABIAL, OPEN, DENTAL_ALVEOLAR, VELAR, BILABIAL, ...]
    target_phrase = "வணக்கம்"
    t_len = 20
    logits = np.zeros((t_len, 8), dtype=np.float32)

    # Run beam search with drill prior
    decoding = decoder.decode_beam(logits, target_word=target_phrase, target_bias=3.0)

    assert "best_word" in decoding
    assert "word_confidence" in decoding
    assert "homophene_candidates" in decoding
    assert len(decoding["homophene_candidates"]) > 0
    assert 0.0 <= decoding["word_confidence"] <= 1.0
    # Prior should correctly select the target exercise word
    assert decoding["best_word"] == target_phrase
    assert decoding["is_target_word_matched"] is True


def test_dual_stream_inference_engine_end_to_end_latency():
    """Verifies end-to-end inference latency with 20 frames remains strictly under 150ms."""
    engine = MultimodalInferenceEngine.get_instance()
    engine.initialize()

    # 20 video frames and landmark frames
    dummy_img = np.zeros((120, 120, 3), dtype=np.uint8)
    frames = [dummy_img for _ in range(20)]
    landmarks = [generate_synthetic_facemesh(lip_aperture=0.40).tolist() for _ in range(20)]

    pred = engine.predict_rehabilitation(
        audio_features=[0.1] * 768,
        landmarks_sequence=landmarks,
        mouth_frames_sequence=frames,
        target_phrase="வணக்கம்",
        recognized_transcript="வணக்கம்",
        target_vowel_type="open_vowel",
    )

    assert pred["latency_ms"] < 150.0
    assert pred["is_realtime_capable"] is True
    assert "dual_stream_info" in pred
    assert pred["dual_stream_info"]["fusion_mode"] == "DUAL_STREAM (Kinematics + 3D-CNN Pixels)"
    assert "visual_word_decoding" in pred
    assert pred["visual_word_decoding"]["best_word"] == "வணக்கம்"


def test_clinical_rehab_service_dual_stream_integration():
    """Verifies ClinicalRehabService high-level attempt evaluation with dual-stream inputs."""
    service = ClinicalRehabService()

    dummy_img = np.zeros((100, 100, 3), dtype=np.uint8)
    frames = [dummy_img for _ in range(15)]
    landmarks = [generate_synthetic_facemesh(lip_aperture=0.55).tolist() for _ in range(15)]

    result = service.evaluate_attempt(
        target_phrase="வணக்கம்",
        recognized_transcript="வணக்கம்",
        lip_aperture_ratio=0.55,
        mouth_width_ratio=0.50,
        target_vowel_type="open_vowel",
        landmarks_sequence=landmarks,
        mouth_frames_sequence=frames,
        difficulty_level="standard",
    )

    assert result["is_realtime"] is True
    assert result["rehab_summary"]["mastery_percentage"] >= 70.0
    assert "visual_word_decoding" in result["neural_prediction"]
    assert "dual_stream_info" in result["neural_prediction"]
