"""add work_report column to attendance

Revision ID: c9d8e7f6a5b4
Revises: f8b3a4e9c2d1
Create Date: 2026-09-18 10:15:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c9d8e7f6a5b4'
down_revision: Union[str, None] = 'b7a2f4e91c3d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('attendance', sa.Column('work_report', sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column('attendance', 'work_report')
