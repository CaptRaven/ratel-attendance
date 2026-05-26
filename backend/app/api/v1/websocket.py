import asyncio
import json
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from redis.asyncio import Redis
from app.core.websocket_manager import manager
from app.core.events import subscribe_to_session
from app.core.security import decode_access_token
from app.redis_client import get_redis_pool
from app.core.logging import logger

router = APIRouter(tags=["WebSocket"])


@router.websocket("/ws/sessions/{session_id}")
async def session_websocket(
    websocket: WebSocket,
    session_id: str,
    token: str = Query(...),
):
    # ── 1. Authenticate ───────────────────────────────────────────────────
    payload = decode_access_token(token)
    if not payload:
        await websocket.close(code=4001, reason="Unauthorized")
        return

    if payload.get("role") != "admin":
        await websocket.close(code=4003, reason="Admin access required")
        return

    # ── 2. Accept and register connection ────────────────────────────────
    await manager.connect(websocket, session_id)
    await websocket.send_json({
        "type": "connected",
        "session_id": session_id,
        "message": "Listening for check-in events...",
    })

    # ── 3. Dedicated Redis connection for pub/sub ─────────────────────────
    pubsub_redis = Redis(connection_pool=get_redis_pool())
    pubsub = await subscribe_to_session(pubsub_redis, session_id)

    async def redis_listener():
        """Continuously listen for Redis pub/sub messages."""
        async for message in pubsub.listen():
            if message["type"] == "message":
                event = json.loads(message["data"])
                await manager.broadcast(session_id, {
                    "type": "checkin",
                    **event,
                })

    async def heartbeat():
        """Send ping every 20 seconds to keep connection alive."""
        while True:
            await asyncio.sleep(20)
            try:
                await websocket.send_json({"type": "ping"})
            except Exception:
                break

    listener_task = None
    heartbeat_task = None

    try:
        # Run both concurrently — listener and heartbeat
        listener_task = asyncio.create_task(redis_listener())
        heartbeat_task = asyncio.create_task(heartbeat())

        # Wait for client to disconnect
        await websocket.receive_text()

    except WebSocketDisconnect:
        logger.info("websocket_client_disconnected", session_id=session_id)

    except Exception as e:
        logger.error("websocket_error", session_id=session_id, error=str(e))

    finally:
        if listener_task:
            listener_task.cancel()
        if heartbeat_task:
            heartbeat_task.cancel()
        manager.disconnect(websocket, session_id)
        await pubsub.unsubscribe()
        await pubsub_redis.aclose()


@router.websocket("/ws/public/sessions/{session_id}")
async def session_websocket_public(
    websocket: WebSocket,
    session_id: str,
):
    """
    Public WebSocket endpoint for kiosk (no auth required).
    """
    # ── 1. Accept and register connection ────────────────────────────────
    await manager.connect(websocket, session_id)
    await websocket.send_json({
        "type": "connected",
        "session_id": session_id,
        "message": "Listening for check-in events...",
    })

    # ── 2. Dedicated Redis connection for pub/sub ─────────────────────────
    pubsub_redis = Redis(connection_pool=get_redis_pool())
    pubsub = await subscribe_to_session(pubsub_redis, session_id)

    async def redis_listener():
        """Continuously listen for Redis pub/sub messages."""
        async for message in pubsub.listen():
            if message["type"] == "message":
                event = json.loads(message["data"])
                await manager.broadcast(session_id, {
                    "type": "checkin",
                    **event,
                })

    async def heartbeat():
        """Send ping every 20 seconds to keep connection alive."""
        while True:
            await asyncio.sleep(20)
            try:
                await websocket.send_json({"type": "ping"})
            except Exception:
                break

    listener_task = None
    heartbeat_task = None

    try:
        # Run both concurrently — listener and heartbeat
        listener_task = asyncio.create_task(redis_listener())
        heartbeat_task = asyncio.create_task(heartbeat())

        # Wait for client to disconnect
        await websocket.receive_text()

    except WebSocketDisconnect:
        logger.info("websocket_public_client_disconnected", session_id=session_id)

    except Exception as e:
        logger.error("websocket_public_error", session_id=session_id, error=str(e))

    finally:
        if listener_task:
            listener_task.cancel()
        if heartbeat_task:
            heartbeat_task.cancel()
        manager.disconnect(websocket, session_id)
        await pubsub.unsubscribe()
        await pubsub_redis.aclose()
