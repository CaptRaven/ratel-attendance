import json
from redis.asyncio import Redis
from app.core.logging import logger

# Redis pub/sub channel pattern
CHECKIN_CHANNEL = "checkin:events:{session_id}"


async def publish_checkin_event(redis: Redis, session_id: str, event: dict) -> None:
    """
    Publish a check-in event to Redis pub/sub channel.
    Called by the check-in endpoint after successful check-in.
    """
    channel = CHECKIN_CHANNEL.format(session_id=session_id)
    await redis.publish(channel, json.dumps(event))
    logger.info("checkin_event_published", session_id=session_id, channel=channel)


async def subscribe_to_session(redis: Redis, session_id: str):
    """
    Subscribe to check-in events for a session.
    Used by WebSocket handler to receive real-time events.
    """
    pubsub = redis.pubsub()
    channel = CHECKIN_CHANNEL.format(session_id=session_id)
    await pubsub.subscribe(channel)
    logger.info("subscribed_to_channel", channel=channel)
    return pubsub