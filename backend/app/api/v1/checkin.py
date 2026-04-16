from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from redis.asyncio import Redis
from pydantic import BaseModel, Field
from datetime import datetime, timezone

from app.database import get_db
from app.redis_client import get_redis
from app.core.qr_token import decode_qr_token, is_token_active, consume_token
from app.core.session_manager import get_session
from app.models.user import User
from app.models.attendance import Attendance, AttendanceStatus
from app.schemas.attendance import AttendanceResponse
from app.core.logging import logger

router = APIRouter(prefix="/checkin", tags=["Check-in"])

# Redis key for deduplication per session per employee
CHECKIN_DEDUP_KEY = "checkin:{session_id}:{employee_id}"


class CheckInRequest(BaseModel):
    qr_token: str = Field(..., min_length=10)
    employee_id: str = Field(..., min_length=2, max_length=50)


@router.post("/", status_code=201)
async def check_in(
    payload: CheckInRequest,
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis),
):
    """
    Employee check-in endpoint.
    Called when employee scans QR code and submits their employee ID.
    No auth required — token itself is the proof of presence.
    """

    # ── 1. Decode and validate QR token signature + expiry ──────────────
    token_data = decode_qr_token(payload.qr_token)
    if not token_data:
        logger.warning("checkin_invalid_token", employee_id=payload.employee_id)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired QR code. Please scan the latest code.",
        )

    session_id = token_data["session_id"]
    location_id = token_data["location_id"]

    # ── 2. Verify token is still active in Redis (not rotated away) ──────
    if not await is_token_active(redis, payload.qr_token):
        logger.warning("checkin_token_not_active", session_id=session_id)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="QR code has expired. Please scan the latest code.",
        )

    # ── 3. Verify session is still open ──────────────────────────────────
    session = await get_session(redis, session_id)
    if not session or not session.get("is_active"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Attendance session is closed.",
        )

    # ── 4. Verify employee exists and is active ───────────────────────────
    result = await db.execute(
        select(User).where(
            User.employee_id == payload.employee_id,
            User.is_active == True,  # noqa: E712
        )
    )
    employee = result.scalar_one_or_none()
    if not employee:
        logger.warning("checkin_employee_not_found", employee_id=payload.employee_id)
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employee not found or inactive.",
        )

    # ── 5. Deduplication — Redis fast check ───────────────────────────────
    dedup_key = CHECKIN_DEDUP_KEY.format(
        session_id=session_id,
        employee_id=str(employee.id),
    )
    already_checked_in = await redis.exists(dedup_key)
    if already_checked_in:
        logger.warning(
            "checkin_duplicate",
            employee_id=payload.employee_id,
            session_id=session_id,
        )
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Already checked in for this session.",
        )

    # ── 6. Deduplication — Postgres persistent check ─────────────────────
    existing = await db.execute(
        select(Attendance).where(
            Attendance.employee_id == employee.id,
            Attendance.session_id == session_id,
        )
    )
    if existing.scalar_one_or_none():
        # Sync Redis with DB state
        await redis.setex(dedup_key, 60 * 60 * 8, "1")
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Already checked in for this session.",
        )

    # ── 7. Determine attendance status (present vs late) ──────────────────
    attendance_status = AttendanceStatus.PRESENT
    session_created_at = datetime.fromisoformat(session["created_at"])
    now = datetime.now(timezone.utc)
    # Mark as late if checking in more than 15 minutes after session start
    if (now - session_created_at).total_seconds() > 60 * 15:
        attendance_status = AttendanceStatus.LATE

    # ── 8. Record attendance in Postgres ─────────────────────────────────
    attendance = Attendance(
        employee_id=employee.id,
        session_id=session_id,
        location_id=location_id,
        status=attendance_status,
        token_used=payload.qr_token[:64],  # Store partial token for audit
    )
    db.add(attendance)
    await db.flush()
    await db.refresh(attendance)

    # ── 9. Mark employee as checked in Redis (dedup cache) ────────────────
    await redis.setex(dedup_key, 60 * 60 * 8, "1")  # 8 hour TTL

    logger.info(
        "checkin_success",
        employee_id=payload.employee_id,
        session_id=session_id,
        status=attendance_status,
    )

    return {
        "message": "Check-in successful",
        "employee": employee.full_name,
        "session": session["name"],
        "status": attendance_status,
        "checked_in_at": attendance.checked_in_at,
    }


@router.get("/session/{session_id}")
async def get_session_attendance(
    session_id: str,
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis),
):
    """
    Get all check-ins for a session.
    Public endpoint — used by admin dashboard to show live attendance.
    """
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
                "checked_in_at": r.checked_in_at,
            }
            for r in records
        ],
    }