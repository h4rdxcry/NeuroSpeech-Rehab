from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, UUID, Float, Text, JSON, Integer
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
import uuid
from app.core.db import Base

class Prediction(Base):
    __tablename__ = "predictions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    attempt_id = Column(UUID(as_uuid=True), ForeignKey("attempts.id"), nullable=False)
    recording_id = Column(UUID(as_uuid=True), nullable=True)
    model_id = Column(UUID(as_uuid=True), ForeignKey("model_versions.id"), nullable=False)
    model_version = Column(String(64), nullable=False)
    feature_pipeline_version = Column(String(64), nullable=False)
    training_dataset_version = Column(String(64), nullable=False)
    prediction_type = Column(String(64), nullable=False)
    predicted_label = Column(String(255), nullable=False)
    confidence = Column(Float, nullable=True)
    uncertainty = Column(Float, nullable=True)
    prediction_json = Column(JSON, nullable=True)
    signal_quality_state = Column(String(64), nullable=False)
    signal_quality_details = Column(JSON, nullable=True)
    timestamp = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    attempt = relationship("Attempt", back_populates="predictions")

class ModelVersion(Base):
    __tablename__ = "model_versions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    model_name = Column(String(255), nullable=False)
    version = Column(String(64), nullable=False)
    model_type = Column(String(64), nullable=False)
    architecture_json = Column(JSON, nullable=False)
    training_dataset_version = Column(String(255), nullable=False)
    feature_pipeline_version = Column(String(255), nullable=False)
    training_params = Column(JSON, nullable=True)
    performance_metrics = Column(JSON, nullable=True)
    is_production = Column(Boolean, default=False, nullable=False)
    is_archived = Column(Boolean, default=False, nullable=False)
    registered_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    registered_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)

    registered_by_user = relationship("User", back_populates="model_versions")
    evaluation_runs = relationship("EvaluationRun", back_populates="model_version")

class EvaluationRun(Base):
    __tablename__ = "evaluation_runs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    model_version_id = Column(UUID(as_uuid=True), ForeignKey("model_versions.id"), nullable=False)
    dataset_version = Column(String(255), nullable=False)
    dataset_split = Column(String(32), nullable=False)
    split_definition = Column(JSON, nullable=False)
    metrics = Column(JSON, nullable=False)
    confusion_matrix = Column(JSON, nullable=True)
    per_participant_metrics = Column(JSON, nullable=True)
    per_exercise_metrics = Column(JSON, nullable=True)
    latency_stats = Column(JSON, nullable=True)
    failure_cases = Column(JSON, nullable=True)
    notes = Column(Text, nullable=True)
    run_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    started_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    completed_at = Column(DateTime(timezone=True), nullable=True)

    model_version = relationship("ModelVersion", back_populates="evaluation_runs")
    run_by_user = relationship("User", back_populates="evaluation_runs")

class Dataset(Base):
    __tablename__ = "datasets"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    version = Column(String(64), nullable=False)
    description = Column(Text, nullable=True)
    bids_root = Column(Text, nullable=True)
    participant_ids = Column(JSON, nullable=False)
    recording_ids = Column(JSON, nullable=False)
    split_definition = Column(JSON, nullable=False)
    is_final_test = Column(Boolean, default=False, nullable=False)
    is_locked = Column(Boolean, default=False, nullable=False)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    source_organization = Column(String(255), nullable=True)
    source_url = Column(Text, nullable=True)
    citation = Column(Text, nullable=True)
    modality = Column(String(64), nullable=True)
    population_description = Column(Text, nullable=True)
    participant_count = Column(Integer, nullable=True)
    recording_count = Column(Integer, nullable=True)
    total_duration = Column(Float, nullable=True)
    sampling_information = Column(Text, nullable=True)
    file_format = Column(String(64), nullable=True)
    license = Column(String(255), nullable=True)
    access_type = Column(String(64), nullable=True)
    access_requirements = Column(Text, nullable=True)
    consent_ethics = Column(Text, nullable=True)
    clinical_or_control_population = Column(String(64), nullable=True)
    language = Column(String(64), nullable=True)
    task_description = Column(Text, nullable=True)
    acquisition_device = Column(String(255), nullable=True)
    is_public = Column(Boolean, default=False, nullable=False)
    is_restricted = Column(Boolean, default=False, nullable=False)
    is_credentialed = Column(Boolean, default=False, nullable=False)
    imported_status = Column(String(32), nullable=False, default="pending")
    import_date = Column(DateTime(timezone=True), nullable=True)
    checksum = Column(String(255), nullable=True)
    data_classification = Column(String(32), nullable=False, default="REAL")
    notes = Column(Text, nullable=True)
    manifest = Column(JSON, nullable=True)
    import_error = Column(Text, nullable=True)
    qc_status = Column(String(32), nullable=True)

    provenance = relationship("DatasetProvenance", back_populates="dataset", cascade="all, delete-orphan", uselist=False)
    splits = relationship("DatasetSplit", back_populates="dataset", cascade="all, delete-orphan")
    catalog = relationship("DatasetCatalog", back_populates="dataset", cascade="all, delete-orphan", uselist=False)
    source_recordings = relationship("Recording", back_populates="source_dataset")
    import_logs = relationship("DatasetImportLog", back_populates="dataset", cascade="all, delete-orphan")

class DatasetImportLog(Base):
    __tablename__ = "dataset_import_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    dataset_id = Column(UUID(as_uuid=True), ForeignKey("datasets.id"), nullable=False, index=True)
    status = Column(String(32), nullable=False)
    message = Column(Text, nullable=True)
    import_metadata = Column("metadata", JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    dataset = relationship("Dataset", back_populates="import_logs")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    actor_role = Column(String(64), nullable=True)
    action = Column(String(64), nullable=False)
    resource_type = Column(String(64), nullable=False)
    resource_id = Column(UUID(as_uuid=True), nullable=True)
    request_id = Column(String(255), nullable=True)
    result = Column(String(32), nullable=False)
    ip_address = Column(String(64), nullable=True)
    user_agent = Column(Text, nullable=True)
    log_metadata = Column(JSON, nullable=True)
    timestamp = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    user = relationship("User", back_populates="audit_logs")
