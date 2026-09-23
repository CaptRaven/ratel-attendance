from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from app.database import get_db
from app.models.user import User
from app.schemas.user import (
    LoginRequest,
    TokenResponse,
    UserCreate,
    UserResponse,
    ChangePasswordRequest,
    ForgotPasswordRequest,
    ResetPasswordRequest,
    ProfileUpdateRequest,
)
from app.core.security import (
    verify_password,
    hash_password,
    create_access_token,
    decode_access_token,
)
from app.api.deps import require_admin, get_current_user
from app.core.logging import logger
def get_client_ip(request: Request) -> str:
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    if request.client and request.client.host:
        return request.client.host
    return "127.0.0.1"


router = APIRouter(prefix="/auth", tags=["Authentication"])
limiter = Limiter(key_func=get_client_ip)


@router.post("/login", response_model=TokenResponse)
@limiter.limit("20/minute")
async def login(request: Request, payload: LoginRequest, db: AsyncSession = Depends(get_db)):
    try:
        result = await db.execute(
            select(User)
            .options(selectinload(User.department))
            .where((User.email == payload.email) | (User.employee_id == payload.email))
        )
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
            extra={
                "role": user.role.value if hasattr(user.role, "value") else str(user.role),
                "location_id": getattr(user, "location_id", "ratel-hq") or "ratel-hq",
            },
        )
        logger.info("login_success", user_id=str(user.id), role=str(user.role))

        try:
            user_resp = UserResponse.from_orm_with_dept(user)
        except Exception as e:
            logger.error("login_user_response_serialization_failed", error=str(e))
            dept_name = None
            try:
                if user.department:
                    dept_name = user.department.name
            except Exception:
                pass

            user_resp = UserResponse(
                id=user.id,
                email=user.email,
                full_name=user.full_name,
                employee_id=user.employee_id,
                role=user.role,
                is_active=user.is_active,
                is_face_enrolled=bool(getattr(user, "is_face_enrolled", False)),
                location_id=getattr(user, "location_id", "ratel-hq") or "ratel-hq",
                department_id=getattr(user, "department_id", None),
                department_name=dept_name,
                phone_number=getattr(user, "phone_number", None),
                address=getattr(user, "address", None),
                designation=getattr(user, "designation", None),
                expected_days_per_week=getattr(user, "expected_days_per_week", 5) or 5,
                referee_name=getattr(user, "referee_name", None),
                referee_phone=getattr(user, "referee_phone", None),
                referee_email=getattr(user, "referee_email", None),
                referee_relationship=getattr(user, "referee_relationship", None),
                referee_notes=getattr(user, "referee_notes", None),
                referee_pdf_filename=getattr(user, "referee_pdf_filename", None),
                days_present=0,
                created_at=getattr(user, "created_at", None),
            )

        return TokenResponse(
            access_token=token,
            user=user_resp,
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error("login_unexpected_error", error=str(e), exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Login failed: {str(e)}",
        )


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    return UserResponse.from_orm_with_dept(current_user)


@router.patch("/me", response_model=UserResponse)
async def update_me(
    payload: ProfileUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if payload.full_name is not None:
        current_user.full_name = payload.full_name
    if payload.email is not None and payload.email != current_user.email:
        # Check email availability
        existing = await db.execute(select(User).where(User.email == payload.email))
        if existing.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Email is already in use",
            )
        current_user.email = payload.email

    await db.flush()
    await db.refresh(current_user)
    logger.info("user_profile_updated", user_id=str(current_user.id))
    return UserResponse.from_orm_with_dept(current_user)


@router.post("/change-password")
async def change_password(
    payload: ChangePasswordRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not verify_password(payload.current_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect",
        )

    current_user.hashed_password = hash_password(payload.new_password)
    await db.flush()
    logger.info("password_changed", user_id=str(current_user.id))
    return {"message": "Password changed successfully"}


@router.post("/forgot-password")
@limiter.limit("10/minute")
async def forgot_password(
    request: Request,
    payload: ForgotPasswordRequest,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(User.email == payload.email))
    user = result.scalar_one_or_none()

    if not user:
        # Avoid user enumeration in public API
        return {
            "message": "If an account with that email exists, a password reset token has been generated.",
            "reset_token": None,
        }

    reset_token = create_access_token(
        subject=str(user.id),
        extra={"type": "password_reset"},
    )
    logger.info("password_reset_token_created", user_id=str(user.id))

    return {
        "message": "Password reset token generated successfully",
        "reset_token": reset_token,
    }


@router.post("/reset-password")
@limiter.limit("10/minute")
async def reset_password(
    request: Request,
    payload: ResetPasswordRequest,
    db: AsyncSession = Depends(get_db),
):
    token_data = decode_access_token(payload.token)
    if not token_data or token_data.get("type") != "password_reset":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset token",
        )

    user_id = token_data.get("sub")
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    user.hashed_password = hash_password(payload.new_password)
    await db.flush()
    logger.info("password_reset_completed", user_id=str(user.id))

    return {"message": "Password has been reset successfully"}


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
        hashed_password=hash_password(payload.password) if payload.password else hash_password("12345678"),
        role=payload.role,
        location_id=payload.location_id,
    )
    db.add(user)
    await db.flush()
    await db.refresh(user)

    logger.info("employee_created", employee_id=user.employee_id, by=str(_admin.id))
    return UserResponse.from_orm_with_dept(user)