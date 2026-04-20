from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.models.department import Department
from app.models.user import User
from app.schemas.department import DepartmentCreate, DepartmentResponse
from app.api.deps import require_admin
from app.core.logging import logger

router = APIRouter(prefix="/departments", tags=["Departments"])


@router.post("/", response_model=DepartmentResponse, status_code=201)
async def create_department(
    payload: DepartmentCreate,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    # Check duplicate
    existing = await db.execute(
        select(Department).where(Department.name == payload.name)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Department already exists",
        )

    dept = Department(name=payload.name, description=payload.description)
    db.add(dept)
    await db.flush()
    await db.refresh(dept)

    logger.info("department_created", name=dept.name, by=str(_admin.id))
    return DepartmentResponse.model_validate(dept)


@router.get("/", response_model=list[DepartmentResponse])
async def list_departments(
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    result = await db.execute(
        select(Department).where(Department.is_active == True)  # noqa: E712
    )
    return [DepartmentResponse.model_validate(d) for d in result.scalars().all()]


@router.delete("/{dept_id}", status_code=204)
async def deactivate_department(
    dept_id: str,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    result = await db.execute(
        select(Department).where(Department.id == dept_id)
    )
    dept = result.scalar_one_or_none()
    if not dept:
        raise HTTPException(status_code=404, detail="Department not found")

    dept.is_active = False
    await db.flush()
    logger.info("department_deactivated", name=dept.name, by=str(_admin.id))