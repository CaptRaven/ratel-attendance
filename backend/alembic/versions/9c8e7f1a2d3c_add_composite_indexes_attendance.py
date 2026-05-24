"""add composite indexes to attendance

Revision ID: 9c8e7f1a2d3c
Revises: f8b3a4e9c2d1
Create Date: 2026-05-24 06:45:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '9c8e7f1a2d3c'
down_revision: Union[str, None] = 'f8b3a4e9c2d1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_index(
        'idx_attendance_employee_session',
        'attendance',
        ['employee_id', 'session_id'],
    )
    op.create_index(
        'idx_attendance_employee_status_checked_in',
        'attendance',
        ['employee_id', 'check_status', 'checked_in_at'],
    )


def downgrade() -> None:
    op.drop_index('idx_attendance_employee_session', 'attendance')
    op.drop_index('idx_attendance_employee_status_checked_in', 'attendance')
