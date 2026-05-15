from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from redis.asyncio import Redis
from pydantic import BaseModel, Field
from app.redis_client import get_redis
from app.core.session_manager import (
    create_session,
    rotate_session_token,
    get_session,
    get_active_session,
    close_session,
)
from app.api.deps import require_admin
from app.models.user import User
from app.core.logging import logger

router = APIRouter(prefix="/sessions", tags=["Sessions"])


class CreateSessionRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=100, example="Morning Standup")
    location_id: str = Field(default="ratel-hq", max_length=100)


class RotateTokenRequest(BaseModel):
    session_id: str = Field(..., min_length=5)
    shift: Optional[str] = None


@router.post("/", status_code=201)
async def start_session(
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
async def rotate_token(
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
async def get_current_active_session(
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


@router.get("/{session_id}")
async def get_session_info(
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


@router.post("/{session_id}/close")
async def end_session(
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
