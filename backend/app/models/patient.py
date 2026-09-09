from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, UUID, Integer, Date, Text
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
import uuid
from app.core.db import Base

class Patient(Base):
    __tablename__ = "patients"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), unique=True, nullable=False)
    # Explicit enrollment link used by the patient workflow. A patient-facing
    # session must never guess or expose a research participant identifier.
    participant_id = Column(UUID(as_uuid=True), ForeignKey("research_participants.id"), unique=True, nullable=True)
    clinician_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    date_of_birth = Column(Date, nullable=True)
    notes = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    user = relationship("User", back_populates="patient", foreign_keys=[user_id])
    clinician = relationship("User", foreign_keys=[clinician_id])
    sessions = relationship("Session", back_populates="patient", foreign_keys="Session.patient_id")
    participant = relationship("ResearchParticipant", foreign_keys=[participant_id])

class ResearchParticipant(Base):
    __tablename__ = "research_participants"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    pseudonym_id = Column(String(64), unique=True, nullable=False, index=True)
    demographic_summary = Column(String, nullable=True)
    inclusion_criteria = Column(String, nullable=True)
    exclusion_criteria = Column(String, nullable=True)
    consent_status = Column(String(32), nullable=False, default="pending")
    consent_date = Column(Date, nullable=True)
    assigned_clinician_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    assigned_clinician = relationship("User", back_populates="research_participants", foreign_keys=[assigned_clinician_id])
    sessions = relationship("Session", back_populates="participant")
