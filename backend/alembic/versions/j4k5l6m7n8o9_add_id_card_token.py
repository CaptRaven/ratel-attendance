"""add id_card_token to users

Revision ID: j4k5l6m7n8o9
Revises: i3j4k5l6m7n8
Create Date: 2026-09-29

"""
from alembic import op
import sqlalchemy as sa

revision = 'j4k5l6m7n8o9'
down_revision = 'i3j4k5l6m7n8'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('users', sa.Column('id_card_token', sa.String(64), nullable=True, unique=True))
    op.create_index('ix_users_id_card_token', 'users', ['id_card_token'], unique=True)


def downgrade() -> None:
    op.drop_index('ix_users_id_card_token', table_name='users')
    op.drop_column('users', 'id_card_token')
