"""add is_department_head to users

Revision ID: m7n8o9p0q1r2
Revises: l6m7n8o9p0q1
Create Date: 2026-10-09 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = 'm7n8o9p0q1r2'
down_revision = 'l6m7n8o9p0q1'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('users', sa.Column('is_department_head', sa.Boolean(), nullable=False, server_default='false'))


def downgrade():
    op.drop_column('users', 'is_department_head')
