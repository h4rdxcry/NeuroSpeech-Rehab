from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime
from uuid import UUID

class ModalityRecordSchema(BaseModel):
    recording_id: UUID
    modality: str
    device_id: str
    sampling_rate_hz: Optional[float] = None
    channel_count: Optional[int] = None
    channel_names: Optional[List[str]] = None
    start_timestamp: datetime
    end_timestamp: Optional[datetime] = None
    is_synthetic: bool = False
    synthetic_source: Optional[str] = None
    processing_status: str = "raw"

class SignalQualitySchema(BaseModel):
    recording_id: UUID
    overall_quality: str
    quality_score: Optional[float] = None
    metrics: Optional[Dict[str, Any]] = None
    flagged_channels: Optional[List[str]] = None
    artifact_flags: Optional[Dict[str, Any]] = None
    sync_quality: Optional[str] = None
    assessed_by: str = "automatic"
    assessment_version: str = "0.1.0"
    created_at: datetime

class BIDSSidecarSchema(BaseModel):
    SamplingFrequency: Optional[float] = None
    PowerLineFrequency: Optional[float] = None
    EEGChannelCount: Optional[int] = None
    EMGChannelCount: Optional[int] = None
    RecordingDuration: Optional[float] = None
    TaskDescription: Optional[str] = None
    DeviceManufacturer: Optional[str] = None
    DeviceModel: Optional[str] = None
    is_synthetic: bool = False
    synthetic_source: Optional[str] = None
