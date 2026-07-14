import os
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.crud import (
    count_strains,
    create_grow_image,
    create_strain,
    delete_strain,
    get_grow_counts_by_strain,
    get_seed_counts_by_strain,
    get_strain,
    get_strain_primary_image,
    get_strains,
    update_strain,
)
from app.database import get_db
from app.dependencies import get_current_user
from app.models import User
from app.schemas import GrowImageResponse, PaginatedResponse, StrainCreate, StrainResponse, StrainUpdate

router = APIRouter(prefix="/strains", tags=["Strains"])

ALLOWED_MIME_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}
MAX_IMAGE_SIZE = 20 * 1024 * 1024


@router.get("", response_model=PaginatedResponse[StrainResponse])
async def list_strains(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    search: str | None = Query(None),
    sort_by: str | None = Query(None),
    sort_order: str = Query("asc"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    items = await get_strains(db, user_id=current_user.id, skip=skip, limit=limit, search=search, sort_by=sort_by, sort_order=sort_order)
    total = await count_strains(db, user_id=current_user.id, search=search)
    seed_counts = await get_seed_counts_by_strain(
        db, user_id=current_user.id, strain_ids=[s.id for s in items]
    )
    grow_counts = await get_grow_counts_by_strain(
        db, user_id=current_user.id, strain_ids=[s.id for s in items]
    )
    result_items = []
    for s in items:
        result_items.append(StrainResponse(
            id=s.id, user_id=s.user_id, name=s.name,
            breeder=s.breeder, genetics=s.genetics,
            genetic_origin=s.genetic_origin, effects=s.effects,
            aroma=s.aroma, thc_content=s.thc_content,
            cbd_content=s.cbd_content, flowering_weeks=s.flowering_weeks,
            description=s.description,
            seed_count=seed_counts.get(s.id, 0),
            grow_count=grow_counts.get(s.id, 0),
            created_at=s.created_at, updated_at=s.updated_at,
        ))
    return PaginatedResponse(items=result_items, total=total, skip=skip, limit=limit)


@router.post("", response_model=StrainResponse, status_code=status.HTTP_201_CREATED)
async def create_new_strain(
    payload: StrainCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await create_strain(db, user_id=current_user.id, **payload.model_dump())


@router.get("/{strain_id}", response_model=StrainResponse)
async def get_strain_by_id(
    strain_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    strain = await get_strain(db, strain_id=strain_id, user_id=current_user.id)
    if not strain:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Strain not found")
    seed_counts = await get_seed_counts_by_strain(db, current_user.id, [strain.id])
    grow_counts = await get_grow_counts_by_strain(db, current_user.id, [strain.id])
    return StrainResponse(
        id=strain.id, user_id=strain.user_id, name=strain.name,
        breeder=strain.breeder, genetics=strain.genetics,
        genetic_origin=strain.genetic_origin, effects=strain.effects,
        aroma=strain.aroma, thc_content=strain.thc_content,
        cbd_content=strain.cbd_content, flowering_weeks=strain.flowering_weeks,
        description=strain.description,
        seed_count=seed_counts.get(strain.id, 0),
        grow_count=grow_counts.get(strain.id, 0),
        created_at=strain.created_at, updated_at=strain.updated_at,
    )


@router.patch("/{strain_id}", response_model=StrainResponse)
async def update_strain_by_id(
    strain_id: uuid.UUID,
    payload: StrainUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    strain = await get_strain(db, strain_id=strain_id, user_id=current_user.id)
    if not strain:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Strain not found")
    return await update_strain(db, strain, **payload.model_dump())


@router.delete("/{strain_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_strain_by_id(
    strain_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    strain = await get_strain(db, strain_id=strain_id, user_id=current_user.id)
    if not strain:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Strain not found")
    await delete_strain(db, strain)


@router.post("/{strain_id}/image", response_model=GrowImageResponse)
async def upload_strain_image(
    strain_id: uuid.UUID,
    file: UploadFile,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    strain = await get_strain(db, strain_id=strain_id, user_id=current_user.id)
    if not strain:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Strain not found")

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

    upload_dir = Path(settings.IMAGE_STORAGE_PATH) / str(current_user.id)
    upload_dir.mkdir(parents=True, exist_ok=True)

    file_id = uuid.uuid4()
    ext = os.path.splitext(file.filename or "image.jpg")[1] or ".jpg"
    stored_name = f"{file_id}{ext}"
    file_path = upload_dir / stored_name
    file_path.write_bytes(contents)

    image = await create_grow_image(
        db,
        user_id=current_user.id,
        file_path=str(file_path),
        file_name=file.filename or stored_name,
        file_size=len(contents),
        mime_type=file.content_type,
        strain_id=strain_id,
        is_primary=True,
    )
    return GrowImageResponse(
        id=image.id,
        user_id=image.user_id,
        grow_id=image.grow_id,
        grow_event_id=image.grow_event_id,
        strain_id=image.strain_id,
        seed_id=image.seed_id,
        file_path=image.file_path,
        file_name=image.file_name,
        file_size=image.file_size,
        mime_type=image.mime_type,
        is_primary=image.is_primary,
        created_at=image.created_at,
    )


@router.get("/{strain_id}/image")
async def get_strain_image(
    strain_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    strain = await get_strain(db, strain_id=strain_id, user_id=current_user.id)
    if not strain:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Strain not found")

    image = await get_strain_primary_image(db, strain_id=strain_id, user_id=current_user.id)
    if not image:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No image for this strain")

    file_path = Path(image.file_path)
    if not file_path.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Image file not found on disk")

    return FileResponse(path=str(file_path), media_type=image.mime_type, filename=image.file_name, headers={"Cache-Control": "no-cache, no-store, must-revalidate"})
