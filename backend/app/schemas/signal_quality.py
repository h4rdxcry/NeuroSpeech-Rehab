from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from uuid import UUID

class SignalQualityBase(BaseModel):
    recording_id: UUID
    quality_state: str = "UNKNOWN"
    quality_score: Optional[float] = Field(None, ge=0.0, le=1.0)
    artifact_ratio: Optional[float] = Field(None, ge=0.0, le=1.0)
    missing_data_ratio: Optional[float] = Field(None, ge=0.0, le=1.0)
    synchronization_status: Optional[str] = None
    sampling_rate_valid: Optional[bool] = None
    channel_status: Optional[Dict[str, Any]] = None
    missing_channels: Optional[List[str]] = None
    corrupted_files: Optional[bool] = None
    clipping: Optional[bool] = None
    artifact_indicators: Optional[Dict[str, Any]] = None
    sampling_problems: Optional[Dict[str, Any]] = None
    synchronization_problems: Optional[Dict[str, Any]] = None
    rejection_reason: Optional[str] = None
    qc_timestamp: Optional[datetime] = None
    notes: Optional[str] = None

class SignalQualityCreate(SignalQualityBase):
    pass

class SignalQualityUpdate(BaseModel):
    quality_state: Optional[str] = None
    quality_score: Optional[float] = Field(None, ge=0.0, le=1.0)
    artifact_ratio: Optional[float] = Field(None, ge=0.0, le=1.0)
    missing_data_ratio: Optional[float] = Field(None, ge=0.0, le=1.0)
    synchronization_status: Optional[str] = None
    sampling_rate_valid: Optional[bool] = None
    channel_status: Optional[Dict[str, Any]] = None
    missing_channels: Optional[List[str]] = None
    corrupted_files: Optional[bool] = None
    clipping: Optional[bool] = None
    artifact_indicators: Optional[Dict[str, Any]] = None
    sampling_problems: Optional[Dict[str, Any]] = None
    synchronization_problems: Optional[Dict[str, Any]] = None
    rejection_reason: Optional[str] = None
    qc_timestamp: Optional[datetime] = None
    notes: Optional[str] = None

class SignalQualityResponse(SignalQualityBase):
    id: UUID
    created_at: datetime

    class Config:
        from_attributes = True
