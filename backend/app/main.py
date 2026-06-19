from contextlib import asynccontextmanager
from fastapi import FastAPI, Response, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from redis.asyncio import Redis
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from app.config import get_settings
from app.core.logging import setup_logging, logger
from fastapi.templating import Jinja2Templates  
from app.api.v1 import auth, employees, sessions, checkin, websocket, mobile, reports, department, analytics
from app.database import get_db
from app.redis_client import get_redis

settings = get_settings()

limiter = Limiter(key_func=get_remote_address)


@asynccontextmanager
async def lifespan(app: FastAPI):
    setup_logging()
    logger.info("startup", app=settings.APP_NAME, env=settings.ENVIRONMENT)
    yield
    logger.info("shutdown", app=settings.APP_NAME)


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    docs_url="/docs" if settings.DEBUG else None,
    lifespan=lifespan,
)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

@app.get("/.well-known/apple-app-site-association")
async def get_apple_association():
    with open("app/static/.well-known/apple-app-site-association", "r") as f:
        content = f.read()
    return Response(content=content, media_type="application/json")

@app.get("/.well-known/assetlinks.json")
async def get_android_association():
    with open("app/static/.well-known/assetlinks.json", "r") as f:
        content = f.read()
    return Response(content=content, media_type="application/json")

@app.get("/manifest.json")
async def get_manifest():
    with open("app/static/manifest.json", "r") as f:
        content = f.read()
    return Response(content=content, media_type="application/json")

@app.get("/static/manifest.json")
async def get_static_manifest():
    with open("app/static/manifest.json", "r") as f:
        content = f.read()
    return Response(content=content, media_type="application/json")

app.mount("/static", StaticFiles(directory="app/static"), name="static")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://attendance.ratelplus.net.ng",
        "http://localhost:1420",
        "http://localhost:8000",
        "tauri://localhost",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/v1")
app.include_router(employees.router, prefix="/api/v1")
app.include_router(sessions.router, prefix="/api/v1")
app.include_router(checkin.router, prefix="/api/v1")
app.include_router(websocket.router)
app.include_router(mobile.router)
app.include_router(reports.router, prefix="/api/v1")
app.include_router(department.router, prefix="/api/v1")
app.include_router(analytics.router, prefix="/api/v1")

async def check_database_health(db: AsyncSession) -> bool:
    try:
        await db.execute(text("SELECT 1"))
        return True
    except Exception:
        return False

async def check_redis_health(redis: Redis) -> bool:
    try:
        await redis.ping()
        return True
    except Exception:
        return False

@app.get("/health")
async def health(
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis),
):
    db_status = await check_database_health(db)
    redis_status = await check_redis_health(redis)
    overall_status = "ok" if db_status and redis_status else "degraded"
    return {
        "status": overall_status,
        "version": settings.APP_VERSION,
        "checks": {
            "database": "ok" if db_status else "error",
            "redis": "ok" if redis_status else "error",
        }
    }

@app.get("/kiosk/sw.js")
async def kiosk_service_worker():
    with open("app/static/sw.js", "r") as f:
        content = f.read()
    return Response(content=content, media_type="application/javascript")

@app.get("/api/v1/health")
async def health_v1(
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis),
):
    db_status = await check_database_health(db)
    redis_status = await check_redis_health(redis)
    overall_status = "ok" if db_status and redis_status else "degraded"
    return {
        "status": overall_status,
        "version": settings.APP_VERSION,
        "checks": {
            "database": "ok" if db_status else "error",
            "redis": "ok" if redis_status else "error",
        }
    }
