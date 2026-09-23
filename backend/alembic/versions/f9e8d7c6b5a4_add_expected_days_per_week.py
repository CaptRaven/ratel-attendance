"""add_expected_days_per_week

Revision ID: f9e8d7c6b5a4
Revises: e5f6a7b8c9d0
Create Date: 2026-09-23 12:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f9e8d7c6b5a4'
down_revision: Union[str, None] = 'e5f6a7b8c9d0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('users', sa.Column('expected_days_per_week', sa.Integer(), nullable=True, server_default='5'))


def downgrade() -> None:
    op.drop_column('users', 'expected_days_per_week')
