from pydantic import BaseModel, Field, EmailStr
from typing import Optional, List, Dict, Any
from datetime import datetime
from uuid import UUID

class PatientBase(BaseModel):
    user_id: UUID
    participant_id: Optional[UUID] = None
    clinician_id: Optional[UUID] = None
    date_of_birth: Optional[datetime] = None
    notes: Optional[str] = None
    is_active: bool = True

class PatientCreate(PatientBase):
    pass

class PatientUpdate(BaseModel):
    participant_id: Optional[UUID] = None
    clinician_id: Optional[UUID] = None
    date_of_birth: Optional[datetime] = None
    notes: Optional[str] = None
    is_active: Optional[bool] = None

class PatientResponse(PatientBase):
    id: UUID
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class ResearchParticipantBase(BaseModel):
    pseudonym_id: str = Field(..., min_length=1, max_length=64)
    demographic_summary: Optional[Dict[str, Any]] = None
    inclusion_criteria: Optional[Dict[str, Any]] = None
    exclusion_criteria: Optional[Dict[str, Any]] = None
    consent_status: str = "pending"
    consent_date: Optional[datetime] = None
    assigned_clinician_id: Optional[UUID] = None

class ResearchParticipantCreate(ResearchParticipantBase):
    pass

class ResearchParticipantUpdate(BaseModel):
    demographic_summary: Optional[Dict[str, Any]] = None
    inclusion_criteria: Optional[Dict[str, Any]] = None
    exclusion_criteria: Optional[Dict[str, Any]] = None
    consent_status: Optional[str] = None
    consent_date: Optional[datetime] = None
    assigned_clinician_id: Optional[UUID] = None

class ResearchParticipantResponse(ResearchParticipantBase):
    id: UUID
    created_at: datetime

    class Config:
        from_attributes = True
