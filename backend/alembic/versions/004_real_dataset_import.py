"""Real dataset acquisition and import foundation

Revision ID: 004_real_dataset_import
Revises: 003_fix_schema_drift
Create Date: 2026-09-05
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSON

revision = "004_real_dataset_import"
down_revision: Union[str, None] = "003_fix_schema_drift"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "datasets",
        sa.Column("data_classification", sa.String(32), nullable=False, server_default="REAL"),
    )
    op.add_column(
        "datasets",
        sa.Column("manifest", JSON, nullable=True),
    )
    op.add_column(
        "datasets",
        sa.Column("import_error", sa.Text, nullable=True),
    )
    op.add_column(
        "datasets",
        sa.Column("qc_status", sa.String(32), nullable=True),
    )
    op.create_table(
        "dataset_import_logs",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("dataset_id", UUID(as_uuid=True), sa.ForeignKey("datasets.id"), nullable=False),
        sa.Column("status", sa.String(32), nullable=False),
        sa.Column("message", sa.Text, nullable=True),
        sa.Column("metadata", JSON, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_dataset_import_logs_dataset_id", "dataset_import_logs", ["dataset_id"])


def downgrade() -> None:
    op.drop_index("ix_dataset_import_logs_dataset_id", table_name="dataset_import_logs")
    op.drop_table("dataset_import_logs")
    op.drop_column("datasets", "qc_status")
    op.drop_column("datasets", "import_error")
    op.drop_column("datasets", "manifest")
    op.drop_column("datasets", "data_classification")
