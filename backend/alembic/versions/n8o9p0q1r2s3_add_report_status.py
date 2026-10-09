"""add report_status and review fields to attendance

Revision ID: n8o9p0q1r2s3
Revises: m7n8o9p0q1r2
Create Date: 2026-10-09 14:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = 'n8o9p0q1r2s3'
down_revision = 'm7n8o9p0q1r2'
branch_labels = None
depends_on = None


def upgrade():
    op.execute("CREATE TYPE reportstatus AS ENUM ('pending', 'approved', 'rejected')")
    op.add_column('attendance', sa.Column('report_status', sa.Enum('pending', 'approved', 'rejected', name='reportstatus'), nullable=True))
    op.add_column('attendance', sa.Column('report_reviewed_by_id', postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column('attendance', sa.Column('report_reviewed_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('attendance', sa.Column('report_rejection_reason', sa.Text(), nullable=True))
    op.create_foreign_key('fk_attendance_reviewed_by', 'attendance', 'users', ['report_reviewed_by_id'], ['id'])


def downgrade():
    op.drop_constraint('fk_attendance_reviewed_by', 'attendance', type_='foreignkey')
    op.drop_column('attendance', 'report_rejection_reason')
    op.drop_column('attendance', 'report_reviewed_at')
    op.drop_column('attendance', 'report_reviewed_by_id')
    op.drop_column('attendance', 'report_status')
    op.execute("DROP TYPE reportstatus")
