from typing import Optional
from pydantic import BaseModel, Field, ConfigDict
from uuid import UUID
from datetime import datetime
from app.models.attendance import AttendanceStatus
from app.schemas.user import UserResponse


class CheckInRequest(BaseModel):
    qr_token: str = Field(..., min_length=10)
    employee_id: str = Field(..., min_length=2)
    work_report: Optional[str] = Field(None, max_length=2000)


class AttendanceResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    session_id: str
    location_id: str
    status: AttendanceStatus
    checked_in_at: datetime
    checked_out_at: Optional[datetime] = None
    hours_clocked: Optional[float] = None
    work_report: Optional[str] = None
    employee: UserResponse