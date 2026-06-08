from fastapi import APIRouter, Request, Query, Response
from fastapi.responses import HTMLResponse, FileResponse
from fastapi.templating import Jinja2Templates
from datetime import datetime, timezone, timedelta
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
                # First check current session
                att_result = await db.execute(
                    select(Attendance).where(
                        Attendance.employee_id == known_employee.id,
                        Attendance.session_id == token_data["session_id"],
                    )
                )
                attendance = att_result.scalar_one_or_none()
                
                if attendance:
                    check_status = attendance.check_status.value
                else:
                    # If no record in current session, check cross-session for active check-in.
                    # Must match the 36h window used in the actual check-in endpoint.
                    cutoff = datetime.now(timezone.utc) - timedelta(hours=36)
                    recent_in = await db.execute(
                        select(Attendance)
                        .where(
                            Attendance.employee_id == known_employee.id,
                            Attendance.check_status == CheckStatus.CHECKED_IN,
                            Attendance.checked_in_at >= cutoff
                        )
                        .order_by(Attendance.checked_in_at.desc())
                        .limit(1)
                    )
                    recent_attendance = recent_in.scalar_one_or_none()
                    if recent_attendance:
                        # They have an active check‑in from another session
                        check_status = "checked_in"

    logger.info("mobile_checkin_page_loaded",
                session_id=token_data["session_id"],
                known=known_employee is not None)

    return templates.TemplateResponse(
        request=request,
        name="checkin.html",
        context={
            "qr_token": token,
            "session_id": token_data["session_id"],
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
    now_utc = datetime.now(timezone.utc).isoformat()
    return templates.TemplateResponse(
        request=request,
        name="success.html",
        context={
            "name": name,
            "status": status,
            "action": action,
            "session": session,
            "hours": hours,
            "time_utc": now_utc,
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