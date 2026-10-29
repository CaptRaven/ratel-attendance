"""add academy courses and enrollments tables

Revision ID: p0q1r2s3t4u5
Revises: o9p0q1r2s3t4
Create Date: 2026-10-28 23:45:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = 'p0q1r2s3t4u5'
down_revision: Union[str, None] = 'o9p0q1r2s3t4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. academy_courses
    op.create_table(
        'academy_courses',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column('title', sa.String(length=255), nullable=False),
        sa.Column('code', sa.String(length=50), nullable=True),
        sa.Column('category', sa.String(length=100), nullable=False),
        sa.Column('description', sa.Text(), nullable=False),
        sa.Column('syllabus', sa.JSON(), nullable=True),
        sa.Column('prerequisites', sa.JSON(), nullable=True),
        sa.Column('instructor', sa.String(length=255), nullable=True),
        sa.Column('location', sa.String(length=255), nullable=False, server_default='Ratel Tech Campus, Kano'),
        sa.Column('format', sa.String(length=50), nullable=False, server_default='Onsite'),
        sa.Column('duration', sa.String(length=100), nullable=False),
        sa.Column('schedule', sa.String(length=255), nullable=True),
        sa.Column('fee', sa.String(length=100), nullable=False, server_default='Free'),
        sa.Column('status', sa.String(length=50), nullable=False, server_default='upcoming'),
        sa.Column('start_date', sa.String(length=100), nullable=True),
        sa.Column('end_date', sa.String(length=100), nullable=True),
        sa.Column('capacity', sa.Integer(), nullable=True, server_default='30'),
        sa.Column('enrolled_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index('ix_academy_courses_title', 'academy_courses', ['title'], unique=False)
    op.create_index('ix_academy_courses_code', 'academy_courses', ['code'], unique=False)
    op.create_index('ix_academy_courses_category', 'academy_courses', ['category'], unique=False)
    op.create_index('ix_academy_courses_status', 'academy_courses', ['status'], unique=False)
    op.create_index('ix_academy_courses_is_active', 'academy_courses', ['is_active'], unique=False)

    # 2. academy_enrollments
    op.create_table(
        'academy_enrollments',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column('course_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('academy_courses.id', ondelete='SET NULL'), nullable=True),
        sa.Column('course_title', sa.String(length=255), nullable=False),
        sa.Column('full_name', sa.String(length=255), nullable=False),
        sa.Column('email', sa.String(length=255), nullable=False),
        sa.Column('phone', sa.String(length=100), nullable=False),
        sa.Column('education_level', sa.String(length=100), nullable=True),
        sa.Column('experience_level', sa.String(length=100), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('status', sa.String(length=50), nullable=False, server_default='pending'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index('ix_academy_enrollments_course_id', 'academy_enrollments', ['course_id'], unique=False)
    op.create_index('ix_academy_enrollments_full_name', 'academy_enrollments', ['full_name'], unique=False)
    op.create_index('ix_academy_enrollments_email', 'academy_enrollments', ['email'], unique=False)
    op.create_index('ix_academy_enrollments_status', 'academy_enrollments', ['status'], unique=False)


def downgrade() -> None:
    op.drop_index('ix_academy_enrollments_status', table_name='academy_enrollments')
    op.drop_index('ix_academy_enrollments_email', table_name='academy_enrollments')
    op.drop_index('ix_academy_enrollments_full_name', table_name='academy_enrollments')
    op.drop_index('ix_academy_enrollments_course_id', table_name='academy_enrollments')
    op.drop_table('academy_enrollments')

    op.drop_index('ix_academy_courses_is_active', table_name='academy_courses')
    op.drop_index('ix_academy_courses_status', table_name='academy_courses')
    op.drop_index('ix_academy_courses_category', table_name='academy_courses')
    op.drop_index('ix_academy_courses_code', table_name='academy_courses')
    op.drop_index('ix_academy_courses_title', table_name='academy_courses')
    op.drop_table('academy_courses')
