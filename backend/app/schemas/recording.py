from pydantic import ConfigDict, BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from uuid import UUID
from app.schemas.enums import ModalityType

class RecordingBase(BaseModel):
    session_id: UUID
    session_exercise_id: Optional[UUID] = None
    attempt_id: Optional[UUID] = None
    modality: ModalityType
    device_id: str = Field(..., max_length=255)
    device_name: Optional[str] = Field(None, max_length=255)
    file_path: str
    file_format: str = Field(..., max_length=32)
    sampling_rate_hz: Optional[float] = None
    channel_count: Optional[int] = None
    channel_names: Optional[List[str]] = None
    duration_seconds: Optional[float] = None
    start_timestamp: datetime
    end_timestamp: Optional[datetime] = None
    is_synthetic: bool = False
    synthetic_source: Optional[str] = Field(None, max_length=255)
    ground_truth_available: bool = False
    processing_status: str = "raw"
    participant_pseudonym: Optional[str] = Field(None, max_length=64)
    session_identifier: Optional[str] = Field(None, max_length=255)
    recording_identifier: Optional[str] = Field(None, max_length=255)
    data_classification: str = "REAL"
    units: Optional[str] = Field(None, max_length=64)
    source_dataset_id: Optional[UUID] = None
    quality_status: Optional[str] = Field(None, max_length=32)
    synchronization_info: Optional[Dict[str, Any]] = None

class RecordingCreate(RecordingBase):
    pass

class RecordingUpdate(BaseModel):
    modality: Optional[ModalityType] = None
    device_id: Optional[str] = Field(None, max_length=255)
    device_name: Optional[str] = Field(None, max_length=255)
    file_path: Optional[str] = None
    file_format: Optional[str] = Field(None, max_length=32)
    sampling_rate_hz: Optional[float] = None
    channel_count: Optional[int] = None
    channel_names: Optional[List[str]] = None
    duration_seconds: Optional[float] = None
    start_timestamp: Optional[datetime] = None
    end_timestamp: Optional[datetime] = None
    is_synthetic: Optional[bool] = None
    synthetic_source: Optional[str] = Field(None, max_length=255)
    ground_truth_available: Optional[bool] = None
    processing_status: Optional[str] = None
    participant_pseudonym: Optional[str] = Field(None, max_length=64)
    session_identifier: Optional[str] = Field(None, max_length=255)
    recording_identifier: Optional[str] = Field(None, max_length=255)
    data_classification: Optional[str] = None
    units: Optional[str] = Field(None, max_length=64)
    source_dataset_id: Optional[UUID] = None
    quality_status: Optional[str] = Field(None, max_length=32)
    synchronization_info: Optional[Dict[str, Any]] = None

class RecordingResponse(RecordingBase):
    id: UUID
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
