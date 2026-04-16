from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.models.user import UserRole


class LoginRequest(BaseModel):
    email: str
    password: str = Field(..., min_length=6)


class UserCreate(BaseModel):
    email: str
    full_name: str = Field(..., min_length=2, max_length=255)
    employee_id: str = Field(..., min_length=2, max_length=50)
    password: str = Field(..., min_length=6)
    role: UserRole = UserRole.EMPLOYEE
    location_id: str = Field(default="ratel-hq", min_length=2, max_length=100)


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    email: str
    full_name: str
    employee_id: str
    role: UserRole
    is_active: bool
    location_id: str
    created_at: datetime
    updated_at: datetime


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse
