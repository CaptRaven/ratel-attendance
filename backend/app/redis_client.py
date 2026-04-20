from redis.asyncio import Redis, ConnectionPool
from app.config import get_settings
from app.core.logging import logger

settings = get_settings()

_pool: ConnectionPool | None = None


def get_redis_pool() -> ConnectionPool:
    global _pool
    if _pool is None:
        # Upstash uses rediss:// (SSL) — handle both
        redis_url = settings.REDIS_URL
        ssl = redis_url.startswith("rediss://")

        _pool = ConnectionPool.from_url(
            redis_url,
            max_connections=20,
            decode_responses=True,
            ssl_cert_reqs=None if ssl else None,
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