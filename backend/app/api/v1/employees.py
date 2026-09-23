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
        pages_text = [page.extract_text() or "" for page in reader.pages]
        full_text = "\n".join(pages_text).strip()

        if not full_text:
            return extracted

        # Store text excerpt for notes (up to 1000 chars)
        extracted["referee_notes"] = full_text[:1000].strip()

        # 1. Email extraction (most reliable)
        emails = re.findall(r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}', full_text)
        if emails:
            valid_emails = [e for e in emails if not any(domain in e.lower() for domain in ["example.com", "test.com", "domain.com"])]
            extracted["referee_email"] = valid_emails[0] if valid_emails else emails[0]

        # 2. Phone extraction
        phone_patterns = [
            r'(?:\+?234|0)\s*\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,4}',
            r'(?:\+\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}',
            r'(?:Phone|Tel|Mobile|Contact|Cell)\s*[:.-]?\s*([\+?\d\s\(\)-]{7,20})',
        ]
        for pattern in phone_patterns:
            matches = re.findall(pattern, full_text, re.IGNORECASE)
            if matches:
                phone_val = matches[0] if isinstance(matches[0], str) else matches[0]
                phone_clean = re.sub(r'[^\d+]', '', phone_val.strip())
                if len(phone_clean) >= 7:
                    extracted["referee_phone"] = phone_val.strip()
                    break

        # 3. Label-based search line by line
        lines = [line.strip() for line in full_text.splitlines() if line.strip()]

        for i, line in enumerate(lines):
            lower = line.lower()

            # Referee Name patterns
            if not extracted["referee_name"]:
                if any(k in lower for k in ["referee name", "referee's name", "recommender name", "reference name", "name of referee", "referee:"]):
                    val = re.sub(r'(?i)(referee|recommender|reference)\'?s?\s*name\s*[:.-]?\s*|referee\s*:\s*', '', line).strip()
                    if val and len(val) > 2:
                        extracted["referee_name"] = val
                    elif i + 1 < len(lines) and len(lines[i+1]) < 80:
                        extracted["referee_name"] = lines[i+1].strip()

            # Relationship / Designation / Title patterns
            if not extracted["referee_relationship"]:
                if any(k in lower for k in ["relationship", "relation to candidate", "capacity", "designation", "position", "title", "occupation"]):
                    val = re.sub(r'(?i)(relationship|relation\s*to\s*candidate|capacity|designation|position|title|occupation)\s*[:.-]?\s*', '', line).strip()
                    if val and len(val) > 2:
                        extracted["referee_relationship"] = val
                    elif i + 1 < len(lines) and len(lines[i+1]) < 80:
                        extracted["referee_relationship"] = lines[i+1].strip()

        # 4. Fallback signature blocks & titles
        if not extracted["referee_name"]:
            signoff_patterns = [
                r'(?:Sincerely|Yours\s+faithfully|Regards|Best\s+regards|Kind\s+regards)\s*,\s*\n+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})',
                r'Name\s*[:.-]?\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})',
                r'(?:Prof\.|Dr\.|Mr\.|Mrs\.|Ms\.|Engr\.|Chief)\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3}',
            ]
            for pat in signoff_patterns:
                m = re.search(pat, full_text)
                if m:
                    extracted["referee_name"] = m.group(1) if len(m.groups()) > 0 else m.group(0)
                    break

        if not extracted["referee_name"] and lines:
            for l in lines:
                if len(l) < 60 and not any(w in l.lower() for w in ["reference", "recommendation", "letter", "curriculum", "vitae", "resume", "page", "date"]):
                    extracted["referee_name"] = l
                    break

        if not extracted["referee_relationship"]:
            low_full = full_text.lower()
            if "manager" in low_full:
                extracted["referee_relationship"] = "Manager"
            elif "supervisor" in low_full:
                extracted["referee_relationship"] = "Supervisor"
            elif "director" in low_full:
                extracted["referee_relationship"] = "Director"
            elif "professor" in low_full or "head of department" in low_full or "hod" in low_full:
                extracted["referee_relationship"] = "Professor / HOD"
            elif "colleague" in low_full:
                extracted["referee_relationship"] = "Colleague"

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
            existing_user.expected_days_per_week = payload.expected_days_per_week
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
        expected_days_per_week=payload.expected_days_per_week,
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