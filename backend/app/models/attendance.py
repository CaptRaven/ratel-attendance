import uuid
from datetime import datetime
from sqlalchemy import String, DateTime, ForeignKey, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base
import enum


class AttendanceStatus(str, enum.Enum):
    PRESENT = "present"
    LATE = "late"


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
    checked_in_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow, nullable=False
    )
    # Store token used — full audit trail
    token_used: Mapped[str] = mapped_column(String(512), nullable=False)

    employee: Mapped["User"] = relationship("User", lazy="selectin")  # noqa: F821