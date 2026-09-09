"""Dataset registry, provenance, splits, catalog, recording metadata, and signal quality extensions

Revision ID: 002_dataset_registry_extensions
Revises: 001_initial
Create Date: 2026-09-05
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSON
import uuid

revision = "002_dataset_registry_extensions"
down_revision: Union[str, None] = "001_initial"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "datasets",
        sa.Column("source_organization", sa.String(255), nullable=True),
    )
    op.add_column(
        "datasets",
        sa.Column("source_url", sa.Text, nullable=True),
    )
    op.add_column(
        "datasets",
        sa.Column("citation", sa.Text, nullable=True),
    )
    op.add_column(
        "datasets",
        sa.Column("modality", sa.String(64), nullable=True),
    )
    op.add_column(
        "datasets",
        sa.Column("population_description", sa.Text, nullable=True),
    )
    op.add_column(
        "datasets",
        sa.Column("participant_count", sa.Integer, nullable=True),
    )
    op.add_column(
        "datasets",
        sa.Column("recording_count", sa.Integer, nullable=True),
    )
    op.add_column(
        "datasets",
        sa.Column("total_duration", sa.Float, nullable=True),
    )
    op.add_column(
        "datasets",
        sa.Column("sampling_information", sa.Text, nullable=True),
    )
    op.add_column(
        "datasets",
        sa.Column("file_format", sa.String(64), nullable=True),
    )
    op.add_column(
        "datasets",
        sa.Column("license", sa.String(255), nullable=True),
    )
    op.add_column(
        "datasets",
        sa.Column("access_type", sa.String(64), nullable=True),
    )
    op.add_column(
        "datasets",
        sa.Column("access_requirements", sa.Text, nullable=True),
    )
    op.add_column(
        "datasets",
        sa.Column("consent_ethics", sa.Text, nullable=True),
    )
    op.add_column(
        "datasets",
        sa.Column("clinical_or_control_population", sa.String(64), nullable=True),
    )
    op.add_column(
        "datasets",
        sa.Column("language", sa.String(64), nullable=True),
    )
    op.add_column(
        "datasets",
        sa.Column("task_description", sa.Text, nullable=True),
    )
    op.add_column(
        "datasets",
        sa.Column("acquisition_device", sa.String(255), nullable=True),
    )
    op.add_column(
        "datasets",
        sa.Column("is_public", sa.Boolean, default=False, nullable=False),
    )
    op.add_column(
        "datasets",
        sa.Column("is_restricted", sa.Boolean, default=False, nullable=False),
    )
    op.add_column(
        "datasets",
        sa.Column("is_credentialed", sa.Boolean, default=False, nullable=False),
    )
    op.add_column(
        "datasets",
        sa.Column("imported_status", sa.String(32), nullable=False, server_default="pending"),
    )
    op.add_column(
        "datasets",
        sa.Column("import_date", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "datasets",
        sa.Column("checksum", sa.String(255), nullable=True),
    )
    op.add_column(
        "datasets",
        sa.Column("notes", sa.Text, nullable=True),
    )

    op.create_table(
        "dataset_provenance",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column("dataset_id", UUID(as_uuid=True), sa.ForeignKey("datasets.id"), nullable=False, unique=True),
        sa.Column("original_source", sa.String(255), nullable=False),
        sa.Column("original_dataset_identifier", sa.String(255), nullable=True),
        sa.Column("version", sa.String(64), nullable=True),
        sa.Column("download_timestamp", sa.DateTime(timezone=True), nullable=True),
        sa.Column("source_url", sa.Text, nullable=True),
        sa.Column("license_access_info", sa.Text, nullable=True),
        sa.Column("checksum", sa.String(255), nullable=True),
        sa.Column("preprocessing_pipeline_version", sa.String(255), nullable=True),
        sa.Column("transformations_performed", sa.Text, nullable=True),
        sa.Column("responsible_user_id", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_table(
        "dataset_splits",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column("dataset_id", UUID(as_uuid=True), sa.ForeignKey("datasets.id"), nullable=False),
        sa.Column("participant_id", sa.String(255), nullable=False),
        sa.Column("split_type", sa.String(32), nullable=False),
        sa.Column("split_version", sa.String(64), nullable=True),
        sa.Column("is_locked", sa.Boolean, default=False, nullable=False),
        sa.Column("final_test_flag", sa.Boolean, default=False, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_table(
        "dataset_catalog",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column("dataset_id", UUID(as_uuid=True), sa.ForeignKey("datasets.id"), nullable=False, unique=True),
        sa.Column("modality", sa.String(64), nullable=True),
        sa.Column("source", sa.String(255), nullable=True),
        sa.Column("version", sa.String(64), nullable=True),
        sa.Column("participants", sa.Integer, nullable=True),
        sa.Column("recordings", sa.Integer, nullable=True),
        sa.Column("duration", sa.Float, nullable=True),
        sa.Column("population", sa.String(255), nullable=True),
        sa.Column("clinical_control", sa.String(64), nullable=True),
        sa.Column("license", sa.String(255), nullable=True),
        sa.Column("access_requirements", sa.Text, nullable=True),
        sa.Column("project_usage", sa.String(32), nullable=True),
        sa.Column("citation", sa.Text, nullable=True),
        sa.Column("url", sa.Text, nullable=True),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
    )

    op.add_column(
        "recordings",
        sa.Column("participant_pseudonym", sa.String(64), nullable=True),
    )
    op.add_column(
        "recordings",
        sa.Column("session_identifier", sa.String(255), nullable=True),
    )
    op.add_column(
        "recordings",
        sa.Column("recording_identifier", sa.String(255), nullable=True),
    )
    op.add_column(
        "recordings",
        sa.Column("data_classification", sa.String(32), nullable=False, server_default="REAL"),
    )
    op.add_column(
        "recordings",
        sa.Column("units", sa.String(64), nullable=True),
    )
    op.add_column(
        "recordings",
        sa.Column("source_dataset_id", UUID(as_uuid=True), sa.ForeignKey("datasets.id"), nullable=True),
    )
    op.add_column(
        "recordings",
        sa.Column("quality_status", sa.String(32), nullable=True),
    )
    op.add_column(
        "recordings",
        sa.Column("synchronization_info", JSON, nullable=True),
    )

    op.add_column(
        "signal_quality",
        sa.Column("missing_channels", JSON, nullable=True),
    )
    op.add_column(
        "signal_quality",
        sa.Column("corrupted_files", sa.Boolean, nullable=True),
    )
    op.add_column(
        "signal_quality",
        sa.Column("clipping", sa.Boolean, nullable=True),
    )
    op.add_column(
        "signal_quality",
        sa.Column("artifact_indicators", JSON, nullable=True),
    )
    op.add_column(
        "signal_quality",
        sa.Column("sampling_problems", JSON, nullable=True),
    )
    op.add_column(
        "signal_quality",
        sa.Column("synchronization_problems", JSON, nullable=True),
    )
    op.add_column(
        "signal_quality",
        sa.Column("rejection_reason", sa.Text, nullable=True),
    )
    op.add_column(
        "signal_quality",
        sa.Column("qc_timestamp", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("signal_quality", "qc_timestamp")
    op.drop_column("signal_quality", "rejection_reason")
    op.drop_column("signal_quality", "synchronization_problems")
    op.drop_column("signal_quality", "sampling_problems")
    op.drop_column("signal_quality", "artifact_indicators")
    op.drop_column("signal_quality", "clipping")
    op.drop_column("signal_quality", "corrupted_files")
    op.drop_column("signal_quality", "missing_channels")

    op.drop_column("recordings", "synchronization_info")
    op.drop_column("recordings", "quality_status")
    op.drop_column("recordings", "source_dataset_id")
    op.drop_column("recordings", "units")
    op.drop_column("recordings", "data_classification")
    op.drop_column("recordings", "recording_identifier")
    op.drop_column("recordings", "session_identifier")
    op.drop_column("recordings", "participant_pseudonym")

    op.drop_table("dataset_catalog")
    op.drop_table("dataset_splits")
    op.drop_table("dataset_provenance")

    op.drop_column("datasets", "notes")
    op.drop_column("datasets", "checksum")
    op.drop_column("datasets", "import_date")
    op.drop_column("datasets", "imported_status")
    op.drop_column("datasets", "is_credentialed")
    op.drop_column("datasets", "is_restricted")
    op.drop_column("datasets", "is_public")
    op.drop_column("datasets", "acquisition_device")
    op.drop_column("datasets", "task_description")
    op.drop_column("datasets", "language")
    op.drop_column("datasets", "clinical_or_control_population")
    op.drop_column("datasets", "consent_ethics")
    op.drop_column("datasets", "access_requirements")
    op.drop_column("datasets", "access_type")
    op.drop_column("datasets", "license")
    op.drop_column("datasets", "file_format")
    op.drop_column("datasets", "sampling_information")
    op.drop_column("datasets", "total_duration")
    op.drop_column("datasets", "recording_count")
    op.drop_column("datasets", "participant_count")
    op.drop_column("datasets", "population_description")
    op.drop_column("datasets", "modality")
    op.drop_column("datasets", "citation")
    op.drop_column("datasets", "source_url")
    op.drop_column("datasets", "source_organization")
