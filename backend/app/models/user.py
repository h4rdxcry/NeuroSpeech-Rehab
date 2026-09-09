from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, UUID, Integer, Date, Text
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
import uuid
from app.core.db import Base

class Role(Base):
    __tablename__ = "roles"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(50), unique=True, nullable=False)
    permissions = Column(String, nullable=False, default="[]")
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    users = relationship("User", back_populates="role")

class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    role_id = Column(UUID(as_uuid=True), ForeignKey("roles.id"), nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    role = relationship("Role", back_populates="users")
    patient = relationship("Patient", back_populates="user", foreign_keys="Patient.user_id", uselist=False)
    research_participants = relationship("ResearchParticipant", back_populates="assigned_clinician", foreign_keys="ResearchParticipant.assigned_clinician_id")
    sessions_as_clinician = relationship("Session", back_populates="clinician", foreign_keys="Session.clinician_id")
    annotations = relationship("Annotation", back_populates="annotator", foreign_keys="Annotation.annotator_id")
    model_versions = relationship("ModelVersion", back_populates="registered_by_user", foreign_keys="ModelVersion.registered_by")
    evaluation_runs = relationship("EvaluationRun", back_populates="run_by_user", foreign_keys="EvaluationRun.run_by")
    audit_logs = relationship("AuditLog", back_populates="user", foreign_keys="AuditLog.user_id")
    dataset_provenances = relationship("DatasetProvenance", back_populates="responsible_user", foreign_keys="DatasetProvenance.responsible_user_id")
