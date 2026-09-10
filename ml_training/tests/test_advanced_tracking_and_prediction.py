"""Unit and Integration Tests for 1€ Adaptive Filtering, Patient Baseline Calibration,
FACS Articulatory Action Unit Extractor, and Language Model-Rescored Beam Search.
"""
import time
import pytest
import numpy as np
import torch

from ml.pipelines.landmark_filter import OneEuroFilter, PatientBaselineCalibrator
from ml.pipelines.action_unit_extractor import ActionUnitExtractor
from ml.models.viseme_beam_search import CharacterNGramLanguageModel, VisemeBeamSearchDecoder
from ml.models.inference_engine import MultimodalInferenceEngine
from backend.app.services.clinical_rehab_service import ClinicalRehabService


def generate_synthetic_facemesh(
    lip_aperture: float = 0.3,
    mouth_width: float = 0.5,
    corner_height_delta: float = 0.0,
    jaw_drop: float = 0.0,
    chin_raise: float = 0.0,
    z_pucker: float = 0.0,
) -> np.ndarray:
    """Generates synthetic 468x3 MediaPipe FaceMesh landmarks with customizable articulatory geometry."""
    landmarks = np.zeros((468, 3), dtype=np.float64)

    # Eyes (anchors: 33 left, 263 right)
    landmarks[33] = [-0.25, 0.20, 0.0]
    landmarks[263] = [0.25, 0.20, 0.0]

    # Nose (tip 1, base 2, bridge 168)
    landmarks[1] = [0.0, 0.05, 0.08]
    landmarks[2] = [0.0, -0.05, 0.04]
    landmarks[168] = [0.0, 0.15, 0.02]

    # Chin (152) - modified by jaw_drop and chin_raise
    chin_y = -0.45 - jaw_drop + chin_raise
    landmarks[152] = [0.0, chin_y, 0.0]

    # Mouth corners (left 61, right 291)
    landmarks[61] = [-mouth_width / 2.0, -0.20 + (corner_height_delta / 2.0), 0.0]
    landmarks[291] = [mouth_width / 2.0, -0.20 - (corner_height_delta / 2.0), 0.0]

    # Inner lips (upper 13, lower 14)
    landmarks[13] = [0.0, -0.20 + (lip_aperture / 2.0), 0.02 + z_pucker]
    landmarks[14] = [0.0, -0.20 - (lip_aperture / 2.0), 0.02 + z_pucker]

    # Outer lips (top 0, bottom 17)
    landmarks[0] = [0.0, -0.15, 0.03 + z_pucker]
    landmarks[17] = [0.0, -0.27 - (lip_aperture / 3.0), 0.03 + z_pucker]

    return landmarks


def test_one_euro_filter_jitter_attenuation():
    """Verifies that 1€ filter heavily attenuates static jitter while tracking dynamic steps."""
    filt = OneEuroFilter(min_cutoff=1.0, beta=0.007, freq=30.0)

    # 1. Static signal with high-frequency noise
    n_frames = 60
    base_val = 0.5
    np.random.seed(42)
    noise = np.random.normal(0.0, 0.04, n_frames)
    noisy_signal = base_val + noise

    filtered = filt.filter_sequence(noisy_signal, fps=30.0)

    # Discard first 5 warm-up frames
    input_var = np.var(noisy_signal[5:])
    output_var = np.var(filtered[5:])

    # Filtering must reduce jitter variance by at least 60%
    assert output_var < input_var * 0.40, f"Expected >60% variance reduction, got {output_var} vs {input_var}"

    # 2. Step response: fast articulatory burst
    filt.reset()
    step_signal = np.array([0.1] * 20 + [0.8] * 20, dtype=np.float64)
    step_filtered = filt.filter_sequence(step_signal, fps=30.0)

    # Within 4 frames (133ms) after the step, the filter should rapidly climb past 0.50
    assert step_filtered[24] > 0.50, "1€ filter should adapt quickly to rapid velocity changes without severe lag"
    assert step_filtered[28] > 0.65, "1€ filter should converge towards the step target"


def test_patient_baseline_calibration_and_stroke_normalization():
    """Verifies resting face calibration and baseline-calibrated relative excursions."""
    calibrator = PatientBaselineCalibrator()

    # Generate 15 frames of resting face with unilateral resting droop (corner delta 0.04)
    resting_seq = [
        generate_synthetic_facemesh(lip_aperture=0.05, mouth_width=0.48, corner_height_delta=0.04)
        for _ in range(15)
    ]

    profile = calibrator.calibrate_resting_state(resting_seq)
    assert profile["num_calibration_frames"] == 15
    assert 0.04 <= profile["resting_aperture_mean"] <= 0.06
    assert 0.45 <= profile["resting_width_mean"] <= 0.52
    assert profile["hemiparetic_asymmetry_baseline"] > 0.02

    # Now simulate active speech: wide mouth opening (aperture 0.30)
    current_kinematics = {
        "lip_aperture": 0.30,
        "mouth_width": 0.52,
        "bilateral_symmetry": 0.85,
    }

    calibrated = calibrator.compute_calibrated_excursion(current_kinematics, profile=profile)
    # Active excursion should be ~ 0.25 (0.30 - 0.05)
    assert 0.23 <= calibrated["active_aperture_excursion"] <= 0.27
    assert calibrated["aperture_z_score"] > 5.0
    # Baseline-compensated symmetry should not penalize pre-existing stroke asymmetry
    assert calibrated["baseline_compensated_symmetry"] >= current_kinematics["bilateral_symmetry"]


def test_facs_action_unit_extractor():
    """Verifies that ActionUnitExtractor detects specific articulatory facial gestures."""
    # 1. Jaw Drop & Open Mouth Gesture
    open_mouth = generate_synthetic_facemesh(lip_aperture=0.40, jaw_drop=0.15)
    aus_open = ActionUnitExtractor.extract_action_units(open_mouth)
    assert aus_open["AU25_lips_part"] > 0.60
    assert aus_open["AU26_jaw_drop"] > 0.35

    # 2. Wide Smile / Spread Vowel Gesture
    smile = generate_synthetic_facemesh(lip_aperture=0.10, mouth_width=0.70, corner_height_delta=0.0)
    aus_smile = ActionUnitExtractor.extract_action_units(smile)
    assert aus_smile["AU12_lip_corner_puller"] > 0.25

    # 3. Pucker / Rounded Vowel Gesture
    pucker = generate_synthetic_facemesh(lip_aperture=0.08, mouth_width=0.35, z_pucker=0.08)
    aus_pucker = ActionUnitExtractor.extract_action_units(pucker)
    assert aus_pucker["AU18_lip_pucker"] > 0.30

    # 4. Sequence extraction with clinical cues
    seq = [open_mouth for _ in range(5)]
    seq_data = ActionUnitExtractor.extract_sequence(seq)
    assert "AU25_lips_part" in seq_data["peak_intensities"]
    assert "trajectories" in seq_data
    assert len(seq_data["dominant_actions"]) > 0


def test_character_ngram_language_model():
    """Verifies that CharacterNGramLanguageModel computes higher scores for known vocabulary."""
    lm = CharacterNGramLanguageModel()

    # Known words from drill vocabulary
    score_hello = lm.score_word("hello")
    score_water = lm.score_word("water")
    score_tamil = lm.score_word("வணக்கம்")

    # Gibberish word
    score_gibberish = lm.score_word("zxqkjv")

    assert score_hello > score_gibberish
    assert score_water > score_gibberish
    assert np.isfinite(score_tamil)
    assert np.isfinite(score_gibberish)


def test_viseme_beam_search_with_language_model():
    """Verifies beam search incorporates language model score in candidate ranking."""
    decoder = VisemeBeamSearchDecoder(beam_width=5, lm_weight=0.8)

    # Frame logits representing bilabial closure (/p, b, m/) followed by open vowel (/a/)
    # VisemeClass: 0 = BILABIAL, 4 = OPEN_VOWEL
    T = 10
    logits = np.zeros((T, 8), dtype=np.float32)
    logits[:5, 0] = 5.0  # Bilabial
    logits[5:, 4] = 5.0  # Open vowel

    result = decoder.decode_beam(logits, target_word="அப்பா")

    assert "best_word" in result
    assert "language_model_score" in result
    assert np.isfinite(result["language_model_score"])
    assert len(result["homophene_candidates"]) > 0
    assert "lm_score" in result["homophene_candidates"][0]


def test_end_to_end_inference_engine_with_filters_and_action_units():
    """Verifies end-to-end inference incorporates 1€ filter, FACS Action Units, and baseline calibration."""
    engine = MultimodalInferenceEngine.get_instance()

    landmarks_seq = [
        generate_synthetic_facemesh(lip_aperture=0.25, mouth_width=0.55).tolist()
        for _ in range(12)
    ]

    baseline = {
        "resting_aperture_mean": 0.05,
        "resting_aperture_std": 0.01,
        "resting_width_mean": 0.50,
        "resting_width_std": 0.02,
        "hemiparetic_asymmetry_baseline": 0.02,
    }

    pred = engine.predict_rehabilitation(
        landmarks_sequence=landmarks_seq,
        patient_baseline=baseline,
        target_phrase="hello",
        target_vowel_type="spread_vowel",
    )

    assert "kinematic_biomarkers" in pred
    kb = pred["kinematic_biomarkers"]
    assert "action_units" in kb
    assert "calibrated_excursion" in kb
    assert kb["calibrated_excursion"]["active_aperture_excursion"] > 0.15

    # Check beam search decoding has LM score
    assert "visual_word_decoding" in pred
    assert "language_model_score" in pred["visual_word_decoding"]

    # Latency constraint strictly under 150ms
    assert pred["latency_ms"] < 150.0, f"Latency {pred['latency_ms']}ms exceeded 150ms limit"


def test_clinical_rehab_service_feedback_incorporates_action_units():
    """Verifies that ClinicalRehabService merges Action Unit cues into patient biofeedback."""
    service = ClinicalRehabService()

    # Simulate sequence with elevated mentalis / chin strain
    landmarks_seq = [
        generate_synthetic_facemesh(lip_aperture=0.30, chin_raise=0.12).tolist()
        for _ in range(10)
    ]

    baseline = {
        "resting_aperture_mean": 0.05,
        "resting_aperture_std": 0.01,
        "resting_width_mean": 0.50,
        "resting_width_std": 0.02,
        "hemiparetic_asymmetry_baseline": 0.01,
    }

    eval_result = service.evaluate_attempt(
        target_phrase="வணக்கம்",
        recognized_transcript="வணக்கம்",
        landmarks_sequence=landmarks_seq,
        patient_baseline=baseline,
    )

    rehab = eval_result["rehab_summary"]
    assert "feedback_cues" in rehab
    assert "calibrated_excursion" in rehab
    assert eval_result["latency_ms"] < 150.0
