import csv
import io
from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from datetime import datetime, date, timedelta, timezone
from app.database import get_db
from app.models.attendance import Attendance, CheckStatus
from app.models.user import User
from app.api.deps import require_admin
from app.core.logging import logger

router = APIRouter(prefix="/reports", tags=["Reports"])


@router.get("/export")
async def export_attendance_csv(
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
    session_id: str = Query(default=None),
    date_from: date = Query(default=None),
    date_to: date = Query(default=None),
):
    """
    Export attendance as CSV.
    Columns: Name, Department, Check-in, Check-out, Hours Clocked
    Sorted by total hours clocked (highest to lowest).
    """

    # Build query
    query = select(Attendance)

    if session_id:
        query = query.where(Attendance.session_id == session_id)

    if date_from:
        query = query.where(
            func.date(Attendance.checked_in_at) >= date_from
        )

    if date_to:
        query = query.where(
            func.date(Attendance.checked_in_at) <= date_to
        )

    result = await db.execute(query)
    records = result.scalars().all()

    # Aggregate hours per employee
    employee_data: dict[str, dict] = {}

    for r in records:
        emp = r.employee
        emp_id = str(emp.id)

        if emp_id not in employee_data:
            employee_data[emp_id] = {
                "name": emp.full_name,
                "employee_id": emp.employee_id,
                "department": getattr(emp, "department", "—"),
                "total_hours": 0.0,
                "sessions": [],
            }

        employee_data[emp_id]["total_hours"] += r.hours_clocked or 0.0
        employee_data[emp_id]["sessions"].append({
            "session_id": r.session_id,
            "status": r.status.value,
            "check_status": r.check_status.value,
            "checked_in_at": r.checked_in_at.strftime("%Y-%m-%d %H:%M:%S")
            if r.checked_in_at else "—",
            "checked_out_at": r.checked_out_at.strftime("%Y-%m-%d %H:%M:%S")
            if r.checked_out_at else "—",
            "hours": r.hours_clocked or 0.0,
        })

    # Sort by total hours descending
    sorted_employees = sorted(
        employee_data.values(),
        key=lambda x: x["total_hours"],
        reverse=True,
    )

    # Build CSV
    output = io.StringIO()
    writer = csv.writer(output)

    # Header
    writer.writerow([
        "Name",
        "Employee ID",
        "Department",
        "Session ID",
        "Status",
        "Check Status",
        "Check-in Time",
        "Check-out Time",
        "Hours Clocked",
        "Total Hours",
    ])

    # Rows
    for emp in sorted_employees:
        for i, s in enumerate(emp["sessions"]):
            writer.writerow([
                emp["name"] if i == 0 else "",  # Name only on first row
                emp["employee_id"] if i == 0 else "",
                emp["department"] if i == 0 else "",
                s["session_id"],
                s["status"],
                s["check_status"],
                s["checked_in_at"],
                s["checked_out_at"],
                f"{s['hours']:.2f}h",
                f"{emp['total_hours']:.2f}h" if i == 0 else "",
            ])

    output.seek(0)
    filename = f"ratel_attendance_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"

    logger.info("attendance_export", records=len(records), admin=str(_admin.id))

    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@router.get("/summary")
async def get_attendance_summary(
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
    session_id: str = Query(default=None),
):
    """
    Summary view — used by desktop app to show report preview.
    Returns all attendance records sorted by checked_in_at descending.
    """
    query = select(Attendance).order_by(Attendance.checked_in_at.desc())
    if session_id:
        query = query.where(Attendance.session_id == session_id)

    result = await db.execute(query)
    records = result.scalars().all()

    return {
        "total_employees": len(set(r.employee.id for r in records)),
        "records": [
            {
                "employee": r.employee.full_name if r.employee else "Unknown",
                "employee_id": r.employee.employee_id if r.employee else "Unknown",
                "status": r.status.value,
                "check_status": r.check_status.value,
                "checked_in_at": r.checked_in_at,
                "checked_out_at": r.checked_out_at,
                "hours_clocked": r.hours_clocked,
                "shift": r.shift,
            }
            for r in records
        ],
    }


@router.get("/unclosed")
async def get_unclosed_checkins(
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
    older_than_hours: int = Query(default=24, ge=1),
):
    """
    Returns all attendance records still marked as checked_in that are older
    than `older_than_hours`. Used to preview what bulk-checkout will affect.
    """
    cutoff = datetime.now(timezone.utc) - timedelta(hours=older_than_hours)
    result = await db.execute(
        select(Attendance)
        .where(
            Attendance.check_status == CheckStatus.CHECKED_IN,
            Attendance.checked_in_at < cutoff,
        )
        .order_by(Attendance.checked_in_at.asc())
    )
    records = result.scalars().all()

    return {
        "count": len(records),
        "older_than_hours": older_than_hours,
        "records": [
            {
                "employee": r.employee.full_name if r.employee else "Unknown",
                "employee_id": r.employee.employee_id if r.employee else "Unknown",
                "session_id": r.session_id,
                "checked_in_at": r.checked_in_at,
            }
            for r in records
        ],
    }


@router.post("/bulk-checkout")
async def bulk_auto_checkout(
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
    older_than_hours: int = Query(default=24, ge=1),
    default_hours_clocked: float = Query(default=8.0, ge=0.5, le=24.0),
):
    """
    Auto-closes all attendance records that are still checked_in and older than
    `older_than_hours`. Sets checked_out_at = checked_in_at + default_hours_clocked.
    Used to fix historical records where employees never clocked out due to crashes.
    """
    cutoff = datetime.now(timezone.utc) - timedelta(hours=older_than_hours)
    result = await db.execute(
        select(Attendance).where(
            Attendance.check_status == CheckStatus.CHECKED_IN,
            Attendance.checked_in_at < cutoff,
        )
    )
    records = result.scalars().all()

    for record in records:
        record.checked_out_at = record.checked_in_at + timedelta(hours=default_hours_clocked)
        record.hours_clocked = default_hours_clocked
        record.check_status = CheckStatus.CHECKED_OUT

    await db.flush()
    logger.info(
        "bulk_checkout_completed",
        count=len(records),
        default_hours=default_hours_clocked,
        admin=str(admin.id),
    )
    return {
        "message": f"Auto-checked out {len(records)} open attendance records",
        "count": len(records),
        "hours_assigned": default_hours_clocked,
    }


@router.delete("/clear")
async def clear_all_attendance(
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    """Permanently delete ALL attendance records."""
    from sqlalchemy import delete
    await db.execute(delete(Attendance))
    await db.commit()
    logger.info("all_attendance_cleared", by=str(_admin.id))
    return {"message": "All attendance records have been cleared permanently"}