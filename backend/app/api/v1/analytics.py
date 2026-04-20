from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, cast, Date
from datetime import datetime, timezone, timedelta
from app.database import get_db
from app.models.attendance import Attendance, AttendanceStatus, CheckStatus
from app.models.user import User
from app.api.deps import require_admin

router = APIRouter(prefix="/analytics", tags=["Analytics"])


@router.get("/overview")
async def get_overview(
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    """Summary cards — today's stats."""
    today = datetime.now(timezone.utc).date()

    # Total active employees
    total_result = await db.execute(
        select(func.count(User.id)).where(User.is_active == True)  # noqa: E712
    )
    total_employees = total_result.scalar() or 0

    # Today's check-ins
    today_result = await db.execute(
        select(Attendance).where(
            cast(Attendance.checked_in_at, Date) == today
        )
    )
    today_records = today_result.scalars().all()

    present = sum(1 for r in today_records
                  if r.status == AttendanceStatus.PRESENT)
    late = sum(1 for r in today_records
               if r.status == AttendanceStatus.LATE)
    checked_out = sum(1 for r in today_records
                      if r.check_status == CheckStatus.CHECKED_OUT)

    hours = [r.hours_clocked for r in today_records if r.hours_clocked]
    avg_hours = round(sum(hours) / len(hours), 2) if hours else 0.0

    return {
        "total_employees": total_employees,
        "present_today": present + late,
        "present_on_time": present,
        "late_today": late,
        "checked_out": checked_out,
        "avg_hours_today": avg_hours,
        "attendance_rate": round(
            ((present + late) / total_employees * 100), 1
        ) if total_employees else 0,
    }


@router.get("/daily-trend")
async def get_daily_trend(
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    """Bar chart data — attendance per day for last 7 days."""
    today = datetime.now(timezone.utc).date()
    days = []

    for i in range(6, -1, -1):
        day = today - timedelta(days=i)
        result = await db.execute(
            select(Attendance).where(
                cast(Attendance.checked_in_at, Date) == day
            )
        )
        records = result.scalars().all()
        present = sum(1 for r in records
                      if r.status == AttendanceStatus.PRESENT)
        late = sum(1 for r in records
                   if r.status == AttendanceStatus.LATE)
        days.append({
            "date": day.strftime("%a"),  # Mon, Tue, etc.
            "full_date": day.isoformat(),
            "present": present,
            "late": late,
            "total": present + late,
        })

    return {"days": days}


@router.get("/top-performers")
async def get_top_performers(
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    """Top employees by hours clocked this week."""
    today = datetime.now(timezone.utc).date()
    week_start = today - timedelta(days=today.weekday())

    result = await db.execute(
        select(Attendance).where(
            cast(Attendance.checked_in_at, Date) >= week_start,
            Attendance.hours_clocked.isnot(None),
        )
    )
    records = result.scalars().all()

    employee_hours: dict[str, dict] = {}
    for r in records:
        emp_id = str(r.employee.id)
        if emp_id not in employee_hours:
            employee_hours[emp_id] = {
                "name": r.employee.full_name,
                "employee_id": r.employee.employee_id,
                "total_hours": 0.0,
                "days_present": 0,
            }
        employee_hours[emp_id]["total_hours"] += r.hours_clocked or 0
        employee_hours[emp_id]["days_present"] += 1

    sorted_performers = sorted(
        employee_hours.values(),
        key=lambda x: x["total_hours"],
        reverse=True,
    )[:5]  # Top 5

    return {"performers": sorted_performers}


@router.get("/status-breakdown")
async def get_status_breakdown(
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    """Donut chart — present vs late this week."""
    today = datetime.now(timezone.utc).date()
    week_start = today - timedelta(days=today.weekday())

    result = await db.execute(
        select(Attendance).where(
            cast(Attendance.checked_in_at, Date) >= week_start
        )
    )
    records = result.scalars().all()

    present = sum(1 for r in records
                  if r.status == AttendanceStatus.PRESENT)
    late = sum(1 for r in records
               if r.status == AttendanceStatus.LATE)

    return {
        "present": present,
        "late": late,
        "total": present + late,
    }