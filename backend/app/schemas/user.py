from pydantic import BaseModel, EmailStr, Field, ConfigDict
from uuid import UUID
from datetime import datetime
from typing import Optional
from app.models.user import UserRole


class UserCreate(BaseModel):
    email: str
    full_name: str = Field(..., min_length=2, max_length=255)
    employee_id: str = Field(..., min_length=2, max_length=50)
    password: Optional[str] = Field(None, min_length=8, max_length=128)
    role: UserRole = UserRole.EMPLOYEE
    location_id: str = Field(default="ratel-hq", max_length=100)
    department_id: Optional[UUID] = None
    phone_number: Optional[str] = None
    address: Optional[str] = None
    designation: Optional[str] = None
    expected_days_per_week: Optional[int] = 5
    referee_name: Optional[str] = None
    referee_phone: Optional[str] = None
    referee_email: Optional[str] = None
    referee_relationship: Optional[str] = None
    referee_notes: Optional[str] = None
    referee2_name: Optional[str] = None
    referee2_phone: Optional[str] = None
    referee2_email: Optional[str] = None
    referee2_relationship: Optional[str] = None
    referee2_notes: Optional[str] = None


class UserUpdate(BaseModel):
    email: Optional[str] = None
    full_name: Optional[str] = Field(None, min_length=2, max_length=255)
    employee_id: Optional[str] = Field(None, min_length=2, max_length=50)
    password: Optional[str] = Field(None, min_length=8, max_length=128)
    role: Optional[UserRole] = None
    location_id: Optional[str] = Field(None, max_length=100)
    department_id: Optional[UUID] = None
    phone_number: Optional[str] = None
    address: Optional[str] = None
    designation: Optional[str] = None
    expected_days_per_week: Optional[int] = None
    referee_name: Optional[str] = None
    referee_phone: Optional[str] = None
    referee_email: Optional[str] = None
    referee_relationship: Optional[str] = None
    referee_notes: Optional[str] = None
    referee2_name: Optional[str] = None
    referee2_phone: Optional[str] = None
    referee2_email: Optional[str] = None
    referee2_relationship: Optional[str] = None
    referee2_notes: Optional[str] = None


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    email: str
    full_name: str
    employee_id: str
    role: UserRole
    is_active: bool
    is_face_enrolled: bool = False
    location_id: Optional[str] = "ratel-hq"
    department_id: Optional[UUID] = None
    department_name: Optional[str] = None
    phone_number: Optional[str] = None
    address: Optional[str] = None
    designation: Optional[str] = None
    expected_days_per_week: Optional[int] = 5
    referee_name: Optional[str] = None
    referee_phone: Optional[str] = None
    referee_email: Optional[str] = None
    referee_relationship: Optional[str] = None
    referee_notes: Optional[str] = None
    referee2_name: Optional[str] = None
    referee2_phone: Optional[str] = None
    referee2_email: Optional[str] = None
    referee2_relationship: Optional[str] = None
    referee2_notes: Optional[str] = None
    referee_pdf_filename: Optional[str] = None
    days_present: int = 0
    created_at: Optional[datetime] = None

    @classmethod
    def from_orm_with_dept(cls, user, days_present: int = 0) -> "UserResponse":
        obj = cls.model_validate(user)
        try:
            from sqlalchemy.orm import attributes
            state = attributes.instance_state(user)
            if "department" in state.dict and state.dict["department"]:
                obj.department_name = state.dict["department"].name
        except Exception:
            pass
        obj.days_present = days_present
        return obj



class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class LoginRequest(BaseModel):
    email: str = Field(..., min_length=1)
    password: str = Field(..., min_length=1)


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(..., min_length=1)
    new_password: str = Field(..., min_length=6, max_length=128)


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str = Field(..., min_length=1)
    new_password: str = Field(..., min_length=6, max_length=128)


class ProfileUpdateRequest(BaseModel):
    full_name: Optional[str] = Field(None, min_length=2, max_length=255)
    email: Optional[EmailStr] = None