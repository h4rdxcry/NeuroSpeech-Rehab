from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, UUID, Float, Text, JSON, Enum, Integer
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
import uuid
from app.core.db import Base
import enum

class DataClassification(str, enum.Enum):
    REAL = "REAL"
    SYNTHETIC = "SYNTHETIC"
    DEMO = "DEMO"

class DatasetProvenance(Base):
    __tablename__ = "dataset_provenance"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    dataset_id = Column(UUID(as_uuid=True), ForeignKey("datasets.id"), nullable=False, unique=True)
    original_source = Column(String(255), nullable=False)
    original_dataset_identifier = Column(String(255), nullable=True)
    version = Column(String(64), nullable=True)
    download_timestamp = Column(DateTime(timezone=True), nullable=True)
    source_url = Column(Text, nullable=True)
    license_access_info = Column(Text, nullable=True)
    checksum = Column(String(255), nullable=True)
    preprocessing_pipeline_version = Column(String(255), nullable=True)
    transformations_performed = Column(Text, nullable=True)
    responsible_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    dataset = relationship("Dataset", back_populates="provenance")
    responsible_user = relationship("User", back_populates="dataset_provenances")

class DatasetSplit(Base):
    __tablename__ = "dataset_splits"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    dataset_id = Column(UUID(as_uuid=True), ForeignKey("datasets.id"), nullable=False)
    participant_id = Column(String(255), nullable=False)
    split_type = Column(String(32), nullable=False)
    split_version = Column(String(64), nullable=True)
    is_locked = Column(Boolean, default=False, nullable=False)
    final_test_flag = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    dataset = relationship("Dataset", back_populates="splits")

class DatasetCatalog(Base):
    __tablename__ = "dataset_catalog"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    dataset_id = Column(UUID(as_uuid=True), ForeignKey("datasets.id"), nullable=False, unique=True)
    modality = Column(String(64), nullable=True)
    source = Column(String(255), nullable=True)
    version = Column(String(64), nullable=True)
    participants = Column(Integer, nullable=True)
    recordings = Column(Integer, nullable=True)
    duration = Column(Float, nullable=True)
    population = Column(String(255), nullable=True)
    clinical_control = Column(String(64), nullable=True)
    license = Column(String(255), nullable=True)
    access_requirements = Column(Text, nullable=True)
    project_usage = Column(String(32), nullable=True)
    citation = Column(Text, nullable=True)
    url = Column(Text, nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    dataset = relationship("Dataset", back_populates="catalog")
