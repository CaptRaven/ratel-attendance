from fastapi import APIRouter, Depends, HTTPException, status, Response, Cookie, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, and_
from sqlalchemy.exc import IntegrityError
from redis.asyncio import Redis
from pydantic import BaseModel, Field
from datetime import datetime, timezone, timedelta
from typing import Optional
import uuid
import base64
import io
import json

try:
    import face_recognition
    import numpy as np
    from PIL import Image
    FACE_RECOGNITION_AVAILABLE = True
except ImportError:
    FACE_RECOGNITION_AVAILABLE = False

from app.database import get_db
from app.redis_client import get_redis
from app.core.qr_token import (
    decode_qr_token,
    is_token_active,
    consume_token,
    QR_TYPE,
)
from app.core.session_manager import get_session
from app.core.business_day import get_business_day_start, get_night_shift_lookback_start
from app.models.user import User
from app.models.attendance import Attendance, AttendanceStatus, CheckStatus
from app.models.device import DeviceBinding
from app.core.events import publish_checkin_event
from app.core.logging import logger
from app.config import get_settings
from app.api.deps import require_admin
from slowapi import Limiter
from slowapi.util import get_remote_address

router = APIRouter(prefix="/checkin", tags=["Check-in"])
limiter = Limiter(key_func=get_remote_address)

CHECKIN_DEDUP_KEY = "checkin:{session_id}:{employee_id}"
DEVICE_COOKIE_NAME = "ratel_device"
COOKIE_MAX_AGE = 60 * 60 * 24 * 365  # 1 year
settings = get_settings()


class CheckInRequest(BaseModel):
    qr_token: str = Field(..., min_length=10)
    employee_id: Optional[str] = Field(None, min_length=2, max_length=50)
    fingerprint: Optional[str] = Field(None, max_length=255)


class EnrollFaceRequest(BaseModel):
    user_id: uuid.UUID
    face_image: str  # Base64 encoded image


@router.post("/enroll", status_code=200)
@limiter.limit("50/minute")
async def enroll_face(
    request: Request,
    payload: EnrollFaceRequest,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    """Capture and store a face encoding for an employee."""
    if not FACE_RECOGNITION_AVAILABLE:
        raise HTTPException(status_code=503, detail="Face recognition library not installed on this server")

    result = await db.execute(select(User).where(User.id == payload.user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    try:
        image_data = payload.face_image
        if "," in image_data:
            image_data = image_data.split(",")[1]
        image_bytes = base64.b64decode(image_data)
        pil_image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        img_array = np.array(pil_image)
        encodings = face_recognition.face_encodings(img_array)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to process image: {e}")

    if not encodings:
        raise HTTPException(status_code=400, detail="No face detected in the image. Please try again.")

    user.face_encoding = json.dumps(encodings[0].tolist())
    user.is_face_enrolled = True
    await db.flush()

    logger.info("face_enrolled", user_id=str(user.id), employee_id=user.employee_id)
    return {"message": f"Face enrolled successfully for {user.full_name}"}


@router.delete("/enroll/{user_id}", status_code=200)
async def clear_face_enrollment(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    """Clear face enrollment for an employee."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.face_encoding = None
    user.is_face_enrolled = False
    await db.flush()

    logger.info("face_enrollment_cleared", user_id=str(user.id), employee_id=user.employee_id)
    return {"message": f"Face enrollment cleared for {user.full_name}"}


class KioskEnrollRequest(BaseModel):
    user_id: uuid.UUID
    face_image: str  # Base64 encoded image
    qr_token: str   # Active session token — proves request comes from a live kiosk


@router.post("/enroll-kiosk", status_code=200)
@limiter.limit("10/minute")
async def enroll_face_kiosk(
    request: Request,
    payload: KioskEnrollRequest,
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis),
):
    """
    Kiosk-side face enrollment — no admin token needed.
    The active QR session token acts as proof the request originates from
    a live, on-premise kiosk, not an arbitrary internet caller.
    """
    if not FACE_RECOGNITION_AVAILABLE:
        raise HTTPException(status_code=503, detail="Face recognition library not installed on this server")

    # Validate the session token as the kiosk's credential
    token_data = decode_qr_token(payload.qr_token)
    if not token_data or token_data.get("type") != QR_TYPE:
        raise HTTPException(status_code=400, detail="Invalid session token")
    if not await is_token_active(redis, payload.qr_token):
        raise HTTPException(status_code=400, detail="Session token has expired")
    session = await get_session(redis, token_data["session_id"])
    if not session or not session.get("is_active"):
        raise HTTPException(status_code=400, detail="No active attendance session")

    result = await db.execute(select(User).where(User.id == payload.user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    try:
        image_data = payload.face_image
        if "," in image_data:
            image_data = image_data.split(",")[1]
        image_bytes = base64.b64decode(image_data)
        pil_image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        img_array = np.array(pil_image)
        encodings = face_recognition.face_encodings(img_array)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to process image: {e}")

    if not encodings:
        raise HTTPException(status_code=400, detail="No face detected. Please look directly at the camera.")

    user.face_encoding = json.dumps(encodings[0].tolist())
    user.is_face_enrolled = True
    await db.flush()

    logger.info("face_enrolled_kiosk", user_id=str(user.id), employee_id=user.employee_id)
    return {"message": f"Face enrolled for {user.full_name}"}


class FaceCheckinRequest(BaseModel):
    qr_token: str = Field(..., min_length=10)
    face_image: str  # base64 JPEG


@router.post("/face", status_code=200)
@limiter.limit("60/minute")
async def face_check_in(
    request: Request,
    payload: FaceCheckinRequest,
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis),
):
    """
    Kiosk face check-in: capture a frame, match against enrolled faces,
    and run the same check-in/out logic as a QR scan.
    Returns {matched: false} when no face is recognised (not an error).
    """
    if not FACE_RECOGNITION_AVAILABLE:
        raise HTTPException(status_code=503, detail="Face recognition not available")

    # ── 1. Validate QR token (proves request comes from a live kiosk session) ──
    qr_token = payload.qr_token
    token_data = decode_qr_token(qr_token)
    if not token_data or token_data.get("type") != QR_TYPE:
        raise HTTPException(status_code=400, detail="Invalid or expired QR code")

    if not await is_token_active(redis, qr_token):
        raise HTTPException(status_code=400, detail="QR code has expired")

    session_id = token_data["session_id"]
    location_id = token_data["location_id"]
    shift = token_data.get("shift")

    session = await get_session(redis, session_id)
    if not session or not session.get("is_active"):
        raise HTTPException(status_code=400, detail="Attendance session is closed")

    # ── 2. Decode incoming face image ─────────────────────────────────────────
    try:
        image_data = payload.face_image
        if "," in image_data:
            image_data = image_data.split(",")[1]
        image_bytes = base64.b64decode(image_data)
        pil_image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        incoming_array = np.array(pil_image)
        incoming_encodings = face_recognition.face_encodings(incoming_array)
    except Exception as e:
        logger.warning("face_scan_decode_failed", error=str(e))
        return {"matched": False}

    if not incoming_encodings:
        return {"matched": False}

    incoming_encoding = incoming_encodings[0]

    # ── 3. Load all enrolled active employees ─────────────────────────────────
    enrolled_result = await db.execute(
        select(User).where(
            User.is_face_enrolled == True,  # noqa: E712
            User.is_active == True,         # noqa: E712
            User.face_encoding != None,     # noqa: E711
        )
    )
    enrolled_users = enrolled_result.scalars().all()

    if not enrolled_users:
        return {"matched": False}

    # ── 4. Find closest match across ALL enrolled faces ──────────────────────
    # Comparing against every encoding and picking the smallest distance (instead
    # of stopping at the first one under the threshold) avoids misidentifying
    # someone as a different enrolled employee when more than one face is
    # within tolerance.
    FACE_MATCH_TOLERANCE = 0.5
    candidates: list[tuple[User, float]] = []
    for emp in enrolled_users:
        try:
            stored = np.array(json.loads(emp.face_encoding))
            distance = face_recognition.face_distance([stored], incoming_encoding)[0]
            candidates.append((emp, distance))
        except Exception:
            continue

    if not candidates:
        return {"matched": False}

    matched_user, best_distance = min(candidates, key=lambda c: c[1])
    if best_distance > FACE_MATCH_TOLERANCE:
        return {"matched": False}

    # ── 5. Check-in / Check-out logic (mirrors normal scan) ──────────────────
    employee = matched_user
    now = datetime.now(timezone.utc)

    existing = await db.execute(
        select(Attendance)
        .where(
            Attendance.employee_id == employee.id,
            Attendance.session_id == session_id,
        )
        .limit(1)
    )
    attendance = existing.scalar_one_or_none()

    if not attendance:
        cutoff = get_business_day_start(now)
        night_cutoff = get_night_shift_lookback_start(now)
        recent_result = await db.execute(
            select(Attendance)
            .where(
                Attendance.employee_id == employee.id,
                Attendance.check_status == CheckStatus.CHECKED_IN,
                or_(
                    Attendance.checked_in_at >= cutoff,
                    and_(Attendance.shift == "night", Attendance.checked_in_at >= night_cutoff),
                ),
            )
            .order_by(Attendance.checked_in_at.desc())
            .limit(1)
        )
        attendance = recent_result.scalar_one_or_none()

    if not attendance:
        attendance = Attendance(
            employee_id=employee.id,
            session_id=session_id,
            location_id=location_id,
            status=AttendanceStatus.PRESENT,
            check_status=CheckStatus.CHECKED_IN,
            shift=shift,
            token_used="face-recognition",
        )
        db.add(attendance)
        try:
            await db.flush()
            await db.refresh(attendance)
            action = "checked_in"
        except IntegrityError:
            # Another concurrent request already created this check-in
            # (e.g. a double scan) — treat as already checked in instead
            # of a hard 500 error.
            await db.rollback()
            retry = await db.execute(
                select(Attendance)
                .where(Attendance.employee_id == employee.id, Attendance.session_id == session_id)
                .limit(1)
            )
            attendance = retry.scalar_one_or_none()
            if attendance is None:
                raise
            action = "checked_in"

    elif attendance.check_status == CheckStatus.CHECKED_IN:
        hours = round((now - attendance.checked_in_at).total_seconds() / 3600, 2)
        attendance.checked_out_at = now
        attendance.hours_clocked = hours
        attendance.check_status = CheckStatus.CHECKED_OUT
        await db.flush()
        action = "checked_out"

    else:
        # Already fully checked out — acknowledge silently so the kiosk doesn't alarm
        return {
            "matched": True,
            "already_done": True,
            "employee": employee.full_name,
            "action": "already_checked_out",
        }

    # ── 6. Broadcast via WebSocket ────────────────────────────────────────────
    await publish_checkin_event(
        redis=redis,
        session_id=session_id,
        event={
            "employee": employee.full_name,
            "employee_id": employee.employee_id,
            "user_id": str(employee.id),
            "session_id": session_id,
            "status": attendance.status,
            "action": action,
            "checked_in_at": attendance.checked_in_at.isoformat(),
            "checked_out_at": attendance.checked_out_at.isoformat() if attendance.checked_out_at else None,
            "needs_enrollment": False,
        },
    )

    logger.info("face_checkin_success", employee_id=employee.employee_id, action=action)

    return {
        "matched": True,
        "action": action,
        "employee": employee.full_name,
        "employee_id": employee.employee_id,
        "user_id": str(employee.id),
        "session": session["name"],
        "status": attendance.status,
        "checked_in_at": attendance.checked_in_at.isoformat(),
        "checked_out_at": attendance.checked_out_at.isoformat() if attendance.checked_out_at else None,
        "hours_clocked": attendance.hours_clocked,
    }


@router.get("/resolve-fingerprint")
@limiter.limit("100/minute")
async def resolve_fingerprint(
    request: Request,
    fingerprint: str = Query(..., min_length=5),
    db: AsyncSession = Depends(get_db),
):
    """
    Try to resolve an employee name from a browser fingerprint.
    Used for 'consistency' when moving between App and Safari.
    """
    # Look for a device binding with this fingerprint
    # We take the most recent one if multiple exist (though ideally they shouldn't)
    result = await db.execute(
        select(DeviceBinding)
        .where(DeviceBinding.fingerprint == fingerprint)
        .order_by(DeviceBinding.last_seen_at.desc())
        .limit(1)
    )
    binding = result.scalar_one_or_none()
    
    if not binding:
        return {"found": False}
        
    # Get employee details
    emp_result = await db.execute(
        select(User).where(User.id == binding.employee_id)
    )
    employee = emp_result.scalar_one_or_none()
    
    if not employee or not employee.is_active:
        return {"found": False}
        
    return {
        "found": True,
        "full_name": employee.full_name,
        "employee_id": employee.employee_id,
    }


@router.post("/", status_code=201)
@limiter.limit("100/minute")
async def check_in_or_out(
    request: Request,
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
    try:
        # ── 1. Decode and validate QR token ──────────────────────────────────
        # First, extract token from URL if Android app sent a full URL
        qr_token = payload.qr_token
        if "token=" in qr_token:
            try:
                qr_token = qr_token.split("token=")[-1].split("&")[0]
            except Exception:
                pass

        token_data = decode_qr_token(qr_token)
        
        if not token_data or token_data.get("type") != QR_TYPE:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid or expired QR code. Please scan the latest code.",
            )

        session_id = token_data["session_id"]
        location_id = token_data["location_id"]
        shift = token_data.get("shift")

        # ── 2. Verify token is active in Redis ───────────────────────────────
        # Anti-replay is still handled by the database check below.
        if not await is_token_active(redis, qr_token):
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
            employee_id_provided=bool(payload.employee_id),
        )

        # ── 6. Check existing attendance record for this session ──────────────
        existing = await db.execute(
            select(Attendance)
            .where(
                Attendance.employee_id == employee.id,
                Attendance.session_id == session_id,
            )
            .limit(1)
        )
        attendance = existing.scalar_one_or_none()

        # ── 6b. Cross-Session Checkout Support ────────────────────────────────
        # If no record in current session, look for an active "In" record from
        # earlier in the SAME business day (rolls over at 06:00 WAT). Bounding
        # by business day — not a flat time window — means a forgotten checkout
        # from a previous day is never mistaken for today's check-in; once the
        # rollover passes, a fresh check-in is created instead.
        if not attendance:
            cutoff = get_business_day_start()
            night_cutoff = get_night_shift_lookback_start()

            recent_in = await db.execute(
                select(Attendance)
                .where(
                    Attendance.employee_id == employee.id,
                    Attendance.check_status == CheckStatus.CHECKED_IN,
                    or_(
                        Attendance.checked_in_at >= cutoff,
                        and_(Attendance.shift == "night", Attendance.checked_in_at >= night_cutoff),
                    ),
                )
                .order_by(Attendance.checked_in_at.desc())
                .limit(1)
            )
            attendance = recent_in.scalar_one_or_none()
            
            if attendance:
                logger.info("cross_session_checkout_detected", 
                            employee_id=employee.employee_id,
                            old_session_id=attendance.session_id,
                            new_session_id=session_id)

        # Use current time
        now = datetime.now(timezone.utc)

        if not attendance:
            # ── 7a. No record → CHECK IN ──────────────────────────────────────
            # For a 24-hour session covering multiple shifts, we default to PRESENT.
            # Shift-based lateness can be added here in the future.
            attendance_status = AttendanceStatus.PRESENT

            attendance = Attendance(
                employee_id=employee.id,
                session_id=session_id,
                location_id=location_id,
                status=attendance_status,
                check_status=CheckStatus.CHECKED_IN,
                shift=shift,
                token_used=qr_token[:64],
            )
            db.add(attendance)
            try:
                await db.flush()
                await db.refresh(attendance)
            except IntegrityError:
                # Another concurrent request (e.g. a double-tap) already
                # created this check-in — fall back to it instead of a 500.
                await db.rollback()
                retry = await db.execute(
                    select(Attendance)
                    .where(Attendance.employee_id == employee.id, Attendance.session_id == session_id)
                    .limit(1)
                )
                attendance = retry.scalar_one_or_none()
                if attendance is None:
                    raise

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
                "user_id": str(employee.id),
                "session_id": session_id,
                "status": attendance.status,
                "action": action,
                "checked_in_at": attendance.checked_in_at.isoformat(),
                "checked_out_at": attendance.checked_out_at.isoformat()
                if attendance.checked_out_at else None,
                "needs_enrollment": not employee.is_face_enrolled,
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
                domain=None,  # Let browser handle domain scoping
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
    except HTTPException:
        raise
    except Exception as e:
        logger.error("checkin_error", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal Server Error"
        )


@router.get("/session/{session_id}")
@limiter.limit("100/minute")
async def get_session_attendance(
    request: Request,
    session_id: str,
    db: AsyncSession = Depends(get_db),
):
    try:
        result = await db.execute(
            select(Attendance).where(Attendance.session_id == session_id)
        )
        records = result.scalars().all()

        return {
            "session_id": session_id,
            "total": len(records),
            "records": [
                {
                    "employee": r.employee.full_name if r.employee else "Unknown",
                    "employee_id": r.employee.employee_id if r.employee else "Unknown",
                    "status": r.status,
                    "check_status": r.check_status,
                    "checked_in_at": r.checked_in_at,
                    "checked_out_at": r.checked_out_at,
                    "hours_clocked": r.hours_clocked,
                    "shift": r.shift,
                }
                for r in records
            ],
        }
    except Exception as e:
        logger.error("get_session_attendance_failed", session_id=session_id, error=str(e))
        raise HTTPException(status_code=500, detail="Internal Server Error")


class ManualCheckinRequest(BaseModel):
    employee_id: str = Field(..., min_length=1)
    session_id: str = Field(..., min_length=5)


@router.post("/manual", status_code=201)
@limiter.limit("100/minute")
async def manual_checkin(
    request: Request,
    payload: ManualCheckinRequest,
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis),
    admin: User = Depends(require_admin),
):
    """
    Admin manually clocks an employee in or out for a session.
    Used when an employee has no device to scan the QR code.
    Follows the same check-in / check-out logic as a normal scan.
    """
    result = await db.execute(
        select(User).where(
            User.employee_id == payload.employee_id,
            User.is_active == True,  # noqa: E712
        )
    )
    employee = result.scalar_one_or_none()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")

    session = await get_session(redis, payload.session_id)
    if not session or not session.get("is_active"):
        raise HTTPException(status_code=400, detail="Session is not active")

    now = datetime.now(timezone.utc)

    # Check current session first
    existing = await db.execute(
        select(Attendance)
        .where(
            Attendance.employee_id == employee.id,
            Attendance.session_id == payload.session_id,
        )
        .limit(1)
    )
    attendance = existing.scalar_one_or_none()

    # Cross-session checkout (same business day only, see get_business_day_start)
    if not attendance:
        cutoff = get_business_day_start(now)
        night_cutoff = get_night_shift_lookback_start(now)
        recent_result = await db.execute(
            select(Attendance)
            .where(
                Attendance.employee_id == employee.id,
                Attendance.check_status == CheckStatus.CHECKED_IN,
                or_(
                    Attendance.checked_in_at >= cutoff,
                    and_(Attendance.shift == "night", Attendance.checked_in_at >= night_cutoff),
                ),
            )
            .order_by(Attendance.checked_in_at.desc())
            .limit(1)
        )
        attendance = recent_result.scalar_one_or_none()

    if not attendance:
        attendance = Attendance(
            employee_id=employee.id,
            session_id=payload.session_id,
            location_id=session.get("location_id", "ratel-hq"),
            status=AttendanceStatus.PRESENT,
            check_status=CheckStatus.CHECKED_IN,
            token_used="manual-admin",
        )
        db.add(attendance)
        try:
            await db.flush()
            await db.refresh(attendance)
        except IntegrityError:
            await db.rollback()
            retry = await db.execute(
                select(Attendance)
                .where(Attendance.employee_id == employee.id, Attendance.session_id == payload.session_id)
                .limit(1)
            )
            attendance = retry.scalar_one_or_none()
            if attendance is None:
                raise
        action = "checked_in"

    elif attendance.check_status == CheckStatus.CHECKED_IN:
        hours = round((now - attendance.checked_in_at).total_seconds() / 3600, 2)
        attendance.checked_out_at = now
        attendance.hours_clocked = hours
        attendance.check_status = CheckStatus.CHECKED_OUT
        await db.flush()
        action = "checked_out"

    else:
        raise HTTPException(
            status_code=409,
            detail=f"{employee.full_name} has already checked in and out for this session",
        )

    await publish_checkin_event(
        redis=redis,
        session_id=payload.session_id,
        event={
            "employee": employee.full_name,
            "employee_id": employee.employee_id,
            "user_id": str(employee.id),
            "session_id": payload.session_id,
            "status": attendance.status,
            "action": action,
            "checked_in_at": attendance.checked_in_at.isoformat(),
            "checked_out_at": attendance.checked_out_at.isoformat() if attendance.checked_out_at else None,
            "needs_enrollment": not employee.is_face_enrolled,
        },
    )

    logger.info("manual_checkin", employee_id=employee.employee_id, action=action, admin=str(admin.id))
    return {
        "action": action,
        "employee": employee.full_name,
        "employee_id": employee.employee_id,
        "checked_in_at": attendance.checked_in_at,
        "checked_out_at": attendance.checked_out_at,
        "hours_clocked": attendance.hours_clocked,
    }


@router.get("/status")
@limiter.limit("300/minute")
async def get_employee_status(
    request: Request,
    employee_id: str = Query(..., min_length=1),
    session_id: str = Query(..., min_length=5),
    db: AsyncSession = Depends(get_db),
):
    """
    Returns the current attendance status for an employee in the given session.
    Called client-side when an employee types their ID, so the button label can
    show the correct action (Clock In vs Clock Out) before they submit.
    """
    result = await db.execute(
        select(User).where(
            User.employee_id == employee_id,
            User.is_active == True,  # noqa: E712
        )
    )
    employee = result.scalar_one_or_none()

    if not employee:
        return {"check_status": "none", "employee": None, "found": False}

    # Check current session first
    att_result = await db.execute(
        select(Attendance)
        .where(
            Attendance.employee_id == employee.id,
            Attendance.session_id == session_id,
        )
        .limit(1)
    )
    attendance = att_result.scalar_one_or_none()

    if attendance:
        return {
            "check_status": attendance.check_status.value,
            "employee": employee.full_name,
            "user_id": str(employee.id),
            "is_face_enrolled": employee.is_face_enrolled,
            "found": True,
        }

    # Cross-session check (same business day only, matching the check-in logic)
    cutoff = get_business_day_start()
    night_cutoff = get_night_shift_lookback_start()
    recent_result = await db.execute(
        select(Attendance)
        .where(
            Attendance.employee_id == employee.id,
            Attendance.check_status == CheckStatus.CHECKED_IN,
            or_(
                Attendance.checked_in_at >= cutoff,
                and_(Attendance.shift == "night", Attendance.checked_in_at >= night_cutoff),
            ),
        )
        .order_by(Attendance.checked_in_at.desc())
        .limit(1)
    )
    recent = recent_result.scalar_one_or_none()

    return {
        "check_status": "checked_in" if recent else "none",
        "employee": employee.full_name,
        "user_id": str(employee.id),
        "is_face_enrolled": employee.is_face_enrolled,
        "found": True,
    }


# ── Helpers ───────────────────────────────────────────────────────────────────

async def _resolve_employee(
    db: AsyncSession,
    device_token: Optional[str],
    employee_id: Optional[str],
) -> Optional[User]:
    """
    Resolve employee from employee_id first (priority), then fall back to device cookie.
    """
    # First prioritize employee_id if provided (override device)
    if employee_id:
        result = await db.execute(
            select(User).where(
                User.employee_id == employee_id,
                User.is_active == True,  # noqa: E712
            )
        )
        return result.scalar_one_or_none()

    # Fall back to device cookie only if no employee_id
    if device_token:
        result = await db.execute(
            select(DeviceBinding).where(
                DeviceBinding.device_token == device_token
            )
        )
        binding = result.scalar_one_or_none()
        if binding:
            binding.last_seen_at = datetime.now(timezone.utc)
            emp_result = await db.execute(
                select(User).where(
                    User.id == binding.employee_id,
                    User.is_active == True,  # noqa: E712
                )
            )
            return emp_result.scalar_one_or_none()

    return None


async def _handle_device_binding(
    db: AsyncSession,
    employee: User,
    device_token: Optional[str],
    fingerprint: Optional[str],
    employee_id_provided: bool = False,
) -> Optional[str]:
    """
    Bind device to employee on first scan.
    If employee_id was explicitly provided, allow rebinding the device to the new employee.
    Returns new device token if binding created, None if already bound.
    """
    if device_token:
        result = await db.execute(
            select(DeviceBinding).where(
                DeviceBinding.device_token == device_token
            )
        )
        binding = result.scalar_one_or_none()

        if binding and binding.employee_id != employee.id:
            if employee_id_provided:
                # Employee ID was explicitly provided — rebind the device
                logger.info(
                    "device_rebound",
                    device_token=device_token,
                    old_employee_id=str(binding.employee_id),
                    new_employee_id=str(employee.id),
                )
                binding.employee_id = employee.id
                binding.last_seen_at = datetime.now(timezone.utc)
                if fingerprint:
                    binding.fingerprint = fingerprint
                return None
            else:
                # No employee ID provided — device mismatch
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
