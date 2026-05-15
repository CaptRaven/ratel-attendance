from fastapi import APIRouter, Request, Query, Response
from fastapi.responses import HTMLResponse, FileResponse
from fastapi.templating import Jinja2Templates
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from fastapi import Cookie, Depends
from app.database import get_db
from app.core.qr_token import decode_qr_token, QR_TYPE
from app.core.session_manager import get_session
from app.redis_client import get_redis_pool
from app.models.device import DeviceBinding
from app.models.user import User
from app.models.attendance import Attendance, CheckStatus
from redis.asyncio import Redis
from app.core.logging import logger
import os

router = APIRouter(tags=["Mobile Check-in"])
templates = Jinja2Templates(directory="app/templates")

DEVICE_COOKIE_NAME = "ratel_device"


@router.get("/sw.js")
async def get_service_worker():
    """Serve the service worker for offline support."""
    content = """
    const CACHE_NAME = 'ratel-offline-v1';
    const OFFLINE_URL = '/checkin';

    self.addEventListener('install', (event) => {
        event.waitUntil(
            caches.open(CACHE_NAME).then((cache) => {
                return cache.addAll([
                    OFFLINE_URL,
                ]);
            })
        );
        self.skipWaiting();
    });

    self.addEventListener('activate', (event) => {
        event.waitUntil(self.clients.claim());
    });

    self.addEventListener('fetch', (event) => {
        if (event.request.mode === 'navigate') {
            event.respondWith(
                fetch(event.request).catch(() => {
                    return caches.match(OFFLINE_URL);
                })
            );
        }
    });
    """
    return Response(content=content, media_type="application/javascript")


@router.get("/checkin", response_class=HTMLResponse)
async def mobile_checkin_page(
    request: Request,
    token: str = Query(...),
    db: AsyncSession = Depends(get_db),
    device_token: Optional[str] = Cookie(default=None, alias=DEVICE_COOKIE_NAME),
):
    # Validate token
    token_data = decode_qr_token(token)
    if not token_data or token_data.get("type") != QR_TYPE:
        return templates.TemplateResponse(
            request=request, name="error.html",
            context={
                "title": "Invalid QR Code",
                "message": "This QR code is invalid or has expired. Please scan the latest code.",
            }, status_code=400,
        )

    # Verify session
    redis = Redis(connection_pool=get_redis_pool())
    session = await get_session(redis, token_data["session_id"])
    await redis.aclose()

    if not session or not session.get("is_active"):
        return templates.TemplateResponse(
            request=request, name="error.html",
            context={
                "title": "Session Closed",
                "message": "This attendance session has ended.",
            }, status_code=400,
        )

    # Resolve known employee from device cookie
    known_employee = None
    check_status = "none"

    if device_token:
        binding_result = await db.execute(
            select(DeviceBinding).where(DeviceBinding.device_token == device_token)
        )
        binding = binding_result.scalar_one_or_none()
        if binding:
            emp_result = await db.execute(
                select(User).where(User.id == binding.employee_id)
            )
            known_employee = emp_result.scalar_one_or_none()

            if known_employee:
                # Check their current status in this session
                att_result = await db.execute(
                    select(Attendance).where(
                        Attendance.employee_id == known_employee.id,
                        Attendance.session_id == token_data["session_id"],
                    )
                )
                attendance = att_result.scalar_one_or_none()
                if attendance:
                    check_status = attendance.check_status.value

    logger.info("mobile_checkin_page_loaded",
                session_id=token_data["session_id"],
                known=known_employee is not None)

    return templates.TemplateResponse(
        request=request,
        name="checkin.html",
        context={
            "qr_token": token,
            "session_name": session["name"],
            "shift": token_data.get("shift"),
            "known_employee": known_employee,
            "check_status": check_status,
        },
    )


@router.get("/checkin/success", response_class=HTMLResponse)
async def checkin_success_page(
    request: Request,
    name: str = Query(...),
    status: str = Query(...),
    action: str = Query(...),
    session: str = Query(...),
    hours: str = Query(default=""),
):
    now = datetime.now(timezone.utc).strftime("%I:%M %p · %b %d, %Y")
    return templates.TemplateResponse(
        request=request,
        name="success.html",
        context={
            "name": name,
            "status": status,
            "action": action,
            "session": session,
            "hours": hours,
            "time": now,
        },
    )

@router.get("/kiosk", response_class=HTMLResponse)
async def kiosk_page(request: Request):
    """
    Tablet kiosk page — fullscreen QR display.
    Admin logs in, starts session, QR auto-rotates.
    """
    return templates.TemplateResponse(
        request=request,
        name="kiosk.html",
        context={},
    )