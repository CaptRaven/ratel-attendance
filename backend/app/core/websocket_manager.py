import json
from collections import defaultdict
from fastapi import WebSocket
from app.core.logging import logger


class ConnectionManager:
    """
    Manages active WebSocket connections per session.
    Multiple admin clients can connect to the same session.
    """

    def __init__(self):
        # session_id -> list of active WebSocket connections
        self._connections: dict[str, list[WebSocket]] = defaultdict(list)

    async def connect(self, websocket: WebSocket, session_id: str) -> None:
        await websocket.accept()
        self._connections[session_id].append(websocket)
        logger.info(
            "websocket_connected",
            session_id=session_id,
            total=len(self._connections[session_id]),
        )

    def disconnect(self, websocket: WebSocket, session_id: str) -> None:
        self._connections[session_id].remove(websocket)
        if not self._connections[session_id]:
            del self._connections[session_id]
        logger.info("websocket_disconnected", session_id=session_id)

    async def broadcast(self, session_id: str, message: dict) -> None:
        """Broadcast a message to all connections for a session."""
        connections = self._connections.get(session_id, [])
        dead = []

        for websocket in connections:
            try:
                await websocket.send_json(message)
            except Exception as e:
                logger.warning("websocket_send_failed", error=str(e))
                dead.append(websocket)

        # Clean up dead connections
        for ws in dead:
            self._connections[session_id].remove(ws)

    def get_connection_count(self, session_id: str) -> int:
        return len(self._connections.get(session_id, []))


# Singleton — shared across the entire app
manager = ConnectionManager()