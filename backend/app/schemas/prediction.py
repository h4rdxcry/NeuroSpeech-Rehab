from pydantic import BaseModel, Field
from typing import Optional, Dict, Any
from datetime import datetime
from uuid import UUID


class PredictionBase(BaseModel):
    attempt_id: UUID
    recording_id: Optional[UUID] = None
    model_id: UUID
    model_version: str = Field(..., max_length=64)
    feature_pipeline_version: str = Field(..., max_length=64)
    training_dataset_version: str = Field(..., max_length=255)
    prediction_type: str = Field(..., max_length=64)
    predicted_label: str = Field(..., max_length=255)
    confidence: Optional[float] = Field(None, ge=0.0, le=1.0)
    uncertainty: Optional[float] = Field(None, ge=0.0, le=1.0)
    prediction_json: Optional[Dict[str, Any]] = None
    signal_quality_state: str = Field(..., max_length=64)
    signal_quality_details: Optional[Dict[str, Any]] = None
    timestamp: datetime


class PredictionCreate(PredictionBase):
    pass


class PredictionUpdate(BaseModel):
    model_id: Optional[UUID] = None
    model_version: Optional[str] = Field(None, max_length=64)
    feature_pipeline_version: Optional[str] = Field(None, max_length=64)
    training_dataset_version: Optional[str] = Field(None, max_length=255)
    prediction_type: Optional[str] = Field(None, max_length=64)
    predicted_label: Optional[str] = Field(None, max_length=255)
    confidence: Optional[float] = Field(None, ge=0.0, le=1.0)
    uncertainty: Optional[float] = Field(None, ge=0.0, le=1.0)
    prediction_json: Optional[Dict[str, Any]] = None
    signal_quality_state: Optional[str] = Field(None, max_length=64)
    signal_quality_details: Optional[Dict[str, Any]] = None
    timestamp: Optional[datetime] = None


class PredictionResponse(PredictionBase):
    id: UUID
    created_at: datetime

    class Config:
        from_attributes = True
