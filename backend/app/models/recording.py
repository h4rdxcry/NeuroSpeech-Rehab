from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, UUID, Integer, Float, Text, JSON
from sqlalchemy.sql import func
from sqlalchemy.dialects.postgresql import JSON
from sqlalchemy.orm import relationship
import uuid
from app.core.db import Base

class Recording(Base):
    __tablename__ = "recordings"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id = Column(UUID(as_uuid=True), ForeignKey("sessions.id"), nullable=False)
    session_exercise_id = Column(UUID(as_uuid=True), nullable=True)
    attempt_id = Column(UUID(as_uuid=True), nullable=True)
    modality = Column(String(32), nullable=False)
    device_id = Column(String(255), nullable=False)
    device_name = Column(String(255), nullable=True)
    file_path = Column(Text, nullable=False)
    file_format = Column(String(32), nullable=False)
    sampling_rate_hz = Column(Float, nullable=True)
    channel_count = Column(Integer, nullable=True)
    channel_names = Column(JSON, nullable=True)
    duration_seconds = Column(Float, nullable=True)
    start_timestamp = Column(DateTime(timezone=True), nullable=False)
    end_timestamp = Column(DateTime(timezone=True), nullable=True)
    is_synthetic = Column(Boolean, default=False, nullable=False)
    synthetic_source = Column(String(255), nullable=True)
    ground_truth_available = Column(Boolean, default=False, nullable=False)
    processing_status = Column(String(32), nullable=False, default="raw")
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    participant_pseudonym = Column(String(64), nullable=True)
    session_identifier = Column(String(255), nullable=True)
    recording_identifier = Column(String(255), nullable=True)
    data_classification = Column(String(32), nullable=False, default="REAL")
    units = Column(String(64), nullable=True)
    source_dataset_id = Column(UUID(as_uuid=True), ForeignKey("datasets.id"), nullable=True)
    quality_status = Column(String(32), nullable=True)
    synchronization_info = Column(JSON, nullable=True)

    session = relationship("Session", back_populates="recordings")
    signal_quality = relationship("SignalQuality", back_populates="recording", uselist=False, cascade="all, delete-orphan")
    annotations = relationship("Annotation", back_populates="recording", cascade="all, delete-orphan")
    source_dataset = relationship("Dataset", back_populates="source_recordings")

class Modality(Base):
    __tablename__ = "modalities"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(64), unique=True, nullable=False)
    description = Column(Text, nullable=True)
    required_for_sync = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

class SignalQuality(Base):
    __tablename__ = "signal_quality"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    recording_id = Column(UUID(as_uuid=True), ForeignKey("recordings.id"), unique=True, nullable=False)
    quality_state = Column(String(32), nullable=False, default="UNKNOWN")
    quality_score = Column(Float, nullable=True)
    artifact_ratio = Column(Float, nullable=True)
    missing_data_ratio = Column(Float, nullable=True)
    synchronization_status = Column(String(32), nullable=True)
    sampling_rate_valid = Column(Boolean, nullable=True)
    channel_status = Column(JSON, nullable=True)
    missing_channels = Column(JSON, nullable=True)
    corrupted_files = Column(Boolean, nullable=True)
    clipping = Column(Boolean, nullable=True)
    artifact_indicators = Column(JSON, nullable=True)
    sampling_problems = Column(JSON, nullable=True)
    synchronization_problems = Column(JSON, nullable=True)
    rejection_reason = Column(Text, nullable=True)
    qc_timestamp = Column(DateTime(timezone=True), nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    recording = relationship("Recording", back_populates="signal_quality")

class Annotation(Base):
    __tablename__ = "annotations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    recording_id = Column(UUID(as_uuid=True), ForeignKey("recordings.id"), nullable=False)
    annotator_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    annotation_type = Column(String(64), nullable=False)
    start_timestamp = Column(DateTime(timezone=True), nullable=False)
    end_timestamp = Column(DateTime(timezone=True), nullable=True)
    label = Column(Text, nullable=False)
    confidence = Column(Float, nullable=True)
    notes = Column(Text, nullable=True)
    is_ground_truth = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    recording = relationship("Recording", back_populates="annotations")
    annotator = relationship("User", back_populates="annotations")
