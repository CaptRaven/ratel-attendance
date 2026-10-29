from typing import Optional, List
from datetime import datetime
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field


class MediaPostBase(BaseModel):
    title: str = Field(..., max_length=255)
    slug: Optional[str] = Field(None, max_length=255)
    category: str = Field("News", max_length=100)
    summary: str
    content: str
    featured_image: Optional[str] = None
    author: str = Field("Ratel Media Team", max_length=150)
    read_time: str = Field("3 min read", max_length=50)
    tags: Optional[List[str]] = []
    is_published: bool = True
    published_at: Optional[datetime] = None


class MediaPostCreate(MediaPostBase):
    pass


class MediaPostUpdate(BaseModel):
    title: Optional[str] = None
    slug: Optional[str] = None
    category: Optional[str] = None
    summary: Optional[str] = None
    content: Optional[str] = None
    featured_image: Optional[str] = None
    author: Optional[str] = None
    read_time: Optional[str] = None
    tags: Optional[List[str]] = None
    is_published: Optional[bool] = None
    published_at: Optional[datetime] = None


class MediaPostResponse(MediaPostBase):
    id: UUID
    views_count: int = 0
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
