import time
import uuid
import hashlib
import base64
from cryptography.fernet import Fernet
from itsdangerous import URLSafeTimedSerializer, BadSignature, SignatureExpired
from redis.asyncio import Redis
from app.config import get_settings
from app.core.logging import logger

settings = get_settings()

# Serializer uses QR_SESSION_SECRET — separate from JWT secret
serializer = URLSafeTimedSerializer(settings.QR_SESSION_SECRET)

# Fernet key derived from the same secret for encryption
_fernet_key = base64.urlsafe_b64encode(
    hashlib.sha256(settings.QR_SESSION_SECRET.encode()).digest()
)
cipher = Fernet(_fernet_key)

# Redis key patterns
QR_SESSION_KEY = "qr:session:{session_id}"        # Active session metadata
QR_TOKEN_KEY = "qr:token:{token_hash}"            # Active token
QR_USED_KEY = "qr:used:{token_hash}"              # Used token (anti-replay)

# Type identifier for the QR code — ensures only our app processes these tokens
QR_TYPE = "ratel-attendance"


def _make_token_payload(session_id: str, location_id: str, shift: str | None = None) -> dict:
    """Build the payload embedded in the QR token."""
    return {
        "type": QR_TYPE,
        "session_id": session_id,
        "location_id": location_id,
        "shift": shift,
        "nonce": uuid.uuid4().hex,  # Unique per token — prevents replay
        "iat": int(time.time()),
    }


def generate_qr_token(session_id: str, location_id: str, shift: str | None = None) -> str:
    """
    Generate a signed and ENCRYPTED time-bound QR token.
    Returns an encrypted string that generic scanners cannot read.
    """
    payload = _make_token_payload(session_id, location_id, shift)
    signed_token = serializer.dumps(payload)
    
    # Encrypt the signed token
    encrypted_token = cipher.encrypt(signed_token.encode()).decode()
    
    logger.info("qr_token_generated", session_id=session_id, location_id=location_id)
    return encrypted_token


def decode_qr_token(token: str, max_age: int | None = None) -> dict | None:
    """
    Decrypt and decode a QR token.
    Returns the payload dict or None if invalid/expired.
    
    Robustness: Handles both raw tokens and full URLs.
    """
    if not token:
        return None

    # Handle case where full URL is passed instead of just the token
    if "token=" in token:
        try:
            token = token.split("token=")[-1].split("&")[0]
        except Exception:
            pass

    try:
        # 1. Decrypt first
        try:
            decrypted_token = cipher.decrypt(token.encode()).decode()
        except Exception:
            logger.warning("qr_token_decryption_failed", token_prefix=token[:10])
            return None

        # 2. Decode and verify signature
        # max_age enforces the TTL at the signature level
        age = max_age or settings.QR_TOKEN_TTL_SECONDS
        return serializer.loads(decrypted_token, max_age=age)
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
