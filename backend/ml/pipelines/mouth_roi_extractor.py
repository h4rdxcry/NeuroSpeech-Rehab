"""Mouth Region of Interest (ROI) Video Extractor.
Performs affine-stabilized cropping of 48x48 grayscale mouth patches from raw video frames
using MediaPipe FaceMesh landmarks for pixel-level visual speech recognition.
"""
from typing import List, Optional, Tuple, Union
import base64
import binascii
import cv2
import numpy as np


class MouthROIExtractor:
    """Extracts and normalizes mouth video patches for 3D-CNN visual speech recognition."""

    # Key landmark indices
    LEFT_CORNER = 61
    RIGHT_CORNER = 291
    UPPER_LIP_TOP = 0
    LOWER_LIP_BOTTOM = 17
    UPPER_INNER = 13
    LOWER_INNER = 14

    DEFAULT_SIZE = (48, 48)

    @classmethod
    def decode_frame(cls, frame_data: Union[np.ndarray, str, bytes]) -> Optional[np.ndarray]:
        """Decodes raw numpy, bytes, or base64 image into RGB/BGR numpy array."""
        if isinstance(frame_data, np.ndarray):
            return frame_data

        raw_bytes = None
        if isinstance(frame_data, str):
            try:
                # Strip potential data URL prefix
                if "," in frame_data:
                    frame_data = frame_data.split(",", 1)[1]
                raw_bytes = base64.b64decode(frame_data, validate=True)
            except (ValueError, binascii.Error):
                return None
        elif isinstance(frame_data, bytes):
            raw_bytes = frame_data

        if raw_bytes is None:
            return None

        img = cv2.imdecode(np.frombuffer(raw_bytes, dtype=np.uint8), cv2.IMREAD_COLOR)
        return img

    @classmethod
    def extract_mouth_roi(
        cls,
        frame: Union[np.ndarray, str, bytes],
        landmarks: List[List[float]],
        target_size: Tuple[int, int] = DEFAULT_SIZE,
    ) -> np.ndarray:
        """Extracts an affine-stabilized, normalized grayscale mouth ROI patch.
        
        Args:
            frame: (H, W, 3) image or base64 string.
            landmarks: 468x3 normalized landmarks where x, y in [0, 1].
            target_size: (width, height) output dimensions (default 48x48).
        Returns:
            (1, H, W) float32 numpy array with values in [0.0, 1.0].
        """
        out_w, out_h = target_size
        fallback = np.zeros((1, out_h, out_w), dtype=np.float32)

        img = cls.decode_frame(frame)
        if img is None:
            return fallback

        p = np.asarray(landmarks, dtype=np.float64)
        if p.ndim != 2 or p.shape[0] < 468 or p.shape[1] < 2:
            return fallback

        h_img, w_img = img.shape[:2]

        # Convert normalized coordinates [0, 1] to image pixel coordinates
        left_corner = np.array([p[cls.LEFT_CORNER, 0] * w_img, p[cls.LEFT_CORNER, 1] * h_img])
        right_corner = np.array([p[cls.RIGHT_CORNER, 0] * w_img, p[cls.RIGHT_CORNER, 1] * h_img])
        mouth_center = (left_corner + right_corner) / 2.0

        # Mouth width and angle
        delta = right_corner - left_corner
        mouth_width = np.linalg.norm(delta)
        angle_rad = np.arctan2(delta[1], delta[0])
        angle_deg = float(np.degrees(angle_rad))

        # Crop box width with padding (1.8x mouth width to capture full oral dynamics)
        crop_size = max(float(mouth_width * 1.8), 24.0)
        scale = float(out_w) / crop_size

        # Affine rotation & scaling matrix centered at mouth
        rot_mat = cv2.getRotationMatrix2D(tuple(mouth_center), angle_deg, scale)
        # Shift mouth center to center of output patch (out_w / 2, out_h / 2)
        rot_mat[0, 2] += (out_w / 2.0) - mouth_center[0]
        rot_mat[1, 2] += (out_h / 2.0) - mouth_center[1]

        # Warp image
        warped = cv2.warpAffine(img, rot_mat, (out_w, out_h), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)

        # Convert to grayscale if necessary
        if warped.ndim == 3 and warped.shape[2] == 3:
            gray = cv2.cvtColor(warped, cv2.COLOR_BGR2GRAY)
        elif warped.ndim == 3 and warped.shape[2] == 1:
            gray = warped.squeeze(-1)
        else:
            gray = warped

        # Contrast normalization (min-max scaling with clipping)
        gray_f = gray.astype(np.float32)
        p_min, p_max = np.percentile(gray_f, 2), np.percentile(gray_f, 98)
        if p_max > p_min + 1e-4:
            gray_f = np.clip((gray_f - p_min) / (p_max - p_min), 0.0, 1.0)
        else:
            gray_f = gray_f / 255.0

        # Output shape: (1, H, W)
        return gray_f[np.newaxis, :, :]

    @classmethod
    def extract_sequence(
        cls,
        frames: List[Union[np.ndarray, str, bytes]],
        landmark_sequence: List[List[List[float]]],
        target_size: Tuple[int, int] = DEFAULT_SIZE,
    ) -> np.ndarray:
        """Extracts sequence of mouth ROI patches.
        
        Returns:
            (T, 1, H, W) float32 numpy array.
        """
        n_frames = min(len(frames), len(landmark_sequence))
        if n_frames == 0:
            out_w, out_h = target_size
            return np.zeros((0, 1, out_h, out_w), dtype=np.float32)

        rois = [
            cls.extract_mouth_roi(frames[i], landmark_sequence[i], target_size=target_size)
            for i in range(n_frames)
        ]
        return np.stack(rois, axis=0)  # (T, 1, H, W)
