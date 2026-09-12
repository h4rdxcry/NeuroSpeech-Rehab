"""All measurements in this module are explicitly synthetic test fixtures."""
import numpy as np
import pytest
from app.services.signal_processing import process_biosignal, synchronize, prepare_fusion, facial_features


def test_synthetic_eeg_alpha_peak_and_unit_conversion():
    t = np.arange(512)/256
    x = (20*np.sin(2*np.pi*10*t))[:, None]
    a = process_biosignal(x, 256, "EEG", "uV", ["Cz"])
    b = process_biosignal(x/1e6, 256, "EEG", "V", ["Cz"])
    f = a["features"]["Cz"]
    assert f["alpha_power_uV2"] > 20*f["beta_power_uV2"]
    assert f["rms_uV"] == pytest.approx(b["features"]["Cz"]["rms_uV"])


def test_synthetic_emg_features():
    t = np.arange(4000)/2000
    x = (30*np.sin(2*np.pi*100*t))[:, None]
    result = process_biosignal(x, 2000, "EMG", "uV", ["masseter"])
    assert result["features"]["masseter"]["median_frequency_hz"] == pytest.approx(100, abs=2)


@pytest.mark.parametrize("x", [np.full((512, 1), np.nan), np.full((512, 1), np.inf)])
def test_nonfinite_rejected(x):
    with pytest.raises(ValueError):
        process_biosignal(x, 256, "EEG", "uV", ["Cz"])


def test_flatline_blocks_fusion():
    r = process_biosignal(np.zeros((512, 1)), 256, "EEG", "uV", ["Cz"])
    assert prepare_fusion({"EEG": r})["status"] == "SIGNAL_QUALITY_INSUFFICIENT"


def test_fusion_never_invents_prediction():
    r = {"quality": {"state": "ACCEPTABLE"}, "features": {"Cz": {"rms": 1.}}}
    result = prepare_fusion({"EEG": r})
    assert result["prediction"] is None
    assert result["status"] == "MODEL_UNAVAILABLE"


def test_synthetic_sync_and_different_clock_rejection():
    streams = [{"modality": "EEG", "clock_id": "synthetic-clock", "timestamps_seconds": [0, .01, .02]},
               {"modality": "EMG", "clock_id": "synthetic-clock", "timestamps_seconds": [.001, .011, .021]}]
    assert synchronize(streams)["status"] == "ALIGNED"
    streams[1]["clock_id"] = "other-clock"
    with pytest.raises(ValueError):
        synchronize(streams)


def test_degenerate_face_rejected():
    with pytest.raises(ValueError):
        facial_features(np.zeros((468, 3)))


def test_facial_features_jaw_metrics():
    landmarks = np.zeros((468, 3))
    # Eye landmarks 33 and 263 define scale
    landmarks[33] = [0.0, 0.0, 0.0]
    landmarks[263] = [2.0, 0.0, 0.0]  # scale = 2.0
    # Lip landmarks 13 and 14
    landmarks[13] = [1.0, 0.5, 0.0]
    landmarks[14] = [1.0, 0.7, 0.0]
    # Mouth corners 61 and 291
    landmarks[61] = [0.5, 0.6, 0.0]
    landmarks[291] = [1.5, 0.6, 0.0]
    # Subnasale 2 and Chin 152
    landmarks[2] = [1.0, 0.3, 0.0]
    landmarks[152] = [1.1, 1.3, 0.0]  # y drop = 1.0, x dev = 0.1

    res = facial_features(landmarks)
    face = res["features"]["face"]
    assert "jaw_depression_ratio" in face
    assert "jaw_lateral_deviation" in face
    assert face["jaw_lateral_deviation"] == pytest.approx(0.1 / 2.0)
    expected_jaw_dist = np.linalg.norm(landmarks[2, :2] - landmarks[152, :2]) / 2.0
    assert face["jaw_depression_ratio"] == pytest.approx(expected_jaw_dist)

