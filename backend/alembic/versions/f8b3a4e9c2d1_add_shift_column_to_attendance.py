"""add shift column to attendance

Revision ID: f8b3a4e9c2d1
Revises: e3c9a6ba44ac
Create Date: 2026-05-18 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f8b3a4e9c2d1'
down_revision: Union[str, None] = 'e3c9a6ba44ac'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('attendance', sa.Column('shift', sa.String(length=50), nullable=True))


def downgrade() -> None:
    op.drop_column('attendance', 'shift')
