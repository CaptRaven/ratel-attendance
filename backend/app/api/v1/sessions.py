from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Request
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from pydantic import BaseModel, Field
from datetime import datetime, timezone, timedelta
import json
from app.redis_client import get_redis
from app.database import get_db
from app.core.session_manager import (
    create_session,
    rotate_session_token,
    get_session,
    get_active_session,
    close_session,
    SESSION_TTL_SECONDS,
    ACTIVE_SESSION_KEY,
)
from app.core.qr_token import QR_SESSION_KEY
from app.api.deps import require_admin
from app.models.user import User
from app.models.attendance import Attendance
from app.core.logging import logger
from slowapi import Limiter
from slowapi.util import get_remote_address

router = APIRouter(prefix="/sessions", tags=["Sessions"])
limiter = Limiter(key_func=get_remote_address)


class CreateSessionRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=100, example="Morning Standup")
    location_id: str = Field(default="ratel-hq", max_length=100)


class RotateTokenRequest(BaseModel):
    session_id: str = Field(..., min_length=5)
    shift: Optional[str] = None


# Admin endpoints (still available for desktop app)
@router.post("/", status_code=201)
@limiter.limit("50/minute")
async def start_session(
    request: Request,
    payload: CreateSessionRequest,
    redis: Redis = Depends(get_redis),
    admin: User = Depends(require_admin),
):
    """Admin starts an attendance session — returns session + first QR token."""
    session = await create_session(
        redis=redis,
        name=payload.name,
        location_id=payload.location_id,
        created_by=str(admin.id),
    )
    logger.info("session_started", session_id=session["session_id"], admin=str(admin.id))
    return session


@router.post("/rotate-token")
@limiter.limit("100/minute")
async def rotate_token(
    request: Request,
    payload: RotateTokenRequest,
    redis: Redis = Depends(get_redis),
    admin: User = Depends(require_admin),
):
    """
    Rotate the QR token for an active session.
    Desktop app calls this every 30 seconds to keep QR fresh.
    """
    session = await get_session(redis, payload.session_id)

    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found or expired",
        )

    if not session.get("is_active"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Session is closed",
        )

    token = await rotate_session_token(
        redis=redis,
        session_id=payload.session_id,
        location_id=session["location_id"],
        shift=payload.shift,
    )
    return {"session_id": payload.session_id, "qr_token": token}


@router.get("/active")
@limiter.limit("100/minute")
async def get_current_active_session(
    request: Request,
    redis: Redis = Depends(get_redis),
    admin: User = Depends(require_admin),
):
    """Get the current active attendance session."""
    session = await get_active_session(redis)
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No active session found",
        )
    logger.info("active_session_requested", session_id=session["session_id"], admin=str(admin.id))
    return session


@router.post("/{session_id}/close")
@limiter.limit("50/minute")
async def end_session(
    request: Request,
    session_id: str,
    redis: Redis = Depends(get_redis),
    admin: User = Depends(require_admin),
):
    """Admin closes an attendance session."""
    success = await close_session(redis, session_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found",
        )
    return {"message": "Session closed", "session_id": session_id}


@router.get("/{session_id}")
@limiter.limit("100/minute")
async def get_session_info(
    request: Request,
    session_id: str,
    redis: Redis = Depends(get_redis),
    admin: User = Depends(require_admin),
):
    """Get session metadata."""
    session = await get_session(redis, session_id)
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found",
        )
    return session


@router.post("/recover")
@limiter.limit("20/minute")
async def recover_session(
    request: Request,
    redis: Redis = Depends(get_redis),
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """
    Recover the most recent session from PostgreSQL after a Redis crash/restart.
    Finds today's session (last 24h) with the most attendance records and restores it
    in Redis as the active session. Safe to call at any time — if Redis already has a
    populated active session, it returns that instead of overwriting it.
    """
    # If Redis already has an active session with records, no recovery needed
    existing = await get_active_session(redis)
    if existing:
        return existing

    # Find the session_id with the most attendance records in the last 24 hours
    cutoff = datetime.now(timezone.utc) - timedelta(hours=24)
    result = await db.execute(
        select(
            Attendance.session_id,
            Attendance.location_id,
            func.min(Attendance.checked_in_at).label("created_at"),
            func.count(Attendance.id).label("record_count"),
        )
        .where(Attendance.checked_in_at >= cutoff)
        .group_by(Attendance.session_id, Attendance.location_id)
        .order_by(func.count(Attendance.id).desc())
        .limit(1)
    )
    row = result.first()

    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No attendance records found in the last 24 hours to recover from",
        )

    session_id = row.session_id
    location_id = row.location_id
    created_at = row.created_at

    session_data = {
        "session_id": session_id,
        "name": f"Session {created_at.strftime('%d %b %Y')}",
        "location_id": location_id,
        "created_by": str(admin.id),
        "created_at": created_at.isoformat(),
        "is_active": True,
        "recovered": True,
    }

    # Restore in Redis
    session_key = QR_SESSION_KEY.format(session_id=session_id)
    await redis.setex(session_key, SESSION_TTL_SECONDS, json.dumps(session_data))
    await redis.setex(ACTIVE_SESSION_KEY, SESSION_TTL_SECONDS, session_id)

    # Generate a fresh QR token so check-in can continue immediately
    token = await rotate_session_token(
        redis=redis,
        session_id=session_id,
        location_id=location_id,
    )

    logger.info(
        "session_recovered",
        session_id=session_id,
        record_count=row.record_count,
        admin=str(admin.id),
    )
    return {**session_data, "qr_token": token}


# Public endpoints for kiosk (no auth required)
@router.post("/public/rotate-token")
@limiter.limit("100/minute")
async def rotate_token_public(
    request: Request,
    payload: RotateTokenRequest,
    redis: Redis = Depends(get_redis),
):
    """
    Rotate the QR token for an active session — public endpoint for kiosk.
    """
    session = await get_session(redis, payload.session_id)

    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found or expired",
        )

    if not session.get("is_active"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Session is closed",
        )

    token = await rotate_session_token(
        redis=redis,
        session_id=payload.session_id,
        location_id=session["location_id"],
        shift=payload.shift,
    )
    logger.info("token_rotated_public", session_id=payload.session_id)
    return {"session_id": payload.session_id, "qr_token": token}


@router.get("/public/active")
@limiter.limit("100/minute")
async def get_current_active_session_public(
    request: Request,
    redis: Redis = Depends(get_redis),
):
    """Get the current active attendance session — public endpoint for kiosk."""
    session = await get_active_session(redis)
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No active session found",
        )
    logger.info("active_session_requested_public", session_id=session["session_id"])
    return session


@router.get("/public/{session_id}")
@limiter.limit("100/minute")
async def get_session_info_public(
    request: Request,
    session_id: str,
    redis: Redis = Depends(get_redis),
):
    """Get session metadata — public endpoint for kiosk."""
    session = await get_session(redis, session_id)
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found",
        )
    return session
