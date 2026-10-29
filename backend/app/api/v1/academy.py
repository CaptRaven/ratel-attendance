from typing import Optional, List
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, desc

from app.database import get_db
from app.models.academy import AcademyCourse, AcademyEnrollment
from app.models.user import User
from app.schemas.academy import (
    AcademyCourseCreate,
    AcademyCourseUpdate,
    AcademyCourseResponse,
    AcademyEnrollmentCreate,
    AcademyEnrollmentResponse,
    AcademyEnrollmentStatusUpdate,
)
from app.api.deps import require_admin
from app.core.logging import logger

router = APIRouter(prefix="/academy", tags=["Ratel Academy"])


# ==========================================
# Public / Course Endpoints
# ==========================================

@router.get("/courses", response_model=List[AcademyCourseResponse])
async def list_courses(
    category: Optional[str] = None,
    status_filter: Optional[str] = Query(None, alias="status"),
    search: Optional[str] = None,
    active_only: bool = True,
    db: AsyncSession = Depends(get_db),
):
    """
    Public API endpoint to list courses for the website Academy page and admin view.
    """
    stmt = select(AcademyCourse)

    if active_only:
        stmt = stmt.where(AcademyCourse.is_active == True)  # noqa: E712

    if category and category.lower() != "all":
        stmt = stmt.where(AcademyCourse.category.ilike(category))

    if status_filter and status_filter.lower() != "all":
        stmt = stmt.where(AcademyCourse.status.ilike(status_filter))

    if search:
        search_pattern = f"%{search}%"
        stmt = stmt.where(
            or_(
                AcademyCourse.title.ilike(search_pattern),
                AcademyCourse.description.ilike(search_pattern),
                AcademyCourse.location.ilike(search_pattern),
                AcademyCourse.category.ilike(search_pattern),
                AcademyCourse.instructor.ilike(search_pattern),
            )
        )

    stmt = stmt.order_by(desc(AcademyCourse.created_at))
    result = await db.execute(stmt)
    courses = result.scalars().all()
    return [AcademyCourseResponse.model_validate(c) for c in courses]


@router.get("/courses/{course_id}", response_model=AcademyCourseResponse)
async def get_course(
    course_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """
    Public API endpoint to fetch details of a specific course.
    """
    result = await db.execute(select(AcademyCourse).where(AcademyCourse.id == course_id))
    course = result.scalar_one_or_none()
    if not course:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Academy course not found",
        )
    return AcademyCourseResponse.model_validate(course)


@router.post("/courses", response_model=AcademyCourseResponse, status_code=status.HTTP_201_CREATED)
async def create_course(
    payload: AcademyCourseCreate,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    """
    Admin-only endpoint to add a new course or training program.
    """
    course = AcademyCourse(
        title=payload.title,
        code=payload.code,
        category=payload.category,
        description=payload.description,
        syllabus=payload.syllabus,
        prerequisites=payload.prerequisites,
        instructor=payload.instructor,
        location=payload.location,
        format=payload.format,
        duration=payload.duration,
        schedule=payload.schedule,
        fee=payload.fee,
        status=payload.status,
        start_date=payload.start_date,
        end_date=payload.end_date,
        capacity=payload.capacity,
        enrolled_count=0,
        is_active=True,
    )
    db.add(course)
    await db.flush()
    await db.refresh(course)

    logger.info("academy_course_created", course_id=str(course.id), title=course.title, by=str(_admin.id))
    return AcademyCourseResponse.model_validate(course)


@router.put("/courses/{course_id}", response_model=AcademyCourseResponse)
async def update_course(
    course_id: UUID,
    payload: AcademyCourseUpdate,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    """
    Admin-only endpoint to update an existing course (status, schedule, content, etc.).
    """
    result = await db.execute(select(AcademyCourse).where(AcademyCourse.id == course_id))
    course = result.scalar_one_or_none()
    if not course:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Academy course not found",
        )

    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(course, field, value)

    await db.flush()
    await db.refresh(course)

    logger.info("academy_course_updated", course_id=str(course.id), title=course.title, by=str(_admin.id))
    return AcademyCourseResponse.model_validate(course)


@router.patch("/courses/{course_id}/toggle-status", response_model=AcademyCourseResponse)
async def toggle_course_status(
    course_id: UUID,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    """
    Admin-only endpoint to toggle active/published status of a course.
    """
    result = await db.execute(select(AcademyCourse).where(AcademyCourse.id == course_id))
    course = result.scalar_one_or_none()
    if not course:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Academy course not found",
        )

    course.is_active = not course.is_active
    await db.flush()
    await db.refresh(course)

    logger.info("academy_course_status_toggled", course_id=str(course.id), is_active=course.is_active, by=str(_admin.id))
    return AcademyCourseResponse.model_validate(course)


@router.delete("/courses/{course_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_course(
    course_id: UUID,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    """
    Admin-only endpoint to permanently remove a course.
    """
    result = await db.execute(select(AcademyCourse).where(AcademyCourse.id == course_id))
    course = result.scalar_one_or_none()
    if not course:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Academy course not found",
        )

    await db.delete(course)
    await db.flush()

    logger.info("academy_course_deleted", course_id=str(course_id), by=str(_admin.id))


# ==========================================
# Student Enrollment Endpoints
# ==========================================

@router.post("/enroll", response_model=AcademyEnrollmentResponse, status_code=status.HTTP_201_CREATED)
async def submit_enrollment(
    payload: AcademyEnrollmentCreate,
    db: AsyncSession = Depends(get_db),
):
    """
    Public endpoint for prospective students to apply/register for an Academy course from the website.
    """
    course_title = payload.course_title or "General Academy Application"
    if payload.course_id:
        result = await db.execute(select(AcademyCourse).where(AcademyCourse.id == payload.course_id))
        course = result.scalar_one_or_none()
        if course:
            course_title = course.title
            course.enrolled_count += 1
            await db.flush()

    enrollment = AcademyEnrollment(
        course_id=payload.course_id,
        course_title=course_title,
        full_name=payload.full_name.strip(),
        email=payload.email.strip().lower(),
        phone=payload.phone.strip(),
        education_level=payload.education_level.strip() if payload.education_level else None,
        experience_level=payload.experience_level.strip() if payload.experience_level else None,
        notes=payload.notes.strip() if payload.notes else None,
        status="pending",
    )

    db.add(enrollment)
    await db.flush()
    await db.refresh(enrollment)

    logger.info(
        "academy_enrollment_submitted",
        enrollment_id=str(enrollment.id),
        student=enrollment.full_name,
        email=enrollment.email,
        course=enrollment.course_title,
    )
    return AcademyEnrollmentResponse.model_validate(enrollment)


@router.get("/enrollments", response_model=List[AcademyEnrollmentResponse])
async def list_enrollments(
    course_id: Optional[UUID] = None,
    status_filter: Optional[str] = Query(None, alias="status"),
    search: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    """
    Admin-only endpoint to list student enrollments / applications.
    """
    stmt = select(AcademyEnrollment)

    if course_id:
        stmt = stmt.where(AcademyEnrollment.course_id == course_id)

    if status_filter and status_filter.lower() != "all":
        stmt = stmt.where(AcademyEnrollment.status.ilike(status_filter))

    if search:
        search_pattern = f"%{search}%"
        stmt = stmt.where(
            or_(
                AcademyEnrollment.full_name.ilike(search_pattern),
                AcademyEnrollment.email.ilike(search_pattern),
                AcademyEnrollment.phone.ilike(search_pattern),
                AcademyEnrollment.course_title.ilike(search_pattern),
            )
        )

    stmt = stmt.order_by(desc(AcademyEnrollment.created_at))
    result = await db.execute(stmt)
    enrollments = result.scalars().all()
    return [AcademyEnrollmentResponse.model_validate(e) for e in enrollments]


@router.get("/enrollments/{enrollment_id}", response_model=AcademyEnrollmentResponse)
async def get_enrollment(
    enrollment_id: UUID,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    """
    Admin-only endpoint to view single student enrollment details.
    """
    result = await db.execute(select(AcademyEnrollment).where(AcademyEnrollment.id == enrollment_id))
    enrollment = result.scalar_one_or_none()
    if not enrollment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Enrollment not found",
        )
    return AcademyEnrollmentResponse.model_validate(enrollment)


@router.patch("/enrollments/{enrollment_id}/status", response_model=AcademyEnrollmentResponse)
async def update_enrollment_status(
    enrollment_id: UUID,
    payload: AcademyEnrollmentStatusUpdate,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    """
    Admin-only endpoint to update enrollment status (pending, confirmed, waitlist, cancelled).
    """
    result = await db.execute(select(AcademyEnrollment).where(AcademyEnrollment.id == enrollment_id))
    enrollment = result.scalar_one_or_none()
    if not enrollment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Enrollment not found",
        )

    enrollment.status = payload.status.lower()
    await db.flush()
    await db.refresh(enrollment)

    logger.info("academy_enrollment_status_updated", enrollment_id=str(enrollment.id), status=enrollment.status, by=str(_admin.id))
    return AcademyEnrollmentResponse.model_validate(enrollment)


@router.delete("/enrollments/{enrollment_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_enrollment(
    enrollment_id: UUID,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    """
    Admin-only endpoint to delete a student enrollment.
    """
    result = await db.execute(select(AcademyEnrollment).where(AcademyEnrollment.id == enrollment_id))
    enrollment = result.scalar_one_or_none()
    if not enrollment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Enrollment not found",
        )

    await db.delete(enrollment)
    await db.flush()

    logger.info("academy_enrollment_deleted", enrollment_id=str(enrollment_id), by=str(_admin.id))
