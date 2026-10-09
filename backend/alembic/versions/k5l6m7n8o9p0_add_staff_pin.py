"""add staff pin to users

Revision ID: k5l6m7n8o9p0
Revises: j4k5l6m7n8o9
Create Date: 2026-10-09
"""
from alembic import op
import sqlalchemy as sa

revision = 'k5l6m7n8o9p0'
down_revision = 'j4k5l6m7n8o9'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('users', sa.Column('staff_pin_hash', sa.String(255), nullable=True))
    op.add_column('users', sa.Column('staff_session_token', sa.String(255), nullable=True))
    op.create_index('ix_users_staff_session_token', 'users', ['staff_session_token'])


def downgrade():
    op.drop_index('ix_users_staff_session_token', table_name='users')
    op.drop_column('users', 'staff_session_token')
    op.drop_column('users', 'staff_pin_hash')
