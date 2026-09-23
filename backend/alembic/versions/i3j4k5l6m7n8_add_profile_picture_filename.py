"""add_profile_picture_filename

Revision ID: i3j4k5l6m7n8
Revises: h2i3j4k5l6m7
Create Date: 2026-09-23 15:40:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'i3j4k5l6m7n8'
down_revision: Union[str, None] = 'h2i3j4k5l6m7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_columns = [col['name'] for col in inspector.get_columns('users')]

    if 'profile_picture_filename' not in existing_columns:
        op.add_column('users', sa.Column('profile_picture_filename', sa.String(length=255), nullable=True))


def downgrade() -> None:
    try:
        op.drop_column('users', 'profile_picture_filename')
    except Exception:
        pass
