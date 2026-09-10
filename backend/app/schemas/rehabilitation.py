"""Pydantic schemas for Patient Rehabilitation Progression and Practice Attempts."""
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, ConfigDict, Field
from uuid import UUID
from datetime import datetime, date


class RehabLevelSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    level: int
    language: str
    languageName: str
    targetText: str
    phoneticGuide: str
    meaning: str
    stage: str
    stageRange: str
    exerciseType: str
    guidanceTip: str
    targetDurationSec: float


class PatientRehabProgressResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    patient_id: UUID
    current_level: int
    highest_unlocked_level: int
    completed_levels: List[int]
    streak_count: int
    longest_streak: int
    last_practice_date: Optional[date] = None
    created_at: datetime
    updated_at: datetime


class AttemptSubmissionRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")

    level_number: int = Field(ge=1, le=100)
    target_text: str = Field(min_length=1)
    language: str = Field(default="ta-IN")
    recognized_transcript: Optional[str] = None
    recording_duration_seconds: float = Field(default=0.0, ge=0.0)
    peak_audio_level: float = Field(default=0.0, ge=0.0)
    lip_aperture_ratio: Optional[float] = None
    mouth_width_ratio: Optional[float] = None
    target_vowel_type: str = "default"
    landmarks_sequence: Optional[List[List[List[float]]]] = None
    mouth_frames_sequence: Optional[List[Any]] = None
    session_id: Optional[UUID] = None


class AttemptEvaluationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    attempt_id: UUID
    level_number: int
    target_text: str
    language: str
    transcript: Optional[str]
    speech_detected: bool = Field(default=False)
    match_score: float
    is_success: bool
    feedback_message: str
    actionable_tip: Optional[str] = None
    current_level: int
    highest_unlocked_level: int
    completed_levels: List[int]
    streak_count: int
    rehab_summary: Optional[Dict[str, Any]] = None
