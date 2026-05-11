"""add_face_recognition_fields

Revision ID: 649a35b6ebae
Revises: d1b433aea498
Create Date: 2026-05-11 14:05:54.789903

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '649a35b6ebae'
down_revision: Union[str, None] = 'd1b433aea498'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('users', sa.Column('face_encoding', sa.String(), nullable=True))
    op.add_column('users', sa.Column('is_face_enrolled', sa.Boolean(), server_default='false', nullable=False))


def downgrade() -> None:
    op.drop_column('users', 'is_face_enrolled')
    op.drop_column('users', 'face_encoding')
