"""Real MediaPipe inference on a public-domain photograph and test-only blank pixels.

Camera dependencies are required for this software verification suite. A missing or
incompatible installation must fail, rather than silently skip camera coverage.
"""
import base64
import hashlib
from pathlib import Path

import numpy as np
import cv2
import pytest
from app.services.camera import track_frame


@pytest.mark.parametrize("encoded", [
    pytest.param("not-base64", id="invalid-base64"),
    pytest.param(base64.b64encode(b"not an image").decode(), id="invalid-image"),
    pytest.param("A" * 6_000_001, id="encoded-size-limit"),
])
def test_invalid_camera_input_rejected(encoded):
    with pytest.raises(ValueError):
        track_frame(encoded)


def test_synthetic_blank_frame_returns_no_face():
    ok, encoded = cv2.imencode(".png", np.zeros((128, 128, 3), dtype=np.uint8))
    assert ok
    result = track_frame(base64.b64encode(encoded).decode())
    assert result["status"] == "NO_FACE"
    assert result["landmarks"] is None
    assert result["features"] is None
    assert result["research_only"] is True


def test_real_face_frame_produces_landmarks_and_geometry_features():
    """Use the bundled NASA photo; no mocked detector or invented landmarks."""
    raw = (Path(__file__).parent / "fixtures" / "camera" / "astronaut.png").read_bytes()
    assert hashlib.sha256(raw).hexdigest() == "88431cd9653ccd539741b555fb0a46b61558b301d4110412b5bc28b5e3ea6cb5"

    result = track_frame(base64.b64encode(raw).decode())

    assert result["status"] == "TRACKED"
    points = np.asarray(result["landmarks"])
    assert points.shape == (468, 3)
    assert np.isfinite(points).all()
    eye_distance = np.linalg.norm(points[33, :2] - points[263, :2])
    assert eye_distance > 0
    features = result["features"]["face"]
    assert features["lip_aperture_ratio"] == pytest.approx(
        np.linalg.norm(points[13, :2] - points[14, :2]) / eye_distance
    )
    assert features["mouth_width_ratio"] == pytest.approx(
        np.linalg.norm(points[61, :2] - points[291, :2]) / eye_distance
    )
    assert result["tracker_version"]
    assert result["pipeline_version"]
    assert result["quality"]["state"] == "ACCEPTABLE"
    assert "Geometry validity only" in result["quality"]["limitations"]
    assert "confidence" not in result["quality"]
    assert result["research_only"] is True
