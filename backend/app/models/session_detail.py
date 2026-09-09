from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, UUID, Integer, Date, Text, Float
from sqlalchemy.sql import func
from sqlalchemy.dialects.postgresql import JSON
from sqlalchemy.orm import relationship
import uuid
from app.core.db import Base

class Exercise(Base):
    __tablename__ = "exercises"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    exercise_type = Column(String(64), nullable=False)
    target_modalities = Column(JSON, nullable=False, default=list)
    difficulty = Column(String(32), nullable=False)
    duration_seconds = Column(Integer, nullable=True)
    repetition_count = Column(Integer, nullable=True)
    configuration = Column(JSON, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    session_exercises = relationship("SessionExercise", back_populates="exercise")

class SessionExercise(Base):
    __tablename__ = "session_exercises"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id = Column(UUID(as_uuid=True), ForeignKey("sessions.id"), nullable=False)
    exercise_id = Column(UUID(as_uuid=True), ForeignKey("exercises.id"), nullable=False)
    order_index = Column(Integer, nullable=False)
    status = Column(String(32), nullable=False, default="pending")
    started_at = Column(DateTime(timezone=True), nullable=True)
    ended_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    session = relationship("Session", back_populates="session_exercises")
    exercise = relationship("Exercise", back_populates="session_exercises")
    attempts = relationship("Attempt", back_populates="session_exercise", cascade="all, delete-orphan")

class Attempt(Base):
    __tablename__ = "attempts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_exercise_id = Column(UUID(as_uuid=True), ForeignKey("session_exercises.id"), nullable=False)
    attempt_number = Column(Integer, nullable=False)
    started_at = Column(DateTime(timezone=True), nullable=False)
    ended_at = Column(DateTime(timezone=True), nullable=True)
    outcome = Column(String(64), nullable=True)
    clinician_rating = Column(Integer, nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    session_exercise = relationship("SessionExercise", back_populates="attempts")
    predictions = relationship("Prediction", back_populates="attempt", cascade="all, delete-orphan")
