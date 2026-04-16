from redis.asyncio import Redis, ConnectionPool
from app.config import get_settings
from app.core.logging import logger

settings = get_settings()

_pool: ConnectionPool | None = None


def get_redis_pool() -> ConnectionPool:
    global _pool
    if _pool is None:
        _pool = ConnectionPool.from_url(
            settings.REDIS_URL,
            max_connections=20,
            decode_responses=True,
        )
    return _pool


async def get_redis() -> Redis:
    """FastAPI dependency: yields a Redis client."""
    client = Redis(connection_pool=get_redis_pool())
    try:
        yield client
    except Exception as e:
        logger.error("redis_client_error", error=str(e))
        raise
    finally:
        await client.aclose()