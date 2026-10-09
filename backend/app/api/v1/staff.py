"""
Staff self-service portal.
Employees log in with Employee ID + PIN (default: 1234).
They can view attendance history, submit work reports, change PIN, and update profile.
No admin privileges — employees only see their own data.
"""
from fastapi import APIRouter, Depends, HTTPException, Request, Response, Cookie, Query
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, func
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime, timezone, timedelta
from collections import defaultdict
import uuid
import secrets
import bcrypt

from app.database import get_db
from app.models.user import User
from app.models.attendance import Attendance
from app.core.logging import logger
from app.api.deps import require_admin
from slowapi import Limiter
from slowapi.util import get_remote_address

router = APIRouter(tags=["Staff Portal"])
limiter = Limiter(key_func=get_remote_address)
templates = Jinja2Templates(directory="app/templates")

WAT = timezone(timedelta(hours=1))
STAFF_COOKIE = "ratel_staff"
COOKIE_MAX_AGE = 60 * 60 * 8
SESSION_TTL = timedelta(hours=8)
DEFAULT_PIN = "1234"


# ── Jinja2 filters ────────────────────────────────────────────────────────────

def _to_wat(dt, fmt: str = "%I:%M %p") -> str:
    if dt is None:
        return "—"
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(WAT).strftime(fmt)


templates.env.filters["wat"] = _to_wat
templates.env.filters["wat_date"] = lambda dt: _to_wat(dt, "%a, %d %b %Y")


# ── PIN helpers ───────────────────────────────────────────────────────────────

def _hash_pin(pin: str) -> str:
    return bcrypt.hashpw(pin.encode(), bcrypt.gensalt()).decode()


def _verify_pin(pin: str, hashed: Optional[str]) -> bool:
    if not hashed:
        return pin == DEFAULT_PIN
    try:
        return bcrypt.checkpw(pin.encode(), hashed.encode())
    except Exception:
        return False


# ── Session helpers ───────────────────────────────────────────────────────────

def _make_session_token() -> str:
    return secrets.token_urlsafe(32)


async def _get_current_employee(db: AsyncSession, staff_token: Optional[str]) -> Optional[User]:
    if not staff_token:
        return None
    now = datetime.now(timezone.utc)
    result = await db.execute(
        select(User).where(
            User.staff_session_token == staff_token,
            User.is_active == True,  # noqa: E712
            User.staff_session_expires_at > now,
        )
    )
    return result.scalar_one_or_none()


async def _require_employee(
    request: Request,
    db: AsyncSession = Depends(get_db),
    staff_token: Optional[str] = Cookie(default=None, alias=STAFF_COOKIE),
) -> User:
    employee = await _get_current_employee(db, staff_token)
    if not employee:
        raise HTTPException(status_code=302, headers={"Location": "/staff/login"})
    return employee


# ── Page routes ───────────────────────────────────────────────────────────────

@router.get("/staff/login", response_class=HTMLResponse)
async def staff_login_page(request: Request):
    return templates.TemplateResponse(request=request, name="staff_login.html", context={})


@router.get("/staff", response_class=HTMLResponse)
async def staff_dashboard(
    request: Request,
    db: AsyncSession = Depends(get_db),
    employee: User = Depends(_require_employee),
):
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    month_start = today_start.replace(day=1)

    today_result = await db.execute(
        select(Attendance)
        .where(Attendance.employee_id == employee.id, Attendance.checked_in_at >= today_start)
        .order_by(desc(Attendance.checked_in_at))
        .limit(1)
    )
    today_att = today_result.scalar_one_or_none()

    stats_result = await db.execute(
        select(
            func.count(Attendance.id).label("days"),
            func.coalesce(func.sum(Attendance.hours_clocked), 0).label("hours"),
        ).where(
            Attendance.employee_id == employee.id,
            Attendance.checked_in_at >= month_start,
        )
    )
    stats = stats_result.one()

    return templates.TemplateResponse(
        request=request,
        name="staff_dashboard.html",
        context={
            "employee": employee,
            "today_att": today_att,
            "using_default_pin": employee.staff_pin_hash is None,
            "month_days": stats.days,
            "month_hours": round(float(stats.hours or 0), 1),
            "month_name": now.astimezone(WAT).strftime("%B"),
        },
    )


@router.get("/staff/attendance", response_class=HTMLResponse)
async def staff_attendance_history(
    request: Request,
    month: Optional[str] = Query(default=None, pattern=r"^\d{4}-\d{2}$"),
    db: AsyncSession = Depends(get_db),
    employee: User = Depends(_require_employee),
):
    # Collect available months from all records for the dropdown
    all_dts_result = await db.execute(
        select(Attendance.checked_in_at)
        .where(Attendance.employee_id == employee.id)
        .order_by(desc(Attendance.checked_in_at))
        .limit(365)
    )
    seen_months: set = set()
    available_months = []
    for (dt,) in all_dts_result.all():
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        key = dt.astimezone(WAT).strftime("%Y-%m")
        if key not in seen_months:
            seen_months.add(key)
            available_months.append({"value": key, "label": dt.astimezone(WAT).strftime("%B %Y")})

    # Build query filters
    filters = [Attendance.employee_id == employee.id]
    selected_month = None
    if month:
        try:
            year, mon = int(month[:4]), int(month[5:7])
            start_wat = datetime(year, mon, 1, tzinfo=WAT)
            end_wat = (
                datetime(year, mon + 1, 1, tzinfo=WAT) if mon < 12
                else datetime(year + 1, 1, 1, tzinfo=WAT)
            )
            filters += [
                Attendance.checked_in_at >= start_wat.astimezone(timezone.utc),
                Attendance.checked_in_at < end_wat.astimezone(timezone.utc),
            ]
            selected_month = month
        except (ValueError, IndexError):
            pass

    result = await db.execute(
        select(Attendance).where(*filters).order_by(desc(Attendance.checked_in_at)).limit(180)
    )
    records = result.scalars().all()

    # Group records by WAT month for the template
    grouped: dict = defaultdict(list)
    for r in records:
        dt = r.checked_in_at if r.checked_in_at.tzinfo else r.checked_in_at.replace(tzinfo=timezone.utc)
        grouped[dt.astimezone(WAT).strftime("%B %Y")].append(r)

    return templates.TemplateResponse(
        request=request,
        name="staff_attendance.html",
        context={
            "employee": employee,
            "grouped_records": dict(grouped),
            "available_months": available_months,
            "selected_month": selected_month,
        },
    )


@router.get("/staff/profile", response_class=HTMLResponse)
async def staff_profile_page(
    request: Request,
    employee: User = Depends(_require_employee),
):
    return templates.TemplateResponse(
        request=request,
        name="staff_profile.html",
        context={
            "employee": employee,
            "using_default_pin": employee.staff_pin_hash is None,
        },
    )


# ── API routes ────────────────────────────────────────────────────────────────

class StaffLoginRequest(BaseModel):
    employee_id: str = Field(..., min_length=1)
    pin: str = Field(..., min_length=4, max_length=20)


@router.post("/api/v1/staff/login")
@limiter.limit("10/minute")
async def staff_login(
    request: Request,
    payload: StaffLoginRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    emp_id = payload.employee_id.strip().upper().replace(" ", "-")
    result = await db.execute(
        select(User).where(User.employee_id == emp_id, User.is_active == True)  # noqa: E712
    )
    employee = result.scalar_one_or_none()

    if not employee or not _verify_pin(payload.pin, employee.staff_pin_hash):
        raise HTTPException(status_code=401, detail="Invalid Employee ID or PIN.")

    token = _make_session_token()
    employee.staff_session_token = token
    employee.staff_session_expires_at = datetime.now(timezone.utc) + SESSION_TTL
    await db.flush()

    response.set_cookie(
        key=STAFF_COOKIE, value=token, max_age=COOKIE_MAX_AGE,
        httponly=True, secure=True, samesite="lax", path="/",
    )
    logger.info("staff_login", employee_id=employee.employee_id)
    return {"ok": True}


@router.post("/api/v1/staff/logout")
async def staff_logout(
    response: Response,
    db: AsyncSession = Depends(get_db),
    employee: User = Depends(_require_employee),
):
    employee.staff_session_token = None
    employee.staff_session_expires_at = None
    await db.flush()
    response.delete_cookie(STAFF_COOKIE, path="/")
    return {"ok": True}


class ChangePinRequest(BaseModel):
    current_pin: str = Field(..., min_length=4, max_length=20)
    new_pin: str = Field(..., min_length=4, max_length=20)


@router.post("/api/v1/staff/change-pin")
@limiter.limit("10/minute")
async def change_pin(
    request: Request,
    payload: ChangePinRequest,
    db: AsyncSession = Depends(get_db),
    employee: User = Depends(_require_employee),
):
    if not _verify_pin(payload.current_pin, employee.staff_pin_hash):
        raise HTTPException(status_code=400, detail="Current PIN is incorrect.")
    if payload.new_pin == DEFAULT_PIN:
        raise HTTPException(status_code=400, detail="Please choose a PIN other than the default.")
    employee.staff_pin_hash = _hash_pin(payload.new_pin)
    await db.flush()
    logger.info("staff_pin_changed", employee_id=employee.employee_id)
    return {"ok": True}


class SubmitReportRequest(BaseModel):
    attendance_id: uuid.UUID
    work_report: str = Field(..., min_length=5, max_length=2000)


@router.post("/api/v1/staff/report")
@limiter.limit("20/minute")
async def submit_report(
    request: Request,
    payload: SubmitReportRequest,
    db: AsyncSession = Depends(get_db),
    employee: User = Depends(_require_employee),
):
    result = await db.execute(
        select(Attendance).where(
            Attendance.id == payload.attendance_id,
            Attendance.employee_id == employee.id,  # IDOR guard
        )
    )
    att = result.scalar_one_or_none()
    if not att:
        raise HTTPException(status_code=404, detail="Attendance record not found.")
    att.work_report = payload.work_report.strip()
    await db.flush()
    logger.info("staff_report_submitted", employee_id=employee.employee_id, attendance_id=str(att.id))
    return {"ok": True}


class UpdateProfileRequest(BaseModel):
    phone_number: Optional[str] = Field(None, max_length=50)


@router.post("/api/v1/staff/profile")
@limiter.limit("10/minute")
async def update_profile(
    request: Request,
    payload: UpdateProfileRequest,
    db: AsyncSession = Depends(get_db),
    employee: User = Depends(_require_employee),
):
    if payload.phone_number is not None:
        employee.phone_number = payload.phone_number.strip() or None
    await db.flush()
    return {"ok": True}


@router.get("/api/v1/staff/me")
async def get_me(employee: User = Depends(_require_employee)):
    return {
        "employee_id": employee.employee_id,
        "full_name": employee.full_name,
        "email": employee.email,
        "phone_number": employee.phone_number,
        "designation": employee.designation,
        "using_default_pin": employee.staff_pin_hash is None,
    }


# ── Admin endpoints ───────────────────────────────────────────────────────────

@router.post("/api/v1/staff/admin/reset-pin/{employee_id}")
async def admin_reset_pin(
    employee_id: str,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    emp = (await db.execute(
        select(User).where(User.employee_id == employee_id.strip().upper())
    )).scalar_one_or_none()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found.")
    emp.staff_pin_hash = None
    emp.staff_session_token = None
    emp.staff_session_expires_at = None
    await db.flush()
    logger.info("admin_staff_pin_reset", by=_admin.employee_id, target=emp.employee_id)
    return {"ok": True, "message": f"PIN reset to default for {emp.employee_id}"}
