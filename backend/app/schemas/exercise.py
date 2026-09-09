from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from uuid import UUID

class ExerciseBase(BaseModel):
    name: str = Field(..., max_length=255)
    description: Optional[str] = None
    exercise_type: str = Field(..., max_length=64)
    target_modalities: List[str] = Field(default_factory=list)
    difficulty: str = Field(..., max_length=32)
    duration_seconds: Optional[int] = None
    repetition_count: Optional[int] = None
    configuration: Optional[Dict[str, Any]] = None
    is_active: bool = True

class ExerciseCreate(ExerciseBase):
    pass

class ExerciseUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=255)
    description: Optional[str] = None
    exercise_type: Optional[str] = Field(None, max_length=64)
    target_modalities: Optional[List[str]] = None
    difficulty: Optional[str] = Field(None, max_length=32)
    duration_seconds: Optional[int] = None
    repetition_count: Optional[int] = None
    configuration: Optional[Dict[str, Any]] = None
    is_active: Optional[bool] = None

class ExerciseResponse(ExerciseBase):
    id: UUID
    created_at: datetime

    class Config:
        from_attributes = True
