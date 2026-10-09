"""add staff_session_expires_at to users

Revision ID: l6m7n8o9p0q1
Revises: k5l6m7n8o9p0
Create Date: 2026-10-09
"""
from alembic import op
import sqlalchemy as sa

revision = 'l6m7n8o9p0q1'
down_revision = 'k5l6m7n8o9p0'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('users', sa.Column('staff_session_expires_at', sa.DateTime(timezone=True), nullable=True))


def downgrade():
    op.drop_column('users', 'staff_session_expires_at')
