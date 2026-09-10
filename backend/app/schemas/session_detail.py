from pydantic import BaseModel, ConfigDict
from typing import Optional
from datetime import datetime
from uuid import UUID

class SessionExerciseBase(BaseModel):
    session_id: UUID
    exercise_id: UUID
    order_index: int
    status: str = "pending"
    started_at: Optional[datetime] = None
    ended_at: Optional[datetime] = None

class SessionExerciseCreate(SessionExerciseBase):
    model_config = ConfigDict(extra="forbid")

class SessionExerciseUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    status: Optional[str] = None
    started_at: Optional[datetime] = None
    ended_at: Optional[datetime] = None

class SessionExerciseResponse(SessionExerciseBase):
    id: UUID
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class AttemptBase(BaseModel):
    session_exercise_id: UUID
    attempt_number: int
    started_at: datetime
    ended_at: Optional[datetime] = None
    outcome: Optional[str] = None
    clinician_rating: Optional[int] = None
    notes: Optional[str] = None

class AttemptCreate(AttemptBase):
    model_config = ConfigDict(extra="forbid")

class AttemptUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    ended_at: Optional[datetime] = None
    outcome: Optional[str] = None
    clinician_rating: Optional[int] = None
    notes: Optional[str] = None

class AttemptResponse(AttemptBase):
    id: UUID
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
