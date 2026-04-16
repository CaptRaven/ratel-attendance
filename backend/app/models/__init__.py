# Import all models here so Alembic can detect them
from app.models.user import User, UserRole
from app.models.attendance import Attendance, AttendanceStatus

__all__ = ["User", "UserRole", "Attendance", "AttendanceStatus"]