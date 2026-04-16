import time
import uuid
from itsdangerous import URLSafeTimedSerializer, BadSignature, SignatureExpired
from redis.asyncio import Redis
from app.config import get_settings
from app.core.logging import logger

settings = get_settings()

# Serializer uses QR_SESSION_SECRET — separate from JWT secret
serializer = URLSafeTimedSerializer(settings.QR_SESSION_SECRET)

# Redis key patterns
QR_SESSION_KEY = "qr:session:{session_id}"        # Active session metadata
QR_TOKEN_KEY = "qr:token:{token_hash}"            # Active token
QR_USED_KEY = "qr:used:{token_hash}"              # Used token (anti-replay)


def _make_token_payload(session_id: str, location_id: str) -> dict:
    """Build the payload embedded in the QR token."""
    return {
        "session_id": session_id,
        "location_id": location_id,
        "nonce": uuid.uuid4().hex,  # Unique per token — prevents replay
        "iat": int(time.time()),
    }


def generate_qr_token(session_id: str, location_id: str) -> str:
    """
    Generate a signed, time-bound QR token.
    Returns a signed string safe for embedding in a QR code URL.
    """
    payload = _make_token_payload(session_id, location_id)
    token = serializer.dumps(payload)
    logger.info("qr_token_generated", session_id=session_id, location_id=location_id)
    return token


def decode_qr_token(token: str) -> dict | None:
    """
    Decode and validate a QR token.
    Returns the payload dict or None if invalid/expired.
    """
    try:
        # max_age enforces the TTL at the signature level
        return serializer.loads(token, max_age=settings.QR_TOKEN_TTL_SECONDS)
    except SignatureExpired:
        logger.warning("qr_token_expired")
        return None
    except BadSignature:
        logger.warning("qr_token_invalid_signature")
        return None
    except Exception as e:
        logger.error("qr_token_decode_error", error=str(e))
        return None


async def store_active_token(redis: Redis, token: str, session_id: str) -> None:
    """Store token in Redis with TTL. Used to track the currently active token."""
    key = QR_TOKEN_KEY.format(token_hash=_hash_token(token))
    await redis.setex(key, settings.QR_TOKEN_TTL_SECONDS, session_id)


async def is_token_active(redis: Redis, token: str) -> bool:
    """Check if a token is currently active in Redis."""
    key = QR_TOKEN_KEY.format(token_hash=_hash_token(token))
    return await redis.exists(key) == 1


async def consume_token(redis: Redis, token: str) -> bool:
    """
    Consume a token — marks it as used and removes from active pool.
    Returns True if successfully consumed, False if already used.
    Anti-replay: once consumed, token can never be reused.
    """
    token_hash = _hash_token(token)
    active_key = QR_TOKEN_KEY.format(token_hash=token_hash)
    used_key = QR_USED_KEY.format(token_hash=token_hash)

    # Check if already used — anti-replay guard
    if await redis.exists(used_key):
        logger.warning("qr_token_replay_attempt", token_hash=token_hash)
        return False

    # Atomically delete active key and mark as used
    pipe = redis.pipeline()
    pipe.delete(active_key)
    # Keep used marker for 2x TTL to cover edge cases
    pipe.setex(used_key, settings.QR_TOKEN_TTL_SECONDS * 2, "1")
    await pipe.execute()

    logger.info("qr_token_consumed", token_hash=token_hash)
    return True


def _hash_token(token: str) -> str:
    """Short hash of token for use as Redis key — avoids storing full token in key."""
    import hashlib
    return hashlib.sha256(token.encode()).hexdigest()[:32]
