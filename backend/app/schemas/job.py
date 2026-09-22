from __future__ import annotations
from pydantic import BaseModel, Field, ConfigDict
from uuid import UUID
from datetime import datetime
from typing import Optional, List


class JobOpeningBase(BaseModel):
    title: str = Field(..., min_length=2, max_length=255)
    department: str = Field(..., min_length=2, max_length=255)
    category: str = Field(..., min_length=2, max_length=100)
    location: str = Field(..., min_length=2, max_length=255)
    type: str = Field("Full-time", min_length=2, max_length=100)
    experience: str = Field(..., min_length=1, max_length=100)
    description: str = Field(...)
    requirements: List[str] = Field(default_factory=list)


class JobOpeningCreate(JobOpeningBase):
    pass


class JobOpeningUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=2, max_length=255)
    department: Optional[str] = Field(None, min_length=2, max_length=255)
    category: Optional[str] = Field(None, min_length=2, max_length=100)
    location: Optional[str] = Field(None, min_length=2, max_length=255)
    type: Optional[str] = Field(None, min_length=2, max_length=100)
    experience: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = None
    requirements: Optional[List[str]] = None
    is_active: Optional[bool] = None


class JobOpeningResponse(JobOpeningBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    is_active: bool
    created_at: datetime
    updated_at: datetime


class JobApplicationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    job_id: Optional[UUID] = None
    job_title: str
    full_name: str
    email: str
    phone: str
    portfolio_url: Optional[str] = None
    cover_note: Optional[str] = None
    resume_filename: Optional[str] = None
    status: str
    created_at: datetime
    updated_at: datetime


class JobApplicationStatusUpdate(BaseModel):
    status: str = Field(..., min_length=2, max_length=50)

