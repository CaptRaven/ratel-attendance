"""merge_job_openings_and_work_report

Revision ID: d36830833833
Revises: a1b2c3d4e5f6, c9d8e7f6a5b4
Create Date: 2026-09-22 10:31:51.197016

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd36830833833'
down_revision: Union[str, None] = ('a1b2c3d4e5f6', 'c9d8e7f6a5b4')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
