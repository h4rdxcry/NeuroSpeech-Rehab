from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List
from datetime import datetime
from uuid import UUID

class EvaluationRunBase(BaseModel):
    name: str = Field(..., max_length=255)
    model_version_id: UUID
    dataset_version: str = Field(..., max_length=255)
    dataset_split: str = Field(..., max_length=32)
    split_definition: Dict[str, Any]
    metrics: Dict[str, Any]
    confusion_matrix: Optional[Dict[str, Any]] = None
    per_participant_metrics: Optional[Dict[str, Any]] = None
    per_exercise_metrics: Optional[Dict[str, Any]] = None
    latency_stats: Optional[Dict[str, Any]] = None
    failure_cases: Optional[List[Dict[str, Any]]] = None
    notes: Optional[str] = None
    run_by: UUID

class EvaluationRunCreate(EvaluationRunBase):
    pass

class EvaluationRunUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=255)
    metrics: Optional[Dict[str, Any]] = None
    confusion_matrix: Optional[Dict[str, Any]] = None
    per_participant_metrics: Optional[Dict[str, Any]] = None
    per_exercise_metrics: Optional[Dict[str, Any]] = None
    latency_stats: Optional[Dict[str, Any]] = None
    failure_cases: Optional[List[Dict[str, Any]]] = None
    notes: Optional[str] = None
    completed_at: Optional[datetime] = None

class EvaluationRunResponse(EvaluationRunBase):
    id: UUID
    started_at: datetime
    completed_at: Optional[datetime] = None

    class Config:
        from_attributes = True
