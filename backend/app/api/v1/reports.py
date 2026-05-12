import csv
import io
from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from datetime import datetime, date
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
    Returns employees sorted by total hours.
    """
    query = select(Attendance)
    if session_id:
        query = query.where(Attendance.session_id == session_id)

    result = await db.execute(query)
    records = result.scalars().all()

    employee_data: dict[str, dict] = {}
    for r in records:
        emp = r.employee
        emp_id = str(emp.id)
        if emp_id not in employee_data:
            employee_data[emp_id] = {
                "name": emp.full_name,
                "employee_id": emp.employee_id,
                "total_hours": 0.0,
                "check_status": r.check_status.value,
                "status": r.status.value,
                "checked_in_at": r.checked_in_at,
                "checked_out_at": r.checked_out_at,
            }
        employee_data[emp_id]["total_hours"] += r.hours_clocked or 0.0

    sorted_data = sorted(
        employee_data.values(),
        key=lambda x: x["total_hours"],
        reverse=True,
    )

    return {"total_employees": len(sorted_data), "records": sorted_data}


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