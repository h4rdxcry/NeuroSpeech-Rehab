from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List
from datetime import datetime
from uuid import UUID

class AnnotationBase(BaseModel):
    recording_id: UUID
    annotator_id: UUID
    annotation_type: str = Field(..., max_length=64)
    start_timestamp: datetime
    end_timestamp: Optional[datetime] = None
    label: str = Field(..., max_length=255)
    confidence: Optional[float] = Field(None, ge=0.0, le=1.0)
    notes: Optional[str] = None
    is_ground_truth: bool = False

class AnnotationCreate(AnnotationBase):
    pass

class AnnotationUpdate(BaseModel):
    annotation_type: Optional[str] = Field(None, max_length=64)
    start_timestamp: Optional[datetime] = None
    end_timestamp: Optional[datetime] = None
    label: Optional[str] = Field(None, max_length=255)
    confidence: Optional[float] = Field(None, ge=0.0, le=1.0)
    notes: Optional[str] = None
    is_ground_truth: Optional[bool] = None

class AnnotationResponse(AnnotationBase):
    id: UUID
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
