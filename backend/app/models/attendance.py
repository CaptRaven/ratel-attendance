import uuid
from datetime import datetime
from sqlalchemy import String, DateTime, ForeignKey, Enum as SAEnum, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base
import enum


class AttendanceStatus(str, enum.Enum):
    PRESENT = "present"
    LATE = "late"


class CheckStatus(str, enum.Enum):
    CHECKED_IN = "checked_in"
    CHECKED_OUT = "checked_out"


class Attendance(Base):
    __tablename__ = "attendance"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    employee_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True
    )
    session_id: Mapped[str] = mapped_column(
        String(100), nullable=False, index=True
    )
    location_id: Mapped[str] = mapped_column(String(100), nullable=False)
    status: Mapped[AttendanceStatus] = mapped_column(
        SAEnum(AttendanceStatus), default=AttendanceStatus.PRESENT, nullable=False
    )
    check_status: Mapped[CheckStatus] = mapped_column(
        SAEnum(
            CheckStatus,
            name="checkstatus",
            values_callable=lambda enum_cls: [member.value for member in enum_cls],
        ),
        default=CheckStatus.CHECKED_IN,
        nullable=False,
    )
    checked_in_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow, nullable=False
    )
    checked_out_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    # Hours clocked — computed on checkout
    hours_clocked: Mapped[float | None] = mapped_column(
        nullable=True
    )
    shift: Mapped[str | None] = mapped_column(String(50), nullable=True)
    token_used: Mapped[str] = mapped_column(String(512), nullable=False)

    employee: Mapped["User"] = relationship("User", lazy="selectin")  # noqa: F821

    __table_args__ = (
        Index("idx_attendance_employee_session", "employee_id", "session_id"),
        Index(
            "idx_attendance_employee_status_checked_in",
            "employee_id",
            "check_status",
            "checked_in_at",
        ),
    )
