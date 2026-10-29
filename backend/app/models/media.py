from __future__ import annotations
import uuid
from typing import Optional, List
from datetime import datetime
from sqlalchemy import String, Boolean, DateTime, Text, JSON, Integer
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base


class MediaPost(Base):
    __tablename__ = "media_posts"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    slug: Mapped[str] = mapped_column(String(255), nullable=False, unique=True, index=True)
    category: Mapped[str] = mapped_column(String(100), nullable=False, index=True, default="News")
    summary: Mapped[str] = mapped_column(Text, nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    featured_image: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    author: Mapped[str] = mapped_column(String(150), nullable=False, default="Ratel Media Team")
    read_time: Mapped[str] = mapped_column(String(50), nullable=False, default="3 min read")
    tags: Mapped[Optional[list]] = mapped_column(JSON, nullable=True, default=list)
    is_published: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False, index=True)
    views_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    published_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow, nullable=False
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
