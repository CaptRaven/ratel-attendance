"""add job openings table

Revision ID: a1b2c3d4e5f6
Revises: b7a2f4e91c3d
Create Date: 2026-09-18 16:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = 'b7a2f4e91c3d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'job_openings',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column('title', sa.String(length=255), nullable=False),
        sa.Column('department', sa.String(length=255), nullable=False),
        sa.Column('category', sa.String(length=100), nullable=False),
        sa.Column('location', sa.String(length=255), nullable=False),
        sa.Column('type', sa.String(length=100), nullable=False, server_default='Full-time'),
        sa.Column('experience', sa.String(length=100), nullable=False),
        sa.Column('description', sa.Text(), nullable=False),
        sa.Column('requirements', sa.JSON(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index('ix_job_openings_title', 'job_openings', ['title'], unique=False)
    op.create_index('ix_job_openings_category', 'job_openings', ['category'], unique=False)
    op.create_index('ix_job_openings_is_active', 'job_openings', ['is_active'], unique=False)


def downgrade() -> None:
    op.drop_index('ix_job_openings_is_active', table_name='job_openings')
    op.drop_index('ix_job_openings_category', table_name='job_openings')
    op.drop_index('ix_job_openings_title', table_name='job_openings')
    op.drop_table('job_openings')
