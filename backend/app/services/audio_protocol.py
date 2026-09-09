import struct
from enum import Enum
from typing import Optional, Dict, Any
from pydantic import BaseModel, Field, field_validator, AliasChoices


class MessageType(str, Enum):
    STREAM_START = "stream_start"
    AUDIO_CHUNK = "audio_chunk"
    STREAM_STOP = "stream_stop"


class ServerMessageType(str, Enum):
    STATUS = "status"
    ERROR = "error"
    PREDICTION = "prediction"
    STREAM_STOPPED = "stream_stopped"
    STREAM_STARTED = "stream_started"


class StreamStatus(str, Enum):
    STREAMING = "streaming"
    PROCESSING = "processing"
    COMPLETED = "completed"
    REJECTED = "rejected"
    ERROR = "error"


class AudioEncoding(str, Enum):
    PCM16 = "pcm16"
    PCM32 = "pcm32"


VALID_SAMPLE_RATES = [16000]
MAX_CHUNK_BYTES = 256 * 1024
MAX_STREAM_BUFFER_BYTES = 16000 * 2 * 60  # 60 seconds of supported mono PCM16.


class StreamStartMessage(BaseModel):
    type: MessageType = MessageType.STREAM_START
    session_id: str = Field(..., min_length=1)
    attempt_id: str = Field(..., min_length=1)
    modality: str = Field(default="AUDIO", pattern="^AUDIO$")
    sample_rate: int
    channels: int = Field(..., ge=1, le=1)
    sample_width_bytes: int = Field(..., ge=2, le=2, validation_alias=AliasChoices("sample_width_bytes", "sample_width"))
    encoding: AudioEncoding = AudioEncoding.PCM16

    @field_validator("encoding")
    @classmethod
    def validate_encoding(cls, v):
        if v != AudioEncoding.PCM16:
            raise ValueError("Only PCM16 little-endian audio is supported")
        return v

    @field_validator("session_id", "attempt_id")
    @classmethod
    def validate_uuid(cls, v):
        from uuid import UUID
        return str(UUID(v))

    @field_validator("sample_rate")
    @classmethod
    def validate_sample_rate(cls, v: int) -> int:
        if v not in VALID_SAMPLE_RATES:
            raise ValueError(f"sample_rate must be one of {VALID_SAMPLE_RATES}, got {v}")
        return v


class StreamStopMessage(BaseModel):
    type: MessageType = MessageType.STREAM_STOP


class StatusMessage(BaseModel):
    type: ServerMessageType = ServerMessageType.STATUS
    status: StreamStatus
    message: str = ""
    recording_id: Optional[str] = None
    details: Optional[Dict[str, Any]] = None


class ErrorMessage(BaseModel):
    type: ServerMessageType = ServerMessageType.ERROR
    message: str
    code: Optional[str] = None


class PredictionMessage(BaseModel):
    type: ServerMessageType = ServerMessageType.PREDICTION
    prediction_id: str
    attempt_id: str
    recording_id: str
    predicted_label: str
    model_name: str
    model_version: str
    model_scope: str
    notes: str
    prediction_json: Dict[str, Any]
    signal_quality_state: str


class StreamStoppedMessage(BaseModel):
    type: ServerMessageType = ServerMessageType.STREAM_STOPPED
    recording_id: str
    message: str


class StreamStartedMessage(BaseModel):
    type: ServerMessageType = ServerMessageType.STREAM_STARTED
    recording_id: str
    message: str


def validate_pcm_chunk(data: bytes, expected_channels: int, expected_sample_width: int) -> None:
    if len(data) == 0:
        raise ValueError("Empty audio chunk")
    if len(data) > MAX_CHUNK_BYTES:
        raise ValueError(
            f"Chunk exceeds max size of {MAX_CHUNK_BYTES} bytes: got {len(data)} bytes"
        )
    frame_size = expected_channels * expected_sample_width
    if len(data) % frame_size != 0:
        raise ValueError(
            f"Chunk size {len(data)} is not aligned to frame size {frame_size} "
            f"(channels={expected_channels}, sample_width={expected_sample_width})"
        )


def pcm16le_to_float32(data: bytes):
    import numpy as np
    arr = np.frombuffer(data, dtype="<i2")
    return arr.astype(np.float32) / 32768.0
