import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.crud import (
    count_seeds,
    create_seed,
    delete_seed,
    get_seed,
    get_seeds,
    get_strain,
    update_seed,
)
from app.database import get_db
from app.dependencies import get_current_user
from app.models import User
from app.schemas import PaginatedResponse, SeedCreate, SeedResponse, SeedUpdate

router = APIRouter(prefix="/seeds", tags=["Seeds"])


@router.get("", response_model=PaginatedResponse[SeedResponse])
async def list_seeds(
    strain_id: uuid.UUID | None = Query(None),
    search: str | None = Query(None),
    sort_by: str | None = Query(None),
    sort_order: str = Query("desc"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    items = await get_seeds(
        db, user_id=current_user.id, strain_id=strain_id, search=search,
        sort_by=sort_by, sort_order=sort_order, skip=skip, limit=limit,
    )
    total = await count_seeds(db, user_id=current_user.id, strain_id=strain_id, search=search)
    return PaginatedResponse(items=items, total=total, skip=skip, limit=limit)


@router.post("", response_model=SeedResponse, status_code=status.HTTP_201_CREATED)
async def create_new_seed(
    payload: SeedCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    strain = await get_strain(db, strain_id=payload.strain_id, user_id=current_user.id)
    if not strain:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Strain not found")
    return await create_seed(db, user_id=current_user.id, **payload.model_dump())


@router.get("/{seed_id}", response_model=SeedResponse)
async def get_seed_by_id(
    seed_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    seed = await get_seed(db, seed_id=seed_id, user_id=current_user.id)
    if not seed:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Seed not found")
    return seed


@router.patch("/{seed_id}", response_model=SeedResponse)
async def update_seed_by_id(
    seed_id: uuid.UUID,
    payload: SeedUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    seed = await get_seed(db, seed_id=seed_id, user_id=current_user.id)
    if not seed:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Seed not found")
    return await update_seed(db, seed, **payload.model_dump())


@router.delete("/{seed_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_seed_by_id(
    seed_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    seed = await get_seed(db, seed_id=seed_id, user_id=current_user.id)
    if not seed:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Seed not found")
    await delete_seed(db, seed)
