from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.models.user import User
from app.schemas.user import LoginRequest, TokenResponse, UserCreate, UserResponse
from app.core.security import verify_password, hash_password, create_access_token
from app.api.deps import require_admin
from app.core.logging import logger
from slowapi import Limiter
from slowapi.util import get_remote_address

router = APIRouter(prefix="/auth", tags=["Authentication"])
limiter = Limiter(key_func=get_remote_address)


@router.post("/login", response_model=TokenResponse)
@limiter.limit("20/minute")
async def login(request: Request, payload: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == payload.email))
    user = result.scalar_one_or_none()

    if not user or not verify_password(payload.password, user.hashed_password):
        logger.warning("login_failed", email=payload.email)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is inactive",
        )

    token = create_access_token(
        subject=str(user.id),
        extra={"role": user.role, "location_id": user.location_id},
    )
    logger.info("login_success", user_id=str(user.id), role=user.role)

    return TokenResponse(
        access_token=token,
        user=UserResponse.model_validate(user),
    )


@router.post("/register-employee", response_model=UserResponse, status_code=201)
@limiter.limit("50/minute")
async def register_employee(
    request: Request,
    payload: UserCreate,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    existing = await db.execute(
        select(User).where(
            (User.email == payload.email) | (User.employee_id == payload.employee_id)
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email or employee ID already exists",
        )

    user = User(
        email=payload.email,
        full_name=payload.full_name,
        employee_id=payload.employee_id,
        hashed_password=hash_password(payload.password),
        role=payload.role,
        location_id=payload.location_id,
    )
    db.add(user)
    await db.flush()
    await db.refresh(user)

    logger.info("employee_created", employee_id=user.employee_id, by=str(_admin.id))
    return UserResponse.model_validate(user)