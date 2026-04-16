from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.models.user import User
from app.schemas.user import UserResponse
from app.api.deps import require_admin
from app.core.logging import logger

router = APIRouter(prefix="/employees", tags=["Employees"])


@router.get("/", response_model=list[UserResponse])
async def list_employees(
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    result = await db.execute(select(User))
    users = result.scalars().all()
    return [UserResponse.model_validate(u) for u in users]


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
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employee not found",
        )

    user.is_active = False
    await db.flush()
    await db.refresh(user)

    logger.info("employee_deactivated", employee_id=employee_id, by=str(_admin.id))
    return UserResponse.model_validate(user)