from pydantic import BaseModel, ConfigDict, model_validator
from datetime import datetime, date
from uuid import UUID
from typing import Optional, Literal

class SessionBase(BaseModel):
    participant_id: UUID
    patient_id: Optional[UUID] = None
    clinician_id: Optional[UUID] = None
    session_date: date
    session_number: int
    protocol_id: Optional[str] = None
    environment: Optional[str] = None
    notes: Optional[str] = None
    dataset_split: Optional[str] = None

class SessionCreate(SessionBase):
    pass

class SessionUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    participant_id: Optional[UUID] = None
    patient_id: Optional[UUID] = None
    clinician_id: Optional[UUID] = None
    session_date: Optional[date] = None
    session_number: Optional[int] = None
    protocol_id: Optional[str] = None
    environment: Optional[str] = None
    notes: Optional[str] = None
    dataset_split: Optional[str] = None
    status: Optional[Literal["planned", "scheduled", "in_progress", "completed", "cancelled"]] = None
    started_at: Optional[datetime] = None
    ended_at: Optional[datetime] = None

    @model_validator(mode="after")
    def validate_status(self):
        if "status" in self.model_fields_set and self.status is None:
            raise ValueError("Session status cannot be null")
        return self

class SessionResponse(SessionBase):
    id: UUID
    status: str
    started_at: Optional[datetime] = None
    ended_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True

class RecordingBase(BaseModel):
    session_id: UUID
    modality: str
    device_id: str
    device_name: Optional[str] = None
    file_path: str
    file_format: str
    sampling_rate_hz: Optional[float] = None
    channel_count: Optional[int] = None
    channel_names: Optional[list] = None
    duration_seconds: Optional[float] = None
    start_timestamp: datetime
    end_timestamp: Optional[datetime] = None
    is_synthetic: bool = False
    synthetic_source: Optional[str] = None
    ground_truth_available: bool = False
    processing_status: str = "raw"

class RecordingCreate(RecordingBase):
    pass

class RecordingResponse(RecordingBase):
    id: UUID
    created_at: datetime

    class Config:
        from_attributes = True

class PredictionBase(BaseModel):
    attempt_id: UUID
    recording_id: Optional[UUID] = None
    model_id: UUID
    model_version: str
    feature_pipeline_version: str
    training_dataset_version: str
    prediction_type: str
    predicted_label: str
    confidence: Optional[float] = None
    uncertainty: Optional[float] = None
    signal_quality_state: str
    signal_quality_details: Optional[dict] = None
    timestamp: datetime

class PredictionCreate(PredictionBase):
    pass

class PredictionResponse(PredictionBase):
    id: UUID
    created_at: datetime

    class Config:
        from_attributes = True
