"""add_user_profile_and_referee_fields

Revision ID: g1h2i3j4k5l6
Revises: f9e8d7c6b5a4
Create Date: 2026-09-23 13:38:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'g1h2i3j4k5l6'
down_revision: Union[str, None] = 'f9e8d7c6b5a4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_columns = [col['name'] for col in inspector.get_columns('users')]

    columns_to_add = [
        ('phone_number', sa.String(length=50)),
        ('address', sa.String(length=500)),
        ('designation', sa.String(length=255)),
        ('referee_name', sa.String(length=255)),
        ('referee_phone', sa.String(length=50)),
        ('referee_email', sa.String(length=255)),
        ('referee_relationship', sa.String(length=100)),
        ('referee_notes', sa.Text()),
        ('referee_pdf_filename', sa.String(length=255)),
    ]

    for col_name, col_type in columns_to_add:
        if col_name not in existing_columns:
            op.add_column('users', sa.Column(col_name, col_type, nullable=True))


def downgrade() -> None:
    columns_to_drop = [
        'phone_number',
        'address',
        'designation',
        'referee_name',
        'referee_phone',
        'referee_email',
        'referee_relationship',
        'referee_notes',
        'referee_pdf_filename',
    ]
    for col_name in columns_to_drop:
        try:
            op.drop_column('users', col_name)
        except Exception:
            pass
