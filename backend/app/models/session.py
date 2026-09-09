from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, UUID, Integer, Float, Text, Date
from sqlalchemy.sql import func
from sqlalchemy.dialects.postgresql import JSON
from sqlalchemy.orm import relationship
import uuid
from app.core.db import Base

class Session(Base):
    __tablename__ = "sessions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    participant_id = Column(UUID(as_uuid=True), ForeignKey("research_participants.id"), nullable=False)
    patient_id = Column(UUID(as_uuid=True), ForeignKey("patients.id"), nullable=True)
    clinician_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    session_date = Column(Date, nullable=False)
    session_number = Column(Integer, nullable=False)
    protocol_id = Column(String(255), nullable=True)
    environment = Column(String(64), nullable=True)
    notes = Column(Text, nullable=True)
    started_at = Column(DateTime(timezone=True), nullable=True)
    ended_at = Column(DateTime(timezone=True), nullable=True)
    status = Column(String(32), nullable=False, default="planned")
    dataset_split = Column(String(32), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    participant = relationship("ResearchParticipant", back_populates="sessions")
    patient = relationship("Patient", back_populates="sessions", foreign_keys=[patient_id])
    clinician = relationship("User", back_populates="sessions_as_clinician", foreign_keys=[clinician_id])
    session_exercises = relationship("SessionExercise", back_populates="session", cascade="all, delete-orphan")
    recordings = relationship("Recording", back_populates="session", cascade="all, delete-orphan")
