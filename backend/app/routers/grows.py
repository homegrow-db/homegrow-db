import os
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.crud import (
    count_grows,
    create_grow,
    create_grow_event,
    create_grow_harvest,
    create_grow_image,
    create_grow_week,
    delete_grow,
    delete_grow_event,
    delete_grow_harvest,
    delete_grow_week,
    get_grow,
    get_grow_event,
    get_grow_events,
    get_grow_harvest,
    get_grow_images,
    get_grow_week,
    get_grow_weeks,
    get_grows,
    get_strain,
    update_grow,
    update_grow_event,
    update_grow_harvest,
    update_grow_week,
)
from app.database import get_db
from app.dependencies import get_current_user
from app.models import User
from app.schemas import (
    GrowCreate,
    GrowEventCreate,
    GrowEventResponse,
    GrowEventUpdate,
    GrowHarvestCreate,
    GrowHarvestResponse,
    GrowHarvestUpdate,
    GrowImageResponse,
    GrowResponse,
    GrowUpdate,
    GrowWeekCreate,
    GrowWeekResponse,
    GrowWeekUpdate,
    PaginatedResponse,
)

router = APIRouter(prefix="/grows", tags=["Grows"])

ALLOWED_MIME_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif", "image/heic", "image/heif"}
MAX_IMAGE_SIZE = 20 * 1024 * 1024


@router.get("", response_model=PaginatedResponse[GrowResponse])
async def list_grows(
    status_filter: str | None = Query(None, alias="status"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    items = await get_grows(
        db, user_id=current_user.id, status=status_filter, skip=skip, limit=limit
    )
    total = await count_grows(db, user_id=current_user.id, status=status_filter)
    return PaginatedResponse(items=items, total=total, skip=skip, limit=limit)


@router.post("", response_model=GrowResponse, status_code=status.HTTP_201_CREATED)
async def create_new_grow(
    payload: GrowCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    strain = await get_strain(db, strain_id=payload.strain_id, user_id=current_user.id)
    if not strain:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Strain not found")
    return await create_grow(db, user_id=current_user.id, **payload.model_dump())


@router.get("/{grow_id}", response_model=GrowResponse)
async def get_grow_by_id(
    grow_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    grow = await get_grow(db, grow_id=grow_id, user_id=current_user.id)
    if not grow:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Grow not found")
    return grow


@router.patch("/{grow_id}", response_model=GrowResponse)
async def update_grow_by_id(
    grow_id: uuid.UUID,
    payload: GrowUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    grow = await get_grow(db, grow_id=grow_id, user_id=current_user.id)
    if not grow:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Grow not found")
    return await update_grow(db, grow, **payload.model_dump())


@router.delete("/{grow_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_grow_by_id(
    grow_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    grow = await get_grow(db, grow_id=grow_id, user_id=current_user.id)
    if not grow:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Grow not found")
    await delete_grow(db, grow)


@router.get("/{grow_id}/events", response_model=list[GrowEventResponse])
async def list_grow_events(
    grow_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    grow = await get_grow(db, grow_id=grow_id, user_id=current_user.id)
    if not grow:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Grow not found")
    return await get_grow_events(db, grow_id=grow_id, user_id=current_user.id)


@router.post(
    "/{grow_id}/events",
    response_model=GrowEventResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_new_grow_event(
    grow_id: uuid.UUID,
    payload: GrowEventCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    grow = await get_grow(db, grow_id=grow_id, user_id=current_user.id)
    if not grow:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Grow not found")
    return await create_grow_event(
        db, user_id=current_user.id, grow_id=grow_id, **payload.model_dump()
    )


@router.patch(
    "/{grow_id}/events/{event_id}",
    response_model=GrowEventResponse,
)
async def update_grow_event_by_id(
    grow_id: uuid.UUID,
    event_id: uuid.UUID,
    payload: GrowEventUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    event = await get_grow_event(db, event_id=event_id, user_id=current_user.id)
    if not event or event.grow_id != grow_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")
    return await update_grow_event(db, event, **payload.model_dump())


@router.delete(
    "/{grow_id}/events/{event_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_grow_event_by_id(
    grow_id: uuid.UUID,
    event_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    event = await get_grow_event(db, event_id=event_id, user_id=current_user.id)
    if not event or event.grow_id != grow_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")
    await delete_grow_event(db, event)


@router.get("/{grow_id}/weeks", response_model=list[GrowWeekResponse])
async def list_grow_weeks(
    grow_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    grow = await get_grow(db, grow_id=grow_id, user_id=current_user.id)
    if not grow:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Grow not found")
    return await get_grow_weeks(db, grow_id=grow_id, user_id=current_user.id)


@router.post("/{grow_id}/weeks", response_model=GrowWeekResponse, status_code=status.HTTP_201_CREATED)
async def create_new_grow_week(
    grow_id: uuid.UUID,
    payload: GrowWeekCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    grow = await get_grow(db, grow_id=grow_id, user_id=current_user.id)
    if not grow:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Grow not found")
    return await create_grow_week(db, user_id=current_user.id, grow_id=grow_id, **payload.model_dump())


@router.patch("/{grow_id}/weeks/{week_id}", response_model=GrowWeekResponse)
async def update_grow_week_by_id(
    grow_id: uuid.UUID,
    week_id: uuid.UUID,
    payload: GrowWeekUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    week = await get_grow_week(db, week_id=week_id, user_id=current_user.id)
    if not week or week.grow_id != grow_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Week not found")
    return await update_grow_week(db, week, **payload.model_dump())


@router.delete("/{grow_id}/weeks/{week_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_grow_week_by_id(
    grow_id: uuid.UUID,
    week_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    week = await get_grow_week(db, week_id=week_id, user_id=current_user.id)
    if not week or week.grow_id != grow_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Week not found")
    await delete_grow_week(db, week)


@router.get("/{grow_id}/harvest", response_model=GrowHarvestResponse)
async def get_grow_harvest_by_id(
    grow_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    grow = await get_grow(db, grow_id=grow_id, user_id=current_user.id)
    if not grow:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Grow not found")
    harvest = await get_grow_harvest(db, grow_id=grow_id, user_id=current_user.id)
    if not harvest:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No harvest yet")
    return harvest


@router.post("/{grow_id}/harvest", response_model=GrowHarvestResponse, status_code=status.HTTP_201_CREATED)
async def create_grow_harvest_by_id(
    grow_id: uuid.UUID,
    payload: GrowHarvestCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    grow = await get_grow(db, grow_id=grow_id, user_id=current_user.id)
    if not grow:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Grow not found")
    existing = await get_grow_harvest(db, grow_id=grow_id, user_id=current_user.id)
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Harvest already exists for this grow")
    return await create_grow_harvest(db, user_id=current_user.id, grow_id=grow_id, **payload.model_dump())


@router.patch("/{grow_id}/harvest", response_model=GrowHarvestResponse)
async def update_grow_harvest_by_id(
    grow_id: uuid.UUID,
    payload: GrowHarvestUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    grow = await get_grow(db, grow_id=grow_id, user_id=current_user.id)
    if not grow:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Grow not found")
    harvest = await get_grow_harvest(db, grow_id=grow_id, user_id=current_user.id)
    if not harvest:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No harvest yet")
    return await update_grow_harvest(db, harvest, **payload.model_dump())


@router.delete("/{grow_id}/harvest", status_code=status.HTTP_204_NO_CONTENT)
async def delete_grow_harvest_by_id(
    grow_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    grow = await get_grow(db, grow_id=grow_id, user_id=current_user.id)
    if not grow:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Grow not found")
    harvest = await get_grow_harvest(db, grow_id=grow_id, user_id=current_user.id)
    if not harvest:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No harvest yet")
    await delete_grow_harvest(db, harvest)


@router.post("/{grow_id}/weeks/{week_id}/images", response_model=GrowImageResponse)
async def upload_grow_week_image(
    grow_id: uuid.UUID,
    week_id: uuid.UUID,
    file: UploadFile,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    grow = await get_grow(db, grow_id=grow_id, user_id=current_user.id)
    if not grow:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Grow not found")
    week = await get_grow_week(db, week_id=week_id, user_id=current_user.id)
    if not week or week.grow_id != grow_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Week not found")
    return await _save_image(db, file, current_user, grow_id=grow_id, grow_week_id=week_id)


@router.post("/{grow_id}/harvest/images", response_model=GrowImageResponse)
async def upload_grow_harvest_image(
    grow_id: uuid.UUID,
    file: UploadFile,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    grow = await get_grow(db, grow_id=grow_id, user_id=current_user.id)
    if not grow:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Grow not found")
    harvest = await get_grow_harvest(db, grow_id=grow_id, user_id=current_user.id)
    if not harvest:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No harvest yet")
    return await _save_image(db, file, current_user, grow_id=grow_id, grow_harvest_id=harvest.id)


@router.post("/{grow_id}/images", response_model=GrowImageResponse)
async def upload_grow_image(
    grow_id: uuid.UUID,
    file: UploadFile,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    grow = await get_grow(db, grow_id=grow_id, user_id=current_user.id)
    if not grow:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Grow not found")
    return await _save_image(db, file, current_user, grow_id=grow_id)


@router.post("/{grow_id}/events/{event_id}/images", response_model=GrowImageResponse)
async def upload_grow_event_image(
    grow_id: uuid.UUID,
    event_id: uuid.UUID,
    file: UploadFile,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    grow = await get_grow(db, grow_id=grow_id, user_id=current_user.id)
    if not grow:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Grow not found")
    event = await get_grow_event(db, event_id=event_id, user_id=current_user.id)
    if not event or event.grow_id != grow_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")
    return await _save_image(db, file, current_user, grow_id=grow_id, grow_event_id=event_id)


@router.post("/strains/{strain_id}/images", response_model=GrowImageResponse)
async def upload_strain_image(
    strain_id: uuid.UUID,
    file: UploadFile,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from app.crud import get_strain as _get_strain

    strain = await _get_strain(db, strain_id=strain_id, user_id=current_user.id)
    if not strain:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Strain not found")
    return await _save_image(db, file, current_user, strain_id=strain_id)


@router.get("/{grow_id}/images", response_model=list[GrowImageResponse])
async def list_grow_images(
    grow_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await get_grow_images(db, user_id=current_user.id, grow_id=grow_id)


@router.get("/{grow_id}/cover")
async def get_grow_cover(
    grow_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from app.crud import get_grow_cover_image as _get_cover

    grow = await get_grow(db, grow_id=grow_id, user_id=current_user.id)
    if not grow:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Grow not found")
    image = await _get_cover(db, grow_id=grow_id, user_id=current_user.id)
    if not image:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No images")
    file_path = Path(image.file_path)
    if not file_path.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")
    return FileResponse(path=str(file_path), media_type=image.mime_type, filename=image.file_name)


@router.get("/images/{image_id}", include_in_schema=False)
async def get_grow_image_by_id(
    image_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from app.crud import get_grow_image_by_id as _get_image

    image = await _get_image(db, image_id=image_id, user_id=current_user.id)
    if not image:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Image not found")
    file_path = Path(image.file_path)
    if not file_path.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")
    return FileResponse(path=str(file_path), media_type=image.mime_type, filename=image.file_name)


async def _save_image(
    db: AsyncSession,
    file: UploadFile,
    user: User,
    grow_id: uuid.UUID | None = None,
    grow_event_id: uuid.UUID | None = None,
    grow_week_id: uuid.UUID | None = None,
    grow_harvest_id: uuid.UUID | None = None,
    strain_id: uuid.UUID | None = None,
    seed_id: uuid.UUID | None = None,
) -> GrowImageResponse:
    if file.content_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file type: {file.content_type}. Allowed: {ALLOWED_MIME_TYPES}",
        )
    contents = await file.read()
    if len(contents) > MAX_IMAGE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File too large. Max {MAX_IMAGE_SIZE // (1024*1024)}MB",
        )

    upload_dir = Path(settings.IMAGE_STORAGE_PATH) / str(user.id)
    upload_dir.mkdir(parents=True, exist_ok=True)

    file_id = uuid.uuid4()
    ext = os.path.splitext(file.filename or "image.jpg")[1] or ".jpg"
    stored_name = f"{file_id}{ext}"
    file_path = upload_dir / stored_name

    file_path.write_bytes(contents)

    image = await create_grow_image(
        db,
        user_id=user.id,
        file_path=str(file_path),
        file_name=file.filename or stored_name,
        file_size=len(contents),
        mime_type=file.content_type,
        grow_id=grow_id,
        grow_event_id=grow_event_id,
        grow_week_id=grow_week_id,
        grow_harvest_id=grow_harvest_id,
        strain_id=strain_id,
        seed_id=seed_id,
    )
    return GrowImageResponse(
        id=image.id,
        user_id=image.user_id,
        grow_id=image.grow_id,
        grow_event_id=image.grow_event_id,
        grow_week_id=image.grow_week_id,
        grow_harvest_id=image.grow_harvest_id,
        strain_id=image.strain_id,
        seed_id=image.seed_id,
        file_path=image.file_path,
        file_name=image.file_name,
        file_size=image.file_size,
        mime_type=image.mime_type,
        is_primary=image.is_primary,
        created_at=image.created_at,
    )
