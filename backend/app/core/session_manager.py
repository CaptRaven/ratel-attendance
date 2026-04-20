import uuid
from datetime import datetime, timezone
from redis.asyncio import Redis
from app.core.qr_token import (
    generate_qr_token,
    store_active_token,
    QR_SESSION_KEY,
)
from app.config import get_settings
from app.core.logging import logger
import json

settings = get_settings()

# Session TTL — how long an attendance session stays open (e.g. 4 hours)
SESSION_TTL_SECONDS = 60 * 60 * 4
ACTIVE_SESSION_KEY = "attendance:active_session"


async def create_session(
    redis: Redis,
    name: str,
    location_id: str,
    created_by: str,
) -> dict:
    """
    Create a new attendance session.
    Returns session metadata including the first QR token.
    """
    session_id = f"session-{uuid.uuid4().hex}"

    session_data = {
        "session_id": session_id,
        "name": name,
        "location_id": location_id,
        "created_by": created_by,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "is_active": True,
    }

    # Store session metadata in Redis
    session_key = QR_SESSION_KEY.format(session_id=session_id)
    await redis.setex(
        session_key,
        SESSION_TTL_SECONDS,
        json.dumps(session_data),
    )
    await redis.setex(
        ACTIVE_SESSION_KEY,
        SESSION_TTL_SECONDS,
        session_id,
    )

    # Generate the first QR token immediately
    token = await rotate_session_token(redis, session_id, location_id)

    logger.info("session_created", session_id=session_id, name=name)
    return {**session_data, "qr_token": token}


async def rotate_session_token(
    redis: Redis,
    session_id: str,
    location_id: str,
) -> str:
    """
    Generate a new QR token for the session and store in Redis.
    Called every QR_TOKEN_TTL_SECONDS by the desktop app.
    """
    token = generate_qr_token(session_id, location_id)
    await store_active_token(redis, token, session_id)
    logger.info("qr_token_rotated", session_id=session_id)
    return token


async def get_session(redis: Redis, session_id: str) -> dict | None:
    """Fetch session metadata from Redis."""
    session_key = QR_SESSION_KEY.format(session_id=session_id)
    data = await redis.get(session_key)
    if not data:
        return None
    return json.loads(data)


async def get_active_session(redis: Redis) -> dict | None:
    """Fetch the current active session from Redis."""
    active_session_id = await redis.get(ACTIVE_SESSION_KEY)
    if not active_session_id:
        return None
    session_id = (
        active_session_id.decode()
        if isinstance(active_session_id, bytes)
        else active_session_id
    )
    session = await get_session(redis, session_id)
    if not session or not session.get("is_active"):
        await redis.delete(ACTIVE_SESSION_KEY)
        return None
    return session


async def close_session(redis: Redis, session_id: str) -> bool:
    """Close an active session."""
    session_key = QR_SESSION_KEY.format(session_id=session_id)
    data = await redis.get(session_key)
    if not data:
        return False

    session_data = json.loads(data)
    session_data["is_active"] = False

    # Update with remaining TTL
    ttl = await redis.ttl(session_key)
    if ttl > 0:
        await redis.setex(session_key, ttl, json.dumps(session_data))

    active_session_id = await redis.get(ACTIVE_SESSION_KEY)
    if active_session_id:
        active_session_id = (
            active_session_id.decode()
            if isinstance(active_session_id, bytes)
            else active_session_id
        )
        if active_session_id == session_id:
            await redis.delete(ACTIVE_SESSION_KEY)

    logger.info("session_closed", session_id=session_id)
    return True
