"""add media posts table for website blog and media management

Revision ID: m0e1d2i3a4p5
Revises: p0q1r2s3t4u5
Create Date: 2026-10-29 10:10:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = 'm0e1d2i3a4p5'
down_revision: Union[str, None] = 'p0q1r2s3t4u5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'media_posts',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column('title', sa.String(length=255), nullable=False),
        sa.Column('slug', sa.String(length=255), nullable=False),
        sa.Column('category', sa.String(length=100), nullable=False, server_default='News'),
        sa.Column('summary', sa.Text(), nullable=False),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('featured_image', sa.String(length=500), nullable=True),
        sa.Column('author', sa.String(length=150), nullable=False, server_default='Ratel Media Team'),
        sa.Column('read_time', sa.String(length=50), nullable=False, server_default='3 min read'),
        sa.Column('tags', sa.JSON(), nullable=True),
        sa.Column('is_published', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('views_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('published_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index(op.f('ix_media_posts_title'), 'media_posts', ['title'], unique=False)
    op.create_index(op.f('ix_media_posts_slug'), 'media_posts', ['slug'], unique=True)
    op.create_index(op.f('ix_media_posts_category'), 'media_posts', ['category'], unique=False)
    op.create_index(op.f('ix_media_posts_is_published'), 'media_posts', ['is_published'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_media_posts_is_published'), table_name='media_posts')
    op.drop_index(op.f('ix_media_posts_category'), table_name='media_posts')
    op.drop_index(op.f('ix_media_posts_slug'), table_name='media_posts')
    op.drop_index(op.f('ix_media_posts_title'), table_name='media_posts')
    op.drop_table('media_posts')
