import os
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import (
    create_access_token,
    create_temp_token,
    generate_qr_base64,
    generate_totp_secret,
    get_totp_uri,
    hash_password,
    verify_password,
    verify_totp,
)
from app.config import settings
from app.crud import (
    count_users,
    create_user,
    get_setting,
    get_user_by_email,
    get_user_by_username,
    set_setting,
    update_user,
)
from app.database import get_db
from app.dependencies import get_current_user, get_current_superuser
from app.models import User
from app.schemas import (
    LoginResponse,
    RegistrationStatusResponse,
    Token,
    TotpDisableRequest,
    TotpSetupResponse,
    TotpVerifyRequest,
    UserCreate,
    UserLogin,
    UserResponse,
    UserUpdate,
)

router = APIRouter(prefix="/auth", tags=["Authentication"])

ALLOWED_MIME_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}
MAX_AVATAR_SIZE = 5 * 1024 * 1024


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register(payload: UserCreate, db: AsyncSession = Depends(get_db)) -> User:
    user_count = await count_users(db)
    if user_count > 0:
        reg_open = await get_setting(db, "registration_open")
        if reg_open == "false":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Registration is closed",
            )
    existing = await get_user_by_username(db, payload.username)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Username already taken",
        )
    existing = await get_user_by_email(db, payload.email)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered",
        )
    return await create_user(
        db,
        email=payload.email,
        username=payload.username,
        password=payload.password,
        is_superuser=(user_count == 0),
    )


@router.post("/login", response_model=LoginResponse)
async def login(payload: UserLogin, db: AsyncSession = Depends(get_db)) -> dict:
    user = await get_user_by_username(db, payload.username)
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
        )
    if user.totp_enabled:
        temp_token = create_temp_token(str(user.id))
        return {"requires_2fa": True, "temp_token": temp_token, "access_token": None, "token_type": "bearer"}
    token = create_access_token(subject=str(user.id))
    return {"access_token": token, "token_type": "bearer", "requires_2fa": False, "temp_token": None}


@router.get("/registration-status", response_model=RegistrationStatusResponse)
async def registration_status(db: AsyncSession = Depends(get_db)):
    user_count = await count_users(db)
    if user_count == 0:
        return RegistrationStatusResponse(registration_open=True)
    reg_open = await get_setting(db, "registration_open")
    return RegistrationStatusResponse(registration_open=reg_open != "false")


@router.put("/registration-status", response_model=RegistrationStatusResponse)
async def set_registration_status(
    payload: RegistrationStatusResponse,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_superuser),
):
    await set_setting(db, "registration_open", "true" if payload.registration_open else "false")
    return payload


@router.post("/verify-2fa", response_model=Token)
async def verify_2fa(
    payload: TotpVerifyRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not current_user.totp_secret or not current_user.totp_enabled:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="2FA not enabled")
    if not verify_totp(current_user.totp_secret, payload.code):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid code")
    token = create_access_token(subject=str(current_user.id))
    return {"access_token": token, "token_type": "bearer"}


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)) -> User:
    return current_user


@router.put("/me", response_model=UserResponse)
async def update_profile(
    payload: UserUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    update_data = {}
    if payload.email is not None:
        existing = await get_user_by_email(db, payload.email)
        if existing and existing.id != current_user.id:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")
        update_data["email"] = payload.email
    if payload.username is not None:
        existing = await get_user_by_username(db, payload.username)
        if existing and existing.id != current_user.id:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Username already taken")
        update_data["username"] = payload.username
    if payload.password is not None:
        update_data["password"] = payload.password
    if payload.language is not None:
        update_data["language"] = payload.language
    return await update_user(db, current_user, **update_data)


@router.post("/me/avatar", response_model=UserResponse)
async def upload_avatar(
    file: UploadFile,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if file.content_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file type. Allowed: {ALLOWED_MIME_TYPES}",
        )
    contents = await file.read()
    if len(contents) > MAX_AVATAR_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="File too large. Max 5MB",
        )

    upload_dir = Path(settings.IMAGE_STORAGE_PATH) / str(current_user.id)
    upload_dir.mkdir(parents=True, exist_ok=True)

    if current_user.avatar_path:
        old = Path(current_user.avatar_path)
        if old.exists():
            old.unlink()

    ext = os.path.splitext(file.filename or "avatar.jpg")[1] or ".jpg"
    stored_name = f"avatar{ext}"
    file_path = upload_dir / stored_name
    file_path.write_bytes(contents)

    return await update_user(db, current_user, avatar_path=str(file_path))


@router.get("/me/avatar")
async def get_avatar(current_user: User = Depends(get_current_user)):
    if not current_user.avatar_path:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No avatar")
    file_path = Path(current_user.avatar_path)
    if not file_path.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Avatar file not found")
    return FileResponse(path=str(file_path))


@router.get("/totp/status")
async def totp_status(current_user: User = Depends(get_current_user)):
    return {"totp_enabled": current_user.totp_enabled, "has_secret": current_user.totp_secret is not None}


@router.post("/totp/setup", response_model=TotpSetupResponse)
async def totp_setup(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    secret = generate_totp_secret()
    uri = get_totp_uri(secret, current_user.username)
    qr = generate_qr_base64(uri)
    await update_user(db, current_user, totp_secret=secret)
    return TotpSetupResponse(secret=secret, uri=uri, qr_code=qr)


@router.post("/totp/enable")
async def totp_enable(
    payload: TotpVerifyRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not current_user.totp_secret:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No TOTP secret. Call /totp/setup first.")
    if not verify_totp(current_user.totp_secret, payload.code):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid code")
    await update_user(db, current_user, totp_enabled=True)
    return {"success": True, "message": "2FA aktiviert"}


@router.post("/totp/disable")
async def totp_disable(
    payload: TotpDisableRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not verify_password(payload.password, current_user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Wrong password")
    await update_user(db, current_user, totp_enabled=False, totp_secret=None)
    return {"success": True, "message": "2FA deaktiviert"}
