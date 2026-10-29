from __future__ import annotations
from pydantic import BaseModel, Field, ConfigDict
from uuid import UUID
from datetime import datetime
from typing import Optional, List


class AcademyCourseBase(BaseModel):
    title: str = Field(..., min_length=2, max_length=255)
    code: Optional[str] = Field(None, max_length=50)
    category: str = Field(..., min_length=2, max_length=100)
    description: str = Field(...)
    syllabus: List[str] = Field(default_factory=list)
    prerequisites: List[str] = Field(default_factory=list)
    instructor: Optional[str] = Field(None, max_length=255)
    location: str = Field("Ratel Tech Campus, Kano", max_length=255)
    format: str = Field("Onsite", max_length=50)
    duration: str = Field(..., min_length=1, max_length=100)
    schedule: Optional[str] = Field(None, max_length=255)
    fee: str = Field("Free", max_length=100)
    status: str = Field("upcoming", max_length=50)  # upcoming, ongoing, completed, registration_open
    start_date: Optional[str] = Field(None, max_length=100)
    end_date: Optional[str] = Field(None, max_length=100)
    capacity: Optional[int] = Field(30, ge=1)


class AcademyCourseCreate(AcademyCourseBase):
    pass


class AcademyCourseUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=2, max_length=255)
    code: Optional[str] = Field(None, max_length=50)
    category: Optional[str] = Field(None, min_length=2, max_length=100)
    description: Optional[str] = None
    syllabus: Optional[List[str]] = None
    prerequisites: Optional[List[str]] = None
    instructor: Optional[str] = Field(None, max_length=255)
    location: Optional[str] = Field(None, max_length=255)
    format: Optional[str] = Field(None, max_length=50)
    duration: Optional[str] = Field(None, min_length=1, max_length=100)
    schedule: Optional[str] = Field(None, max_length=255)
    fee: Optional[str] = Field(None, max_length=100)
    status: Optional[str] = Field(None, max_length=50)
    start_date: Optional[str] = Field(None, max_length=100)
    end_date: Optional[str] = Field(None, max_length=100)
    capacity: Optional[int] = None
    is_active: Optional[bool] = None


class AcademyCourseResponse(AcademyCourseBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    enrolled_count: int
    is_active: bool
    created_at: datetime
    updated_at: datetime


class AcademyEnrollmentBase(BaseModel):
    course_id: Optional[UUID] = None
    course_title: Optional[str] = None
    full_name: str = Field(..., min_length=2, max_length=255)
    email: str = Field(..., min_length=5, max_length=255)
    phone: str = Field(..., min_length=6, max_length=100)
    education_level: Optional[str] = Field(None, max_length=100)
    experience_level: Optional[str] = Field(None, max_length=100)
    notes: Optional[str] = None


class AcademyEnrollmentCreate(AcademyEnrollmentBase):
    pass


class AcademyEnrollmentResponse(AcademyEnrollmentBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    status: str
    created_at: datetime
    updated_at: datetime


class AcademyEnrollmentStatusUpdate(BaseModel):
    status: str = Field(..., min_length=2, max_length=50)
