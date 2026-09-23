import os
import re
import io
import time
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from fastapi.responses import FileResponse
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
AVATAR_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "static", "uploads", "avatars")


def _clean_ocr_name(val: str) -> str:
    val = re.sub(r'[\._\-\(\)]+', ' ', val).strip()
    words = [w.capitalize() for w in val.split() if len(w) > 1 and not any(c.isdigit() for c in w)]
    return ' '.join(words)


def _extract_single_referee_info(full_text: str) -> dict:
    info = {
        "name": None,
        "phone": None,
        "relationship": None,
    }
    if not full_text:
        return info

    # 1. Telephone Nos (11-digit local 07/08/09 or 13-digit +234)
    cleaned_text = re.sub(r'\((?:68|80|90|70)', '08', full_text)
    phone_candidates = re.findall(r'(?:0|\+?234)[\d\s-]{8,18}', cleaned_text)
    for p in phone_candidates:
        clean_p = re.sub(r'[^\d]', '', p)
        if len(clean_p) == 11 and clean_p.startswith(('07', '08', '09')) and not clean_p.startswith('064'):
            info["phone"] = clean_p
            break
        elif len(clean_p) == 13 and clean_p.startswith('234'):
            info["phone"] = '+' + clean_p
            break

    # 2. Relationship to Applicant
    rel_match = re.search(r'Relationship\s*(?:to\s*Applicant)?\s*[:.\s-]+\s*([A-Za-z\s]{3,30})', full_text, re.IGNORECASE)
    if rel_match:
        rel_val = re.sub(r'[\._\-\(\)]+', '', rel_match.group(1)).strip()
        if rel_val and len(rel_val) >= 3 and not any(w in rel_val.lower() for w in ["if not related", "state any", "applicant"]):
            info["relationship"] = rel_val.title()

    if not info["relationship"] and any(w in full_text.lower() for w in ["guarantor", "guarantor form"]):
        info["relationship"] = "Guarantor"

    # 3. Name: Try Name line, DECLARATION line, or PARTICULARS OF THE GUARANTOR line
    m_name = re.search(r'(?:Name|Guarantor|Referee)\s*[\.\s\:\_]+\s*([A-Za-z\s]{4,60})', full_text, re.IGNORECASE)
    if m_name:
        cand = _clean_ocr_name(m_name.group(1))
        if len(cand) > 3 and not any(w in cand.lower() for w in ["declaration", "ratel", "guarantor", "applicant", "profession", "occupation", "particulars", "including", "prosecution", "form", "of no"]):
            info["name"] = cand

    if not info["name"]:
        decl_matches = re.findall(r'DECLARATION[\s\S]*?\n\s*([A-Za-z\s]{4,60})', full_text, re.IGNORECASE)
        for raw in decl_matches:
            cand = _clean_ocr_name(raw)
            if len(cand) > 3 and not any(w in cand.lower() for w in ["declaration", "ratel", "guarantor", "applicant", "including", "prosecution", "gave above", "form", "of no"]):
                info["name"] = cand
                break

    if not info["name"]:
        m_i = re.search(r'\bI\s+([A-Za-z\s]{4,60})\s+(?:a|an|\(Full Name\)|Nigerian)', full_text, re.IGNORECASE)
        if m_i:
            cand = _clean_ocr_name(m_i.group(1))
            if len(cand) > 3 and not any(w in cand.lower() for w in ["declaration", "ratel", "guarantor", "applicant", "gave above"]):
                info["name"] = cand

    return info


def parse_referee_pdf(pdf_bytes: bytes) -> dict:
    extracted = {
        "referee_name": None, "referee_phone": None, "referee_email": None, "referee_relationship": None, "referee_notes": None,
        "referee2_name": None, "referee2_phone": None, "referee2_email": None, "referee2_relationship": None, "referee2_notes": None,
    }
    try:
        from pypdf import PdfReader
        reader = PdfReader(io.BytesIO(pdf_bytes))
        pages_ocr = []

        for page in reader.pages:
            t = page.extract_text() or ""
            if len(t.strip()) < 30:
                ocr_texts = []
                try:
                    import pytesseract
                    from PIL import Image
                    for img_file in page.images:
                        try:
                            pil_img = Image.open(io.BytesIO(img_file.data))
                            ocr_t = pytesseract.image_to_string(pil_img)
                            if ocr_t.strip():
                                ocr_texts.append(ocr_t.strip())
                        except Exception:
                            pass
                except Exception as ocr_err:
                    logger.warning("ocr_extraction_warning", error=str(ocr_err))

                if ocr_texts:
                    t = "\n".join(ocr_texts).strip()
            pages_ocr.append(t)

        if not pages_ocr or not any(p.strip() for p in pages_ocr):
            return extracted

        # Group pages into Referee 1 (Page 1 & 2) and Referee 2 (Page 3 & 4)
        ref1_text = pages_ocr[0] if len(pages_ocr) > 0 else ""
        if len(pages_ocr) >= 2:
            ref1_text += "\n" + pages_ocr[1]

        ref2_text = pages_ocr[2] if len(pages_ocr) >= 3 else ""
        if len(pages_ocr) >= 4:
            ref2_text += "\n" + pages_ocr[3]

        ref1_info = _extract_single_referee_info(ref1_text)
        ref2_info = _extract_single_referee_info(ref2_text) if ref2_text else {}

        extracted["referee_name"] = ref1_info.get("name")
        extracted["referee_phone"] = ref1_info.get("phone")
        extracted["referee_relationship"] = ref1_info.get("relationship")

        extracted["referee2_name"] = ref2_info.get("name")
        extracted["referee2_phone"] = ref2_info.get("phone")
        extracted["referee2_relationship"] = ref2_info.get("relationship")

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
    if extracted.get("referee_name"):
        user.referee_name = extracted["referee_name"]
    if extracted.get("referee_phone"):
        user.referee_phone = extracted["referee_phone"]
    if extracted.get("referee_email"):
        user.referee_email = extracted["referee_email"]
    if extracted.get("referee_relationship"):
        user.referee_relationship = extracted["referee_relationship"]
    if extracted.get("referee_notes"):
        user.referee_notes = extracted["referee_notes"]

    if extracted.get("referee2_name"):
        user.referee2_name = extracted["referee2_name"]
    if extracted.get("referee2_phone"):
        user.referee2_phone = extracted["referee2_phone"]
    if extracted.get("referee2_email"):
        user.referee2_email = extracted["referee2_email"]
    if extracted.get("referee2_relationship"):
        user.referee2_relationship = extracted["referee2_relationship"]
    if extracted.get("referee2_notes"):
        user.referee2_notes = extracted["referee2_notes"]

    await db.flush()
    await db.refresh(user)
    logger.info("referee_pdf_uploaded", employee_id=user.employee_id, filename=saved_filename)

    dp = await _get_days_present(db, user.id)
    return UserResponse.from_orm_with_dept(user, days_present=dp)


@router.delete("/{employee_id}/referee-pdf", response_model=UserResponse)
async def delete_referee_pdf(
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

    if user.referee_pdf_filename:
        old_file = os.path.join(UPLOAD_DIR, user.referee_pdf_filename)
        if os.path.exists(old_file):
            try:
                os.remove(old_file)
            except Exception as e:
                logger.warning("failed_to_delete_old_pdf", filename=user.referee_pdf_filename, error=str(e))
        user.referee_pdf_filename = None

    user.referee_name = None
    user.referee_phone = None
    user.referee_email = None
    user.referee_relationship = None
    user.referee_notes = None

    user.referee2_name = None
    user.referee2_phone = None
    user.referee2_email = None
    user.referee2_relationship = None
    user.referee2_notes = None

    await db.flush()
    await db.refresh(user)
    logger.info("referee_pdf_deleted", employee_id=user.employee_id)

    dp = await _get_days_present(db, user.id)
    return UserResponse.from_orm_with_dept(user, days_present=dp)


@router.post("/{employee_id}/upload-picture", response_model=UserResponse)
async def upload_employee_picture(
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

    ext = os.path.splitext(file.filename.lower())[1]
    if ext not in (".jpg", ".jpeg", ".png", ".webp"):
        raise HTTPException(status_code=400, detail="Only image files (.jpg, .jpeg, .png, .webp) are accepted")

    os.makedirs(AVATAR_DIR, exist_ok=True)
    timestamp = int(time.time())
    safe_emp = re.sub(r'[^a-zA-Z0-9_-]', '', user.employee_id)
    saved_filename = f"{safe_emp}_picture_{timestamp}{ext}"
    file_path = os.path.join(AVATAR_DIR, saved_filename)

    if user.profile_picture_filename:
        old_file = os.path.join(AVATAR_DIR, user.profile_picture_filename)
        if os.path.exists(old_file):
            try:
                os.remove(old_file)
            except Exception:
                pass

    content = await file.read()
    with open(file_path, "wb") as f:
        f.write(content)

    user.profile_picture_filename = saved_filename
    await db.flush()
    await db.refresh(user)
    logger.info("employee_picture_uploaded", employee_id=user.employee_id, filename=saved_filename)

    dp = await _get_days_present(db, user.id)
    return UserResponse.from_orm_with_dept(user, days_present=dp)


@router.get("/picture/{filename}")
async def get_employee_picture_file(filename: str):
    safe_filename = os.path.basename(filename)
    file_path = os.path.join(AVATAR_DIR, safe_filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Picture not found")
    return FileResponse(file_path)


@router.get("/referee-pdf/{filename}")
async def get_referee_pdf_file(filename: str):
    safe_filename = os.path.basename(filename)
    file_path = os.path.join(UPLOAD_DIR, safe_filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="PDF not found")
    return FileResponse(file_path, media_type="application/pdf")


@router.delete("/{employee_id}/picture", response_model=UserResponse)
async def delete_employee_picture(
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

    if user.profile_picture_filename:
        file_path = os.path.join(AVATAR_DIR, user.profile_picture_filename)
        if os.path.exists(file_path):
            try:
                os.remove(file_path)
            except Exception as e:
                logger.warning("delete_picture_warning", error=str(e))
        user.profile_picture_filename = None

    await db.flush()
    await db.refresh(user)
    logger.info("employee_picture_deleted", employee_id=user.employee_id)

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
            existing_user.referee2_name = payload.referee2_name
            existing_user.referee2_phone = payload.referee2_phone
            existing_user.referee2_email = payload.referee2_email
            existing_user.referee2_relationship = payload.referee2_relationship
            existing_user.referee2_notes = payload.referee2_notes

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
        referee2_name=payload.referee2_name,
        referee2_phone=payload.referee2_phone,
        referee2_email=payload.referee2_email,
        referee2_relationship=payload.referee2_relationship,
        referee2_notes=payload.referee2_notes,
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