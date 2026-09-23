"""add_referee2_fields

Revision ID: h2i3j4k5l6m7
Revises: g1h2i3j4k5l6
Create Date: 2026-09-23 14:05:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'h2i3j4k5l6m7'
down_revision: Union[str, None] = 'g1h2i3j4k5l6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_columns = [col['name'] for col in inspector.get_columns('users')]

    columns_to_add = [
        ('referee2_name', sa.String(length=255)),
        ('referee2_phone', sa.String(length=50)),
        ('referee2_email', sa.String(length=255)),
        ('referee2_relationship', sa.String(length=100)),
        ('referee2_notes', sa.Text()),
    ]

    for col_name, col_type in columns_to_add:
        if col_name not in existing_columns:
            op.add_column('users', sa.Column(col_name, col_type, nullable=True))


def downgrade() -> None:
    columns_to_drop = [
        'referee2_name',
        'referee2_phone',
        'referee2_email',
        'referee2_relationship',
        'referee2_notes',
    ]
    for col_name in columns_to_drop:
        try:
            op.drop_column('users', col_name)
        except Exception:
            pass
