from pydantic import BaseModel, EmailStr, Field, ConfigDict
from uuid import UUID
from datetime import datetime
from typing import Optional
from app.models.user import UserRole


class UserCreate(BaseModel):
    email: EmailStr
    full_name: str = Field(..., min_length=2, max_length=255)
    employee_id: str = Field(..., min_length=2, max_length=50)
    password: Optional[str] = Field(None, min_length=8, max_length=128)
    role: UserRole = UserRole.EMPLOYEE
    location_id: str = Field(default="ratel-hq", max_length=100)
    department_id: Optional[UUID] = None


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    email: EmailStr
    full_name: str
    employee_id: str
    role: UserRole
    is_active: bool
    location_id: str
    department_id: Optional[UUID] = None
    department_name: Optional[str] = None
    created_at: datetime

    @classmethod
    def from_orm_with_dept(cls, user) -> "UserResponse":
        obj = cls.model_validate(user)
        if user.department:
            obj.department_name = user.department.name
        return obj


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=1)