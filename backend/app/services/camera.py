"""Optional real MediaPipe frame inference; fails explicitly when unavailable."""
import base64
import binascii
from app.services.signal_processing import facial_features


class TrackerUnavailable(RuntimeError):
    pass


def track_frame(encoded):
    if len(encoded) > 6_000_000:
        raise ValueError("Encoded frame exceeds limit")
    try:
        raw = base64.b64decode(encoded, validate=True)
    except (ValueError, binascii.Error) as exc:
        raise ValueError("Invalid base64 frame") from exc
    try:
        import cv2
        import mediapipe as mp
        import numpy as np
    except ImportError as exc:
        raise TrackerUnavailable("Install the pinned OpenCV and MediaPipe dependencies") from exc
    if not hasattr(mp, "solutions"):
        raise TrackerUnavailable("This adapter requires the pinned MediaPipe solutions API")
    frame = cv2.imdecode(np.frombuffer(raw, dtype=np.uint8), cv2.IMREAD_COLOR)
    if frame is None or frame.shape[0] * frame.shape[1] > 1920 * 1080:
        raise ValueError("Invalid frame or resolution above 1920x1080 pixel count")
    with mp.solutions.face_mesh.FaceMesh(static_image_mode=True, max_num_faces=1, refine_landmarks=False) as tracker:
        result = tracker.process(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
    if not result.multi_face_landmarks:
        return {"status": "NO_FACE", "landmarks": None, "features": None, "research_only": True}
    landmarks = [[p.x, p.y, p.z] for p in result.multi_face_landmarks[0].landmark]
    return {"status": "TRACKED", "landmarks": landmarks, "tracker_version": mp.__version__, **facial_features(landmarks)}
