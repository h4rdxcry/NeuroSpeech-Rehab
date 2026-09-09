"""Fix schema drift to match current SQLAlchemy models

Revision ID: 003_fix_schema_drift
Revises: 002_dataset_registry_extensions
Create Date: 2026-09-05
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision = "003_fix_schema_drift"
down_revision: Union[str, None] = "002_dataset_registry_extensions"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column("roles", "created_at", existing_type=sa.DateTime(timezone=True), nullable=True)


def downgrade() -> None:
    op.alter_column("roles", "created_at", existing_type=sa.DateTime(timezone=True), nullable=False)
