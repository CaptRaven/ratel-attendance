"""add unique constraint on attendance employee_id+session_id

Revision ID: b7a2f4e91c3d
Revises: 9c8e7f1a2d3c
Create Date: 2026-06-19 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b7a2f4e91c3d'
down_revision: Union[str, None] = '9c8e7f1a2d3c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # A race condition between the "check existing" read and the insert let
    # double-taps / retried requests create more than one attendance row for
    # the same (employee_id, session_id) pair. That left some employees with
    # duplicate records, which crashes every later lookup that assumes at
    # most one row (.scalar_one_or_none() raises MultipleResultsFound).
    #
    # Before adding the constraint, merge any existing duplicates into a
    # single row per (employee_id, session_id): keep the earliest
    # checked_in_at, prefer a non-null checked_out_at/hours_clocked if any
    # duplicate has one, then delete the rest.
    op.execute("""
        WITH ranked AS (
            SELECT
                id,
                employee_id,
                session_id,
                ROW_NUMBER() OVER (
                    PARTITION BY employee_id, session_id
                    ORDER BY
                        (checked_out_at IS NOT NULL) DESC,
                        checked_in_at ASC
                ) AS rn
            FROM attendance
        )
        DELETE FROM attendance a
        USING ranked r
        WHERE a.id = r.id AND r.rn > 1;
    """)

    op.create_unique_constraint(
        'uq_attendance_employee_session',
        'attendance',
        ['employee_id', 'session_id'],
    )


def downgrade() -> None:
    op.drop_constraint('uq_attendance_employee_session', 'attendance', type_='unique')
