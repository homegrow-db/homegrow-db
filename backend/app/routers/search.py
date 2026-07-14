import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.crud import get_grow_counts_by_strain, get_seed_counts_by_strain, search_all
from app.database import get_db
from app.dependencies import get_current_user
from app.models import User
from app.schemas import GrowResponse, SearchResults, StrainResponse

router = APIRouter(prefix="/search", tags=["Search"])


@router.get("", response_model=SearchResults)
async def global_search(
    q: str = Query(..., min_length=1, max_length=100),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    strains, grows, total_strains, total_grows = await search_all(
        db, user_id=current_user.id, q=q, skip=skip, limit=limit,
    )

    strain_ids = [s.id for s in strains]
    seed_counts = await get_seed_counts_by_strain(db, current_user.id, strain_ids)
    grow_counts = await get_grow_counts_by_strain(db, current_user.id, strain_ids)

    return SearchResults(
        strains=[
            StrainResponse(
                id=s.id, user_id=s.user_id, name=s.name,
                breeder=s.breeder, genetics=s.genetics,
                genetic_origin=s.genetic_origin, effects=s.effects,
                aroma=s.aroma, thc_content=s.thc_content,
                cbd_content=s.cbd_content, flowering_weeks=s.flowering_weeks,
                description=s.description,
                seed_count=seed_counts.get(s.id, 0),
                grow_count=grow_counts.get(s.id, 0),
                created_at=s.created_at, updated_at=s.updated_at,
            )
            for s in strains
        ],
        grows=[GrowResponse.model_validate(g) for g in grows],
        total_strains=total_strains,
        total_grows=total_grows,
    )
