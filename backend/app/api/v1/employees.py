import os
import re
import io
import time
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, distinct
from app.database import get_db
from app.models.user import User
from app.models.attendance import Attendance
from app.models.device import DeviceBinding
from app.schemas.user import UserResponse, UserCreate, UserUpdate
from app.api.deps import require_admin
from app.core.security import hash_password
from app.core.logging import logger

router = APIRouter(prefix="/employees", tags=["Employees"])

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "static", "uploads", "referees")


def parse_referee_pdf(pdf_bytes: bytes) -> dict:
    extracted = {
        "referee_name": None,
        "referee_phone": None,
        "referee_email": None,
        "referee_relationship": None,
        "referee_notes": None,
    }
    try:
        from pypdf import PdfReader
        reader = PdfReader(io.BytesIO(pdf_bytes))
        full_text = "\n".join([page.extract_text() or "" for page in reader.pages])

        if full_text.strip():
            extracted["referee_notes"] = full_text[:600].strip()

            # Email extraction
            emails = re.findall(r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}', full_text)
            if emails:
                extracted["referee_email"] = emails[0]

            # Phone extraction
            phones = re.findall(r'(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}', full_text)
            if phones:
                extracted["referee_phone"] = phones[0]

            # Line by line inspection
            for line in full_text.splitlines():
                line_str = line.strip()
                if not line_str:
                    continue
                lower = line_str.lower()
                if "referee name" in lower or "name:" in lower:
                    extracted["referee_name"] = re.sub(r'(?i)referee\s*name\s*:\s*|name\s*:\s*', '', line_str).strip()
                elif "relationship" in lower or "relation" in lower:
                    extracted["referee_relationship"] = re.sub(r'(?i)relationship\s*:\s*|relation\s*:\s*', '', line_str).strip()
                elif ("position:" in lower or "title:" in lower or "designation:" in lower) and not extracted["referee_relationship"]:
                    extracted["referee_relationship"] = re.sub(r'(?i)position\s*:\s*|title\s*:\s*|designation\s*:\s*', '', line_str).strip()

            if not extracted["referee_name"]:
                lines = [l.strip() for l in full_text.splitlines() if l.strip()]
                if lines:
                    extracted["referee_name"] = lines[0][:100]
    except Exception as e:
        logger.warning("pdf_parsing_warning", error=str(e))

    return extracted


async def _get_days_present(db: AsyncSession, user_id) -> int:
    result = await db.execute(
        select(func.count(distinct(func.date(Attendance.checked_in_at))))
        .where(Attendance.employee_id == user_id)
    )
    return result.scalar_one_or_none() or 0


@router.get("/", response_model=list[UserResponse])
async def list_employees(
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
    include_deactivated: bool = True,
):
    query = select(User)
    if not include_deactivated:
        query = query.where(User.is_active == True)  # noqa: E712

    result = await db.execute(query)
    users = result.scalars().all()

    response_list = []
    for u in users:
        dp = await _get_days_present(db, u.id)
        response_list.append(UserResponse.from_orm_with_dept(u, days_present=dp))
    return response_list


@router.get("/{employee_id}/detail", response_model=UserResponse)
async def get_employee_detail(
    employee_id: str,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    from sqlalchemy import or_, String
    result = await db.execute(
        select(User).where(
            or_(
                User.employee_id == employee_id,
                func.cast(User.id, String) == employee_id,
            )
        )
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Employee not found")

    dp = await _get_days_present(db, user.id)
    return UserResponse.from_orm_with_dept(user, days_present=dp)


@router.post("/{employee_id}/upload-referee-pdf", response_model=UserResponse)
async def upload_referee_pdf(
    employee_id: str,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    from sqlalchemy import or_, String
    result = await db.execute(
        select(User).where(
            or_(
                User.employee_id == employee_id,
                func.cast(User.id, String) == employee_id,
            )
        )
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Employee not found")

    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are accepted")

    os.makedirs(UPLOAD_DIR, exist_ok=True)
    timestamp = int(time.time())
    safe_emp = re.sub(r'[^a-zA-Z0-9_-]', '', user.employee_id)
    saved_filename = f"{safe_emp}_referee_{timestamp}.pdf"
    file_path = os.path.join(UPLOAD_DIR, saved_filename)

    pdf_bytes = await file.read()
    with open(file_path, "wb") as f:
        f.write(pdf_bytes)

    # Parse PDF contents
    extracted = parse_referee_pdf(pdf_bytes)

    user.referee_pdf_filename = saved_filename
    if extracted["referee_name"]:
        user.referee_name = extracted["referee_name"]
    if extracted["referee_phone"]:
        user.referee_phone = extracted["referee_phone"]
    if extracted["referee_email"]:
        user.referee_email = extracted["referee_email"]
    if extracted["referee_relationship"]:
        user.referee_relationship = extracted["referee_relationship"]
    if extracted["referee_notes"]:
        user.referee_notes = extracted["referee_notes"]

    await db.flush()
    await db.refresh(user)
    logger.info("referee_pdf_uploaded", employee_id=user.employee_id, filename=saved_filename)

    dp = await _get_days_present(db, user.id)
    return UserResponse.from_orm_with_dept(user, days_present=dp)


@router.post("/", response_model=UserResponse, status_code=201)
async def create_employee(
    payload: UserCreate,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    existing_query = select(User).where(
        (User.email == payload.email) | (User.employee_id == payload.employee_id)
    )
    result = await db.execute(existing_query)
    existing_user = result.scalar_one_or_none()

    if existing_user:
        if not existing_user.is_active:
            existing_user.is_active = True
            existing_user.full_name = payload.full_name
            if payload.password:
                existing_user.hashed_password = hash_password(payload.password)
            existing_user.department_id = payload.department_id
            existing_user.location_id = payload.location_id
            existing_user.role = payload.role
            existing_user.phone_number = payload.phone_number
            existing_user.address = payload.address
            existing_user.designation = payload.designation
            existing_user.referee_name = payload.referee_name
            existing_user.referee_phone = payload.referee_phone
            existing_user.referee_email = payload.referee_email
            existing_user.referee_relationship = payload.referee_relationship
            existing_user.referee_notes = payload.referee_notes

            await db.flush()
            await db.refresh(existing_user)
            dp = await _get_days_present(db, existing_user.id)
            logger.info("employee_reactivated", employee_id=existing_user.employee_id, by=str(_admin.id))
            return UserResponse.from_orm_with_dept(existing_user, days_present=dp)
        else:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="An active employee with this Email or Employee ID already exists",
            )

    user = User(
        email=payload.email,
        full_name=payload.full_name,
        employee_id=payload.employee_id,
        hashed_password=hash_password(payload.password) if payload.password else "no_password_set",
        role=payload.role,
        location_id=payload.location_id,
        department_id=payload.department_id,
        phone_number=payload.phone_number,
        address=payload.address,
        designation=payload.designation,
        referee_name=payload.referee_name,
        referee_phone=payload.referee_phone,
        referee_email=payload.referee_email,
        referee_relationship=payload.referee_relationship,
        referee_notes=payload.referee_notes,
    )
    db.add(user)
    await db.flush()
    await db.refresh(user)

    logger.info("employee_created", employee_id=user.employee_id, by=str(_admin.id))
    return UserResponse.from_orm_with_dept(user, days_present=0)


@router.patch("/{employee_id}", response_model=UserResponse)
async def update_employee(
    employee_id: str,
    payload: UserUpdate,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    result = await db.execute(
        select(User).where(User.employee_id == employee_id)
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Employee not found")

    update_data = payload.model_dump(exclude_unset=True)

    if "password" in update_data:
        password = update_data.pop("password")
        if password:
            user.hashed_password = hash_password(password)

    for field, value in update_data.items():
        setattr(user, field, value)

    await db.flush()
    await db.refresh(user)

    dp = await _get_days_present(db, user.id)
    logger.info("employee_updated", employee_id=employee_id, by=str(_admin.id))
    return UserResponse.from_orm_with_dept(user, days_present=dp)


@router.patch("/{employee_id}/deactivate", response_model=UserResponse)
async def deactivate_employee(
    employee_id: str,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    result = await db.execute(
        select(User).where(User.employee_id == employee_id)
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Employee not found")

    user.is_active = False
    await db.flush()
    await db.refresh(user)

    dp = await _get_days_present(db, user.id)
    logger.info("employee_deactivated", employee_id=employee_id, by=str(_admin.id))
    return UserResponse.from_orm_with_dept(user, days_present=dp)


@router.patch("/{employee_id}/activate", response_model=UserResponse)
async def activate_employee(
    employee_id: str,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    result = await db.execute(
        select(User).where(User.employee_id == employee_id)
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Employee not found")

    user.is_active = True
    await db.flush()
    await db.refresh(user)

    dp = await _get_days_present(db, user.id)
    logger.info("employee_activated", employee_id=employee_id, by=str(_admin.id))
    return UserResponse.from_orm_with_dept(user, days_present=dp)


@router.delete("/{employee_id}/purge")
async def purge_employee(
    employee_id: str,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    """Permanently delete an employee and all their data."""
    from sqlalchemy import delete

    result = await db.execute(
        select(User).where(User.employee_id == employee_id)
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Employee not found")

    user_uuid = user.id

    try:
        await db.execute(delete(Attendance).where(Attendance.employee_id == user_uuid))
        await db.execute(delete(DeviceBinding).where(DeviceBinding.employee_id == user_uuid))

        await db.delete(user)
        await db.commit()

        logger.info("employee_purged", employee_id=employee_id, by=str(_admin.id))
        return {"message": "Employee and all associated records purged permanently"}
    except Exception as e:
        await db.rollback()
        logger.error("employee_purge_failed", employee_id=employee_id, error=str(e))
        raise HTTPException(
            status_code=500,
            detail=f"Failed to purge employee: {str(e)}"
        )