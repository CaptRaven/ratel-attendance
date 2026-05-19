from contextlib import asynccontextmanager
from fastapi import FastAPI, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.config import get_settings
from app.core.logging import setup_logging, logger
from fastapi.templating import Jinja2Templates  
from app.api.v1 import auth, employees, sessions, checkin, websocket, mobile, reports, department, analytics

settings = get_settings()


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
        "https://ratel-attendance.onrender.com",
        "https://attendance.ratelplus.net.ng",
        "https://ratel-admin.vercel.app",
        "http://102.214.241.12",
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

@app.get("/health")
async def health():
    return {"status": "ok", "version": settings.APP_VERSION}

@app.get("/kiosk/sw.js")
async def kiosk_service_worker():
    with open("app/static/sw.js", "r") as f:
        content = f.read()
    return Response(content=content, media_type="application/javascript")

@app.get("/api/v1/health")
async def health_v1():
    return {"status": "ok", "version": settings.APP_VERSION}
