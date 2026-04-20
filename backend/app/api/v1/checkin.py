from fastapi import APIRouter, Depends, HTTPException, status, Response, Cookie
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from redis.asyncio import Redis
from pydantic import BaseModel, Field
from datetime import datetime, timezone
from typing import Optional
import uuid

from app.database import get_db
from app.redis_client import get_redis
from app.core.qr_token import decode_qr_token, is_token_active
from app.core.session_manager import get_session
from app.models.user import User
from app.models.attendance import Attendance, AttendanceStatus, CheckStatus
from app.models.device import DeviceBinding
from app.core.events import publish_checkin_event
from app.core.logging import logger
from app.config import get_settings

router = APIRouter(prefix="/checkin", tags=["Check-in"])

CHECKIN_DEDUP_KEY = "checkin:{session_id}:{employee_id}"
DEVICE_COOKIE_NAME = "ratel_device"
COOKIE_MAX_AGE = 60 * 60 * 24 * 365  # 1 year
settings = get_settings()


class CheckInRequest(BaseModel):
    qr_token: str = Field(..., min_length=10)
    employee_id: Optional[str] = Field(None, min_length=2, max_length=50)
    fingerprint: Optional[str] = Field(None, max_length=255)


@router.post("/", status_code=201)
async def check_in_or_out(
    payload: CheckInRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis),
    device_token: Optional[str] = Cookie(default=None, alias=DEVICE_COOKIE_NAME),
):
    """
    Smart check-in / check-out endpoint.
    - First scan in session → CHECK IN
    - Second scan in session → CHECK OUT
    - Device binding: cookie identifies employee after first scan
    """

    # ── 1. Decode and validate QR token ──────────────────────────────────
    token_data = decode_qr_token(payload.qr_token)
    if not token_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired QR code. Please scan the latest code.",
        )

    session_id = token_data["session_id"]
    location_id = token_data["location_id"]

    # ── 2. Verify token is active in Redis ───────────────────────────────
    if not await is_token_active(redis, payload.qr_token):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="QR code has expired. Please scan the latest code.",
        )

    # ── 3. Verify session is open ────────────────────────────────────────
    session = await get_session(redis, session_id)
    if not session or not session.get("is_active"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Attendance session is closed.",
        )

    # ── 4. Resolve employee via device binding or employee_id ─────────────
    employee = await _resolve_employee(
        db=db,
        device_token=device_token,
        employee_id=payload.employee_id,
    )

    if not employee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employee not found. Please enter your Employee ID.",
        )

    # ── 5. Device binding — bind or verify ───────────────────────────────
    new_device_token = await _handle_device_binding(
        db=db,
        employee=employee,
        device_token=device_token,
        fingerprint=payload.fingerprint,
    )

    # ── 6. Check existing attendance record for this session ──────────────
    existing = await db.execute(
        select(Attendance).where(
            Attendance.employee_id == employee.id,
            Attendance.session_id == session_id,
        )
    )
    attendance = existing.scalar_one_or_none()

    now = datetime.now(timezone.utc)

    if not attendance:
        # ── 7a. No record → CHECK IN ──────────────────────────────────────
        late_threshold = 60 * 15  # 15 minutes
        session_created_at = datetime.fromisoformat(session["created_at"])
        attendance_status = (
            AttendanceStatus.LATE
            if (now - session_created_at).total_seconds() > late_threshold
            else AttendanceStatus.PRESENT
        )

        attendance = Attendance(
            employee_id=employee.id,
            session_id=session_id,
            location_id=location_id,
            status=attendance_status,
            check_status=CheckStatus.CHECKED_IN,
            token_used=payload.qr_token[:64],
        )
        db.add(attendance)
        await db.flush()
        await db.refresh(attendance)

        # Cache check-in in Redis
        dedup_key = CHECKIN_DEDUP_KEY.format(
            session_id=session_id, employee_id=str(employee.id)
        )
        await redis.setex(dedup_key, 60 * 60 * 8, "checked_in")

        action = "checked_in"
        message = f"Welcome, {employee.full_name}! You are checked in."

        logger.info("checkin_success", employee_id=employee.employee_id,
                    session_id=session_id, status=attendance_status)

    elif attendance.check_status == CheckStatus.CHECKED_IN:
        # ── 7b. Already checked in → CHECK OUT ───────────────────────────
        hours = round(
            (now - attendance.checked_in_at).total_seconds() / 3600, 2
        )
        attendance.checked_out_at = now
        attendance.hours_clocked = hours
        attendance.check_status = CheckStatus.CHECKED_OUT
        await db.flush()

        # Update Redis
        dedup_key = CHECKIN_DEDUP_KEY.format(
            session_id=session_id, employee_id=str(employee.id)
        )
        await redis.setex(dedup_key, 60 * 60 * 8, "checked_out")

        action = "checked_out"
        message = f"Goodbye, {employee.full_name}! Hours clocked: {hours}h"

        logger.info("checkout_success", employee_id=employee.employee_id,
                    session_id=session_id, hours=hours)

    else:
        # ── 7c. Already checked out → BLOCK ──────────────────────────────
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You have already checked in and out for this session.",
        )

    # ── 8. Publish WebSocket event ────────────────────────────────────────
    await publish_checkin_event(
        redis=redis,
        session_id=session_id,
        event={
            "employee": employee.full_name,
            "employee_id": employee.employee_id,
            "session_id": session_id,
            "status": attendance.status,
            "action": action,
            "checked_in_at": attendance.checked_in_at.isoformat(),
            "checked_out_at": attendance.checked_out_at.isoformat()
            if attendance.checked_out_at else None,
        },
    )

    # ── 9. Set device cookie ──────────────────────────────────────────────
    if new_device_token:
        response.set_cookie(
            key=DEVICE_COOKIE_NAME,
            value=new_device_token,
            max_age=COOKIE_MAX_AGE,
            httponly=True,
            secure=not settings.DEBUG,
            samesite="none" if not settings.DEBUG else "lax",
            path="/",
        )

    return {
        "action": action,
        "message": message,
        "employee": employee.full_name,
        "employee_id": employee.employee_id,
        "session": session["name"],
        "status": attendance.status,
        "checked_in_at": attendance.checked_in_at,
        "checked_out_at": attendance.checked_out_at,
        "hours_clocked": attendance.hours_clocked,
    }


@router.get("/session/{session_id}")
async def get_session_attendance(
    session_id: str,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Attendance).where(Attendance.session_id == session_id)
    )
    records = result.scalars().all()

    return {
        "session_id": session_id,
        "total": len(records),
        "records": [
            {
                "employee": r.employee.full_name,
                "employee_id": r.employee.employee_id,
                "status": r.status,
                "check_status": r.check_status,
                "checked_in_at": r.checked_in_at,
                "checked_out_at": r.checked_out_at,
                "hours_clocked": r.hours_clocked,
            }
            for r in records
        ],
    }


# ── Helpers ───────────────────────────────────────────────────────────────────

async def _resolve_employee(
    db: AsyncSession,
    device_token: Optional[str],
    employee_id: Optional[str],
) -> Optional[User]:
    """
    Resolve employee from device cookie first, then fall back to employee_id.
    """
    if device_token:
        # Look up device binding
        result = await db.execute(
            select(DeviceBinding).where(
                DeviceBinding.device_token == device_token
            )
        )
        binding = result.scalar_one_or_none()
        if binding:
            # Update last seen
            binding.last_seen_at = datetime.now(timezone.utc)
            # Return bound employee
            emp_result = await db.execute(
                select(User).where(
                    User.id == binding.employee_id,
                    User.is_active == True,  # noqa: E712
                )
            )
            return emp_result.scalar_one_or_none()

    # Fall back to employee_id input
    if employee_id:
        result = await db.execute(
            select(User).where(
                User.employee_id == employee_id,
                User.is_active == True,  # noqa: E712
            )
        )
        return result.scalar_one_or_none()

    return None


async def _handle_device_binding(
    db: AsyncSession,
    employee: User,
    device_token: Optional[str],
    fingerprint: Optional[str],
) -> Optional[str]:
    """
    Bind device to employee on first scan.
    Returns new device token if binding created, None if already bound.
    """
    if device_token:
        # Verify this device belongs to this employee
        result = await db.execute(
            select(DeviceBinding).where(
                DeviceBinding.device_token == device_token
            )
        )
        binding = result.scalar_one_or_none()

        if binding and binding.employee_id != employee.id:
            # Device belongs to someone else — raise fraud alert
            logger.warning(
                "device_binding_mismatch",
                device_token=device_token,
                bound_to=str(binding.employee_id),
                attempted_by=str(employee.id),
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="This device is registered to a different employee.",
            )
        if binding:
            binding.last_seen_at = datetime.now(timezone.utc)
            if fingerprint:
                binding.fingerprint = fingerprint
            return None  # Already bound correctly
        logger.info(
            "device_binding_missing_rebinding",
            employee_id=employee.employee_id,
            device_token=device_token,
        )

    # No cookie — create new binding
    new_token = str(uuid.uuid4())
    binding = DeviceBinding(
        employee_id=employee.id,
        device_token=new_token,
        fingerprint=fingerprint,
    )
    db.add(binding)
    await db.flush()

    logger.info("device_bound", employee_id=employee.employee_id,
                device_token=new_token)
    return new_token
