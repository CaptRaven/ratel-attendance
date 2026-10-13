"""
Background task that auto-creates a daily attendance session at 6 AM WAT
so the kiosk stays live without requiring an admin to open the desktop app.
"""
from __future__ import annotations
import asyncio
from datetime import datetime, timezone, timedelta

from app.core.session_manager import create_session, get_active_session
from app.core.logging import logger
from app.redis_client import get_redis_pool
from redis.asyncio import Redis

WAT = timezone(timedelta(hours=1))
AUTO_SESSION_HOUR = 6   # 6 AM WAT
AUTO_LOCATION_ID  = "ratel-hq"
AUTO_CREATED_BY   = "auto"


def _session_name_for(dt: datetime) -> str:
    return dt.strftime("Session %-d %b %Y")


async def _ensure_session() -> None:
    """Create today's session if none is active."""
    redis = Redis(connection_pool=get_redis_pool())
    try:
        active = await get_active_session(redis)
        if active:
            return
        name = _session_name_for(datetime.now(WAT))
        await create_session(redis, name, AUTO_LOCATION_ID, AUTO_CREATED_BY)
        logger.info("auto_session_created", name=name)
    except Exception as e:
        logger.error("auto_session_error", error=str(e))
    finally:
        await redis.aclose()


def _seconds_until_next_6am_wat() -> float:
    now = datetime.now(WAT)
    next_run = now.replace(hour=AUTO_SESSION_HOUR, minute=0, second=0, microsecond=0)
    if now >= next_run:
        next_run += timedelta(days=1)
    return (next_run - now).total_seconds()


async def auto_session_loop() -> None:
    """
    Runs forever as an asyncio background task.
    - On startup: creates a session if none is active.
    - Every morning at 6 AM WAT: creates a new session for the day.
    """
    # Startup check — handles the case where the server restarts mid-day
    await _ensure_session()

    while True:
        sleep_secs = _seconds_until_next_6am_wat()
        logger.info("auto_session_scheduled", seconds_until_next=round(sleep_secs))
        await asyncio.sleep(sleep_secs)
        await _ensure_session()
