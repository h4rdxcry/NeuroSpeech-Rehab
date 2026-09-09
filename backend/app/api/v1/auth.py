from fastapi import APIRouter, Depends, HTTPException, status, Header
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from datetime import timedelta
from app.core.db import get_db
from app.core.auth import hash_password, verify_password, create_access_token, decode_access_token
from uuid import UUID
from app.core.dependencies import get_current_active_user, require_roles
from app.models import User, Role
from app.schemas.auth import UserCreate, UserUpdate, UserResponse, UserLogin, Token, TokenPayload
from app.core.audit import AuditService
from app.core.config import get_settings

settings = get_settings()
router = APIRouter()

@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register(user_in: UserCreate, db: AsyncSession = Depends(get_db), authorization: str | None = Header(default=None)):
    result = await db.execute(select(User).where(User.email == user_in.email))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")
    role = await db.get(Role, user_in.role_id)
    if not role:
        raise HTTPException(status_code=400, detail="Invalid role assignment")
    if role.name != "PATIENT":
        payload = decode_access_token(authorization.removeprefix("Bearer ")) if authorization else None
        try:
            actor_id = UUID(payload["sub"]) if payload else None
        except (ValueError, KeyError, TypeError):
            actor_id = None
        actor = (await db.execute(select(User).where(User.id == actor_id).options(selectinload(User.role)))).scalar_one_or_none() if actor_id else None
        if not actor or not actor.is_active or actor.role.name != "ADMIN":
            raise HTTPException(403, "Only administrators can provision privileged accounts")
    user = User(
        email=user_in.email,
        password_hash=hash_password(user_in.password),
        role_id=role.id,
    )
    db.add(user)
    await db.flush()
    await db.refresh(user)
    result = await db.execute(select(User).where(User.id == user.id).options(selectinload(User.role)))
    user = result.scalar_one()
    audit = AuditService(db)
    await audit.log(
        action="register",
        resource_type="user",
        result="success",
        user=user,
        ip_address=None,
        user_agent=None,
    )
    await db.commit()
    return user

@router.post("/login", response_model=Token)
async def login(form_data: UserLogin, db: AsyncSession = Depends(get_db), request: str = ""):
    result = await db.execute(select(User).where(User.email == form_data.email).options(selectinload(User.role)))
    user = result.scalar_one_or_none()
    if not user or not verify_password(form_data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if not user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
    access_token = create_access_token(
        data={"sub": str(user.id), "email": user.email, "role": user.role.name},
        expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
    )
    refresh_token = create_access_token(
        data={"sub": str(user.id), "type": "refresh"},
        expires_delta=timedelta(days=7),
    )
    audit = AuditService(db)
    await audit.log(
        action="login",
        resource_type="user",
        result="success",
        user=user,
        ip_address=None,
        user_agent=None,
    )
    await db.commit()
    return Token(access_token=access_token, refresh_token=refresh_token)

@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_active_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.id == current_user.id).options(selectinload(User.role)))
    user = result.scalar_one()
    return user

@router.patch("/me", response_model=UserResponse)
async def update_me(user_update: UserUpdate, current_user: User = Depends(get_current_active_user), db: AsyncSession = Depends(get_db)):
    if user_update.password:
        current_user.password_hash = hash_password(user_update.password)
    if user_update.email:
        current_user.email = user_update.email
    await db.flush()
    await db.refresh(current_user)
    result = await db.execute(select(User).where(User.id == current_user.id).options(selectinload(User.role)))
    user = result.scalar_one()
    await db.commit()
    return user

@router.post("/logout")
async def logout(current_user: User = Depends(get_current_active_user), db: AsyncSession = Depends(get_db)):
    audit = AuditService(db)
    await audit.log(
        action="logout",
        resource_type="user",
        result="success",
        user=current_user,
    )
    await db.commit()
    return {"detail": "Logged out"}
