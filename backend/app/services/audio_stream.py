import struct
import asyncio
import math
import time
from typing import Optional, Dict, Any, Tuple
from collections import deque
from dataclasses import dataclass, field
import numpy as np

from app.services.audio_protocol import (
    MAX_STREAM_BUFFER_BYTES,
    StreamStartMessage,
    StreamStopMessage,
    validate_pcm_chunk,
    pcm16le_to_float32,
    ServerMessageType,
    StreamStatus,
    StatusMessage,
    ErrorMessage,
    StreamStoppedMessage,
    StreamStartedMessage,
)


@dataclass
class StreamSession:
    session_id: str
    attempt_id: str
    modality: str
    sample_rate: int
    channels: int
    sample_width_bytes: int
    encoding: str

    recording_id: str = ""
    websocket: Any = None
    started_at: float = field(default_factory=time.time)

    _buffer: bytearray = field(default_factory=bytearray)
    _speech_detected: bool = False
    _segment_start: int = 0
    _closed: bool = False
    _error: Optional[str] = None
    _frames_since_last_speech: int = 0
    _max_silence_frames: int = 0
    _vad_rms_threshold: float = 0.0
    _min_speech_duration_samples: int = 0
    _rms_history: deque = field(default_factory=lambda: deque(maxlen=100))

    def append(self, data: bytes) -> Tuple[bool, Optional[str]]:
        if self._closed:
            return False, "Stream already stopped"
        new_size = len(self._buffer) + len(data)
        if new_size > MAX_STREAM_BUFFER_BYTES:
            self._closed = True
            self._error = (
                f"Buffer overflow: stream buffer exceeded {MAX_STREAM_BUFFER_BYTES} bytes. "
                f"Connection closed to prevent unbounded memory growth."
            )
            return False, self._error
        self._buffer.extend(data)
        return True, None

    def mark_speech(self) -> None:
        self._speech_detected = True
        self._frames_since_last_speech = 0

    def mark_silence(self) -> None:
        self._frames_since_last_speech += 1

    def is_speech_complete(self) -> bool:
        return self._speech_detected and self._frames_since_last_speech >= self._max_silence_frames

    def get_segment(self) -> Optional[bytes]:
        if not self._speech_detected:
            return None
        start = self._segment_start
        if start >= len(self._buffer):
            return None
        segment = bytes(self._buffer[start:])
        return segment

    def reset_segment(self) -> None:
        self._speech_detected = False
        self._frames_since_last_speech = 0
        self._segment_start = len(self._buffer)

    def close(self) -> None:
        self._closed = True

    @property
    def buffer_size(self) -> int:
        return len(self._buffer)

    @property
    def is_closed(self) -> bool:
        return self._closed

    @property
    def error(self) -> Optional[str]:
        return self._error


class SignalQualityResult:
    def __init__(self, state: str, reason: Optional[str] = None, details: Optional[Dict[str, Any]] = None):
        self.state = state
        self.reason = reason
        self.details = details or {}

    def is_usable(self) -> bool:
        return self.state in ("GOOD", "ACCEPTABLE")


def compute_rms(samples: np.ndarray) -> float:
    if len(samples) == 0:
        return 0.0
    return float(np.sqrt(np.mean(samples.astype(np.float64) ** 2)))


def check_signal_quality(
    pcm_data: bytes,
    sample_rate: int,
    channels: int,
    sample_width_bytes: int,
) -> SignalQualityResult:
    if len(pcm_data) == 0:
        return SignalQualityResult("UNUSABLE", "Empty audio data")

    if channels > 1:
        samples = np.frombuffer(pcm_data, dtype="<i2").astype(np.float32)
        samples = samples.reshape(-1, channels)
        samples = samples.mean(axis=1)
    else:
        samples = np.frombuffer(pcm_data, dtype="<i2").astype(np.float32)

    duration_sec = len(samples) / float(sample_rate)
    if duration_sec < 0.2:
        return SignalQualityResult("UNUSABLE", f"Segment too short: {duration_sec:.2f}s < 0.2s minimum")

    rms = compute_rms(samples)
    max_val = float(np.max(np.abs(samples))) if len(samples) > 0 else 0.0

    if rms / 32768.0 < 0.005:
        return SignalQualityResult("UNUSABLE", f"RMS {rms:.6f} below silence threshold; likely no speech")

    clipping_threshold = 32767 * 0.98
    clipped = np.sum(np.abs(samples) > clipping_threshold)
    clip_ratio = float(clipped) / float(len(samples))

    if clip_ratio > 0.05:
        return SignalQualityResult("UNUSABLE", f"Clipping ratio {clip_ratio:.2%} exceeds 5% threshold")

    max_peak = max_val / 32768.0
    if rms > 0.7 * max_val:
        dynamic_range = max_val / rms if rms > 0 else 0
        if dynamic_range < 1.3:
            return SignalQualityResult("UNUSABLE", f"Dynamic range {dynamic_range:.1f} too low; signal likely distorted")

    details = {
        "rms": round(rms / 32768.0, 6),
        "peak_normalized": round(max_peak, 4),
        "clipping_ratio": round(clip_ratio, 4),
        "duration_seconds": round(duration_sec, 3),
        "sample_count": int(len(samples)),
        "sample_rate": int(sample_rate),
    }

    return SignalQualityResult("GOOD", details=details)


class SimpleVAD:
    def __init__(
        self,
        sample_rate: int,
        frame_ms: int = 30,
        rms_threshold: Optional[float] = None,
        min_speech_ms: int = 250,
        max_silence_ms: int = 500,
    ):
        self.sample_rate = sample_rate
        self.frame_samples = int(sample_rate * frame_ms / 1000)
        self.rms_threshold = rms_threshold if rms_threshold is not None else 0.01
        self.min_speech_samples = int(sample_rate * min_speech_ms / 1000)
        self.max_silence_samples = int(sample_rate * max_silence_ms / 1000)
        self._speech_frame_count: int = 0
        self._silence_frame_count: int = 0
        self._in_speech: bool = False

    def process(self, float_samples: np.ndarray) -> Tuple[bool, Optional[str]]:
        if len(float_samples) == 0:
            return False, None

        num_frames = math.ceil(len(float_samples) / self.frame_samples)
        speech_detected = False
        reason: Optional[str] = None

        for i in range(num_frames):
            start = i * self.frame_samples
            end = min(start + self.frame_samples, len(float_samples))
            frame = float_samples[start:end]
            rms = compute_rms(frame)

            if rms > self.rms_threshold:
                self._speech_frame_count += len(frame)
                self._silence_frame_count = 0
                if self._speech_frame_count >= self.min_speech_samples:
                    self._in_speech = True
                    speech_detected = True
            else:
                self._silence_frame_count += len(frame)
                if self._in_speech and self._silence_frame_count >= self.max_silence_samples:
                    self._in_speech = False
                    self._speech_frame_count = 0

        if self._speech_frame_count == 0 and not self._in_speech:
            reason = "No speech frames above RMS threshold"

        return speech_detected, reason
