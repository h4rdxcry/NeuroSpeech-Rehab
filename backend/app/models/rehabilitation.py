"""Database models for 100-Level Patient Rehabilitation Progress and Attempt History.
Provides authoritative persistence across browser sessions, reloads, and devices.
"""
from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, UUID, Integer, Date, Text, Float
from sqlalchemy.sql import func
from sqlalchemy.dialects.postgresql import JSON
from sqlalchemy.orm import relationship
import uuid
from app.core.db import Base


class PatientRehabProgress(Base):
    """Authoritative persistence of patient journey across the 100 sequential rehabilitation levels."""
    __tablename__ = "patient_rehab_progress"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    patient_id = Column(UUID(as_uuid=True), ForeignKey("patients.id"), unique=True, nullable=False)
    current_level = Column(Integer, nullable=False, default=1)
    highest_unlocked_level = Column(Integer, nullable=False, default=1)
    completed_levels = Column(JSON, nullable=False, default=list)  # List[int]
    streak_count = Column(Integer, nullable=False, default=0)
    longest_streak = Column(Integer, nullable=False, default=0)
    last_practice_date = Column(Date, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    patient = relationship("Patient", foreign_keys=[patient_id])


class PatientLevelAttempt(Base):
    """Authoritative record of a single pronunciation practice attempt for a rehabilitation level."""
    __tablename__ = "patient_level_attempts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    patient_id = Column(UUID(as_uuid=True), ForeignKey("patients.id"), nullable=False)
    session_id = Column(UUID(as_uuid=True), ForeignKey("sessions.id"), nullable=True)
    level_number = Column(Integer, nullable=False)
    target_text = Column(String(255), nullable=False)
    language = Column(String(16), nullable=False)  # 'ta-IN' or 'en-IN'
    transcript = Column(Text, nullable=True)
    speech_detected = Column(Boolean, nullable=False, default=False)
    match_score = Column(Float, nullable=False, default=0.0)  # 0.0 to 1.0
    is_success = Column(Boolean, nullable=False, default=False)
    metrics = Column(JSON, nullable=True)  # Acoustic, kinematic, AU cues, latency, feedback
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    patient = relationship("Patient", foreign_keys=[patient_id])
    session = relationship("Session", foreign_keys=[session_id])
