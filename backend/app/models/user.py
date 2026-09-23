from __future__ import annotations
import uuid
from typing import Optional
from datetime import datetime
from sqlalchemy import String, Boolean, DateTime, Enum as SAEnum, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base
import enum


class UserRole(str, enum.Enum):
    ADMIN = "admin"
    EMPLOYEE = "employee"


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    email: Mapped[str] = mapped_column(
        String(255), unique=True, nullable=False, index=True
    )
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    employee_id: Mapped[str] = mapped_column(
        String(50), unique=True, nullable=False, index=True
    )
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[UserRole] = mapped_column(
        SAEnum(UserRole), default=UserRole.EMPLOYEE, nullable=False
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean, default=True, nullable=False
    )
    department_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("departments.id"), nullable=True
    )
    location_id: Mapped[str] = mapped_column(
        String(100), nullable=False, default="ratel-hq"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False,
    )

    # Personal & Job Details
    phone_number: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    address: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    designation: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    # Referee Information
    referee_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    referee_phone: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    referee_email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    referee_relationship: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    referee_notes: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    referee_pdf_filename: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    # Face Recognition
    face_encoding: Mapped[Optional[str]] = mapped_column(String, nullable=True)  # Store as JSON string of list
    is_face_enrolled: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False
    )

    department: Mapped[Optional["Department"]] = relationship(  # noqa: F821
        "Department",
        back_populates="employees",
        lazy="selectin",
    )

