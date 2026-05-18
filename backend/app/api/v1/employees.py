from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.models.user import User
from app.models.attendance import Attendance
from app.models.device import DeviceBinding
from app.schemas.user import UserResponse, UserCreate, UserUpdate
from app.api.deps import require_admin
from app.core.security import hash_password
from app.core.logging import logger

router = APIRouter(prefix="/employees", tags=["Employees"])


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
    return [UserResponse.from_orm_with_dept(u) for u in result.scalars().all()]


@router.post("/", response_model=UserResponse, status_code=201)
async def create_employee(
    payload: UserCreate,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    # Check if user exists (even if inactive)
    existing_query = select(User).where(
        (User.email == payload.email) | (User.employee_id == payload.employee_id)
    )
    result = await db.execute(existing_query)
    existing_user = result.scalar_one_or_none()

    if existing_user:
        if not existing_user.is_active:
            # Re-activate and update existing user instead of failing
            existing_user.is_active = True
            existing_user.full_name = payload.full_name
            if payload.password:
                existing_user.hashed_password = hash_password(payload.password)
            existing_user.department_id = payload.department_id
            existing_user.location_id = payload.location_id
            existing_user.role = payload.role
            
            await db.flush()
            await db.refresh(existing_user)
            logger.info("employee_reactivated", employee_id=existing_user.employee_id, by=str(_admin.id))
            return UserResponse.from_orm_with_dept(existing_user)
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
    )
    db.add(user)
    await db.flush()
    await db.refresh(user)

    logger.info("employee_created", employee_id=user.employee_id, by=str(_admin.id))
    return UserResponse.from_orm_with_dept(user)


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

    logger.info("employee_updated", employee_id=employee_id, by=str(_admin.id))
    return UserResponse.from_orm_with_dept(user)


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

    logger.info("employee_deactivated", employee_id=employee_id, by=str(_admin.id))
    return UserResponse.from_orm_with_dept(user)


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

    logger.info("employee_activated", employee_id=employee_id, by=str(_admin.id))
    return UserResponse.from_orm_with_dept(user)


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
        # Delete related records first
        await db.execute(delete(Attendance).where(Attendance.employee_id == user_uuid))
        await db.execute(delete(DeviceBinding).where(DeviceBinding.employee_id == user_uuid))
        
        # Now delete the user
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