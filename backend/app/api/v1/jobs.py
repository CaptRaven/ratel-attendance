from typing import Optional, List
import os
import uuid
from fastapi import APIRouter, Depends, HTTPException, status, Query, Form, File, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, desc
from uuid import UUID

from app.database import get_db
from app.models.job import JobOpening, JobApplication
from app.models.user import User
from app.schemas.job import (
    JobOpeningCreate,
    JobOpeningUpdate,
    JobOpeningResponse,
    JobApplicationResponse,
    JobApplicationStatusUpdate,
)
from app.api.deps import require_admin
from app.core.logging import logger

router = APIRouter(prefix="/jobs", tags=["Job Openings"])


@router.get("/", response_model=List[JobOpeningResponse])
async def list_jobs(
    category: Optional[str] = None,
    search: Optional[str] = None,
    active_only: bool = True,
    db: AsyncSession = Depends(get_db),
):
    """
    Public API endpoint to list active job openings for website and admin views.
    """
    stmt = select(JobOpening)

    if active_only:
        stmt = stmt.where(JobOpening.is_active == True)  # noqa: E712

    if category and category.lower() != "all":
        stmt = stmt.where(JobOpening.category.ilike(category))

    if search:
        search_pattern = f"%{search}%"
        stmt = stmt.where(
            or_(
                JobOpening.title.ilike(search_pattern),
                JobOpening.department.ilike(search_pattern),
                JobOpening.location.ilike(search_pattern),
                JobOpening.description.ilike(search_pattern),
            )
        )

    stmt = stmt.order_by(desc(JobOpening.created_at))
    result = await db.execute(stmt)
    jobs = result.scalars().all()
    return [JobOpeningResponse.model_validate(job) for job in jobs]


@router.get("/applications", response_model=List[JobApplicationResponse])
async def list_job_applications(
    job_id: Optional[UUID] = None,
    status_filter: Optional[str] = Query(None, alias="status"),
    search: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    """
    Admin-only endpoint to list candidate applications.
    """
    stmt = select(JobApplication)

    if job_id:
        stmt = stmt.where(JobApplication.job_id == job_id)

    if status_filter and status_filter.lower() != "all":
        stmt = stmt.where(JobApplication.status.ilike(status_filter))

    if search:
        search_pattern = f"%{search}%"
        stmt = stmt.where(
            or_(
                JobApplication.full_name.ilike(search_pattern),
                JobApplication.email.ilike(search_pattern),
                JobApplication.phone.ilike(search_pattern),
                JobApplication.job_title.ilike(search_pattern),
            )
        )

    stmt = stmt.order_by(desc(JobApplication.created_at))
    result = await db.execute(stmt)
    applications = result.scalars().all()
    return [JobApplicationResponse.model_validate(app) for app in applications]


@router.post("/apply", response_model=JobApplicationResponse, status_code=status.HTTP_201_CREATED)
async def submit_job_application(
    full_name: str = Form(...),
    email: str = Form(...),
    phone: str = Form(...),
    job_id: Optional[str] = Form(None),
    portfolio_url: Optional[str] = Form(None),
    cover_note: Optional[str] = Form(None),
    resume_file: Optional[UploadFile] = File(None),
    db: AsyncSession = Depends(get_db),
):
    """
    Public API endpoint to submit a job application from the website career page.
    """
    job_uuid: Optional[UUID] = None
    job_title_str = "Spontaneous Application"

    if job_id:
        try:
            job_uuid = UUID(job_id)
            result = await db.execute(select(JobOpening).where(JobOpening.id == job_uuid))
            job = result.scalar_one_or_none()
            if job:
                job_title_str = job.title
        except ValueError:
            pass

    saved_filename: Optional[str] = None
    if resume_file and resume_file.filename:
        upload_dir = "app/static/uploads/resumes"
        os.makedirs(upload_dir, exist_ok=True)
        file_ext = os.path.splitext(resume_file.filename)[1]
        unique_name = f"{uuid.uuid4().hex}{file_ext}"
        saved_path = os.path.join(upload_dir, unique_name)

        content = await resume_file.read()
        with open(saved_path, "wb") as f:
            f.write(content)
        saved_filename = unique_name

    application = JobApplication(
        job_id=job_uuid,
        job_title=job_title_str,
        full_name=full_name.strip(),
        email=email.strip(),
        phone=phone.strip(),
        portfolio_url=portfolio_url.strip() if portfolio_url else None,
        cover_note=cover_note.strip() if cover_note else None,
        resume_filename=saved_filename,
        status="pending",
    )

    db.add(application)
    await db.flush()
    await db.refresh(application)

    logger.info(
        "job_application_submitted",
        application_id=str(application.id),
        candidate=application.full_name,
        email=application.email,
        job_title=application.job_title,
    )

    return JobApplicationResponse.model_validate(application)


@router.get("/applications/{application_id}", response_model=JobApplicationResponse)
async def get_job_application(
    application_id: UUID,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    """
    Admin-only endpoint to get a single job application.
    """
    result = await db.execute(select(JobApplication).where(JobApplication.id == application_id))
    app = result.scalar_one_or_none()
    if not app:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job application not found",
        )
    return JobApplicationResponse.model_validate(app)


@router.patch("/applications/{application_id}/status", response_model=JobApplicationResponse)
async def update_job_application_status(
    application_id: UUID,
    payload: JobApplicationStatusUpdate,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    """
    Admin-only endpoint to update application status (e.g. pending, reviewed, shortlisted, rejected).
    """
    result = await db.execute(select(JobApplication).where(JobApplication.id == application_id))
    app = result.scalar_one_or_none()
    if not app:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job application not found",
        )

    app.status = payload.status.lower()
    await db.flush()
    await db.refresh(app)

    logger.info("job_application_status_updated", application_id=str(app.id), status=app.status, by=str(_admin.id))
    return JobApplicationResponse.model_validate(app)


@router.delete("/applications/{application_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_job_application(
    application_id: UUID,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    """
    Admin-only endpoint to delete a job application.
    """
    result = await db.execute(select(JobApplication).where(JobApplication.id == application_id))
    app = result.scalar_one_or_none()
    if not app:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job application not found",
        )

    if app.resume_filename:
        file_path = os.path.join("app/static/uploads/resumes", app.resume_filename)
        if os.path.exists(file_path):
            try:
                os.remove(file_path)
            except Exception as e:
                logger.warning("failed_to_delete_resume_file", file=file_path, error=str(e))

    await db.delete(app)
    await db.flush()

    logger.info("job_application_deleted", application_id=str(application_id), by=str(_admin.id))


@router.get("/{job_id}", response_model=JobOpeningResponse)
async def get_job(
    job_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """
    Public API endpoint to fetch details of a specific job opening.
    """
    result = await db.execute(select(JobOpening).where(JobOpening.id == job_id))
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job opening not found",
        )
    return JobOpeningResponse.model_validate(job)


@router.post("/", response_model=JobOpeningResponse, status_code=status.HTTP_201_CREATED)
async def create_job(
    payload: JobOpeningCreate,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    """
    Admin-only endpoint to post a new job opening.
    """
    job = JobOpening(
        title=payload.title,
        department=payload.department,
        category=payload.category,
        location=payload.location,
        type=payload.type,
        experience=payload.experience,
        description=payload.description,
        requirements=payload.requirements,
        is_active=True,
    )
    db.add(job)
    await db.flush()
    await db.refresh(job)

    logger.info("job_opening_created", job_id=str(job.id), title=job.title, by=str(_admin.id))
    return JobOpeningResponse.model_validate(job)


@router.put("/{job_id}", response_model=JobOpeningResponse)
async def update_job(
    job_id: UUID,
    payload: JobOpeningUpdate,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    """
    Admin-only endpoint to update an existing job opening.
    """
    result = await db.execute(select(JobOpening).where(JobOpening.id == job_id))
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job opening not found",
        )

    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(job, field, value)

    await db.flush()
    await db.refresh(job)

    logger.info("job_opening_updated", job_id=str(job.id), title=job.title, by=str(_admin.id))
    return JobOpeningResponse.model_validate(job)


@router.patch("/{job_id}/toggle-status", response_model=JobOpeningResponse)
async def toggle_job_status(
    job_id: UUID,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    """
    Admin-only endpoint to toggle active status of a job opening.
    """
    result = await db.execute(select(JobOpening).where(JobOpening.id == job_id))
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job opening not found",
        )

    job.is_active = not job.is_active
    await db.flush()
    await db.refresh(job)

    logger.info("job_opening_status_toggled", job_id=str(job.id), is_active=job.is_active, by=str(_admin.id))
    return JobOpeningResponse.model_validate(job)


@router.delete("/{job_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_job(
    job_id: UUID,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    """
    Admin-only endpoint to permanently delete a job opening.
    """
    result = await db.execute(select(JobOpening).where(JobOpening.id == job_id))
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job opening not found",
        )

    await db.delete(job)
    await db.flush()

    logger.info("job_opening_deleted", job_id=str(job_id), by=str(_admin.id))

