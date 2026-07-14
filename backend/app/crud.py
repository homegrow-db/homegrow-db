import uuid
from datetime import date
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from sqlalchemy import cast, or_, String

from app.auth import hash_password
from app.models import AppSetting, Grow, GrowEvent, GrowHarvest, GrowImage, GrowWeek, Seed, Strain, User


async def create_user(db: AsyncSession, email: str, username: str, password: str, **kwargs) -> User:
    user = User(
        email=email,
        username=username,
        hashed_password=hash_password(password),
        **kwargs,
    )
    db.add(user)
    await db.flush()
    await db.refresh(user)
    return user


async def get_user_by_username(db: AsyncSession, username: str) -> User | None:
    result = await db.execute(select(User).where(User.username == username))
    return result.scalar_one_or_none()


async def get_user_by_email(db: AsyncSession, email: str) -> User | None:
    result = await db.execute(select(User).where(User.email == email))
    return result.scalar_one_or_none()


async def get_user_by_id(db: AsyncSession, user_id: uuid.UUID) -> User | None:
    result = await db.execute(select(User).where(User.id == user_id))
    return result.scalar_one_or_none()


async def update_user(db: AsyncSession, user: User, **kwargs) -> User:
    for key, value in kwargs.items():
        if value is not None:
            if key == "password":
                setattr(user, "hashed_password", hash_password(value))
            else:
                setattr(user, key, value)
    await db.flush()
    await db.refresh(user)
    return user


async def count_users(db: AsyncSession) -> int:
    result = await db.execute(select(func.count()).select_from(User))
    return result.scalar() or 0


async def get_setting(db: AsyncSession, key: str) -> str | None:
    result = await db.execute(select(AppSetting).where(AppSetting.key == key))
    setting = result.scalar_one_or_none()
    return setting.value if setting else None


async def set_setting(db: AsyncSession, key: str, value: str) -> None:
    result = await db.execute(select(AppSetting).where(AppSetting.key == key))
    setting = result.scalar_one_or_none()
    if setting:
        setting.value = value
    else:
        db.add(AppSetting(key=key, value=value))
    await db.flush()


async def create_strain(
    db: AsyncSession, user_id: uuid.UUID, **kwargs
) -> Strain:
    strain = Strain(user_id=user_id, **kwargs)
    db.add(strain)
    await db.flush()
    await db.refresh(strain)
    return strain


ALLOWED_SORT_FIELDS = {
    "name", "breeder", "genetics", "thc_content", "cbd_content",
    "flowering_weeks", "created_at", "updated_at",
}


async def get_strains(
    db: AsyncSession,
    user_id: uuid.UUID,
    skip: int = 0,
    limit: int = 100,
    search: str | None = None,
    sort_by: str | None = None,
    sort_order: str = "asc",
) -> list[Strain]:
    query = select(Strain).where(Strain.user_id == user_id)
    if search:
        query = query.where(Strain.name.ilike(f"%{search}%"))
    if sort_by and sort_by in ALLOWED_SORT_FIELDS:
        col = getattr(Strain, sort_by)
        query = query.order_by(col.asc() if sort_order == "asc" else col.desc())
    else:
        query = query.order_by(Strain.name)
    query = query.offset(skip).limit(limit)
    result = await db.execute(query)
    return list(result.scalars().all())


async def count_strains(
    db: AsyncSession, user_id: uuid.UUID, search: str | None = None
) -> int:
    query = select(func.count()).select_from(Strain).where(Strain.user_id == user_id)
    if search:
        query = query.where(Strain.name.ilike(f"%{search}%"))
    result = await db.execute(query)
    return result.scalar() or 0


async def get_strain(db: AsyncSession, strain_id: uuid.UUID, user_id: uuid.UUID) -> Strain | None:
    result = await db.execute(
        select(Strain).where(Strain.id == strain_id, Strain.user_id == user_id)
    )
    return result.scalar_one_or_none()


async def update_strain(
    db: AsyncSession, strain: Strain, **kwargs
) -> Strain:
    for key, value in kwargs.items():
        if value is not None:
            setattr(strain, key, value)
    await db.flush()
    await db.refresh(strain)
    return strain


async def delete_strain(db: AsyncSession, strain: Strain) -> None:
    await db.delete(strain)
    await db.flush()


async def get_seed_counts_by_strain(
    db: AsyncSession, user_id: uuid.UUID, strain_ids: list[uuid.UUID]
) -> dict[uuid.UUID, int]:
    if not strain_ids:
        return {}
    result = await db.execute(
        select(Seed.strain_id, func.coalesce(func.sum(Seed.quantity), 0))
        .where(Seed.user_id == user_id, Seed.strain_id.in_(strain_ids))
        .group_by(Seed.strain_id)
    )
    return {row[0]: int(row[1]) for row in result.all()}


async def get_grow_counts_by_strain(
    db: AsyncSession, user_id: uuid.UUID, strain_ids: list[uuid.UUID]
) -> dict[uuid.UUID, int]:
    if not strain_ids:
        return {}
    result = await db.execute(
        select(Grow.strain_id, func.count(Grow.id))
        .where(Grow.user_id == user_id, Grow.strain_id.in_(strain_ids))
        .group_by(Grow.strain_id)
    )
    return dict(result.all())


async def create_seed(
    db: AsyncSession, user_id: uuid.UUID, **kwargs
) -> Seed:
    seed = Seed(user_id=user_id, **kwargs)
    db.add(seed)
    await db.flush()
    await db.refresh(seed)
    return seed


SEED_SORT_FIELDS = {"strain_name", "quantity", "source", "created_at", "purchase_date"}


def _apply_seed_sort(query, sort_by: str | None, sort_order: str):
    if sort_by == "strain_name":
        col = Strain.name
        query = query.order_by(col.asc() if sort_order == "asc" else col.desc())
    elif sort_by and sort_by in SEED_SORT_FIELDS:
        col = getattr(Seed, sort_by)
        query = query.order_by(col.asc() if sort_order == "asc" else col.desc())
    else:
        query = query.order_by(Seed.created_at.desc())
    return query


async def get_seeds(
    db: AsyncSession,
    user_id: uuid.UUID,
    strain_id: uuid.UUID | None = None,
    search: str | None = None,
    sort_by: str | None = None,
    sort_order: str = "desc",
    skip: int = 0,
    limit: int = 100,
) -> list[Seed]:
    query = select(Seed).join(Strain, Seed.strain_id == Strain.id).where(Seed.user_id == user_id)
    if strain_id:
        query = query.where(Seed.strain_id == strain_id)
    if search:
        pattern = f"%{search}%"
        query = query.where(or_(Strain.name.ilike(pattern), Seed.source.ilike(pattern)))
    query = _apply_seed_sort(query, sort_by, sort_order)
    query = query.offset(skip).limit(limit)
    result = await db.execute(query)
    return list(result.scalars().all())


async def count_seeds(
    db: AsyncSession, user_id: uuid.UUID, strain_id: uuid.UUID | None = None, search: str | None = None
) -> int:
    query = select(func.count()).select_from(Seed).join(Strain, Seed.strain_id == Strain.id).where(Seed.user_id == user_id)
    if strain_id:
        query = query.where(Seed.strain_id == strain_id)
    if search:
        pattern = f"%{search}%"
        query = query.where(or_(Strain.name.ilike(pattern), Seed.source.ilike(pattern)))
    result = await db.execute(query)
    return result.scalar() or 0


async def get_seed(db: AsyncSession, seed_id: uuid.UUID, user_id: uuid.UUID) -> Seed | None:
    result = await db.execute(
        select(Seed).where(Seed.id == seed_id, Seed.user_id == user_id)
    )
    return result.scalar_one_or_none()


async def update_seed(db: AsyncSession, seed: Seed, **kwargs) -> Seed:
    for key, value in kwargs.items():
        if value is not None:
            setattr(seed, key, value)
    await db.flush()
    await db.refresh(seed)
    return seed


async def delete_seed(db: AsyncSession, seed: Seed) -> None:
    await db.delete(seed)
    await db.flush()


async def create_grow(
    db: AsyncSession, user_id: uuid.UUID, **kwargs
) -> Grow:
    grow = Grow(user_id=user_id, **kwargs)
    db.add(grow)
    await db.flush()
    await db.refresh(grow)
    return grow


async def get_grows(
    db: AsyncSession,
    user_id: uuid.UUID,
    status: str | None = None,
    skip: int = 0,
    limit: int = 100,
) -> list[Grow]:
    query = select(Grow).where(Grow.user_id == user_id)
    if status:
        query = query.where(Grow.status == status)
    query = query.order_by(Grow.start_date.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    return list(result.scalars().all())


async def count_grows(
    db: AsyncSession, user_id: uuid.UUID, status: str | None = None
) -> int:
    query = select(func.count()).select_from(Grow).where(Grow.user_id == user_id)
    if status:
        query = query.where(Grow.status == status)
    result = await db.execute(query)
    return result.scalar() or 0


async def get_grow(db: AsyncSession, grow_id: uuid.UUID, user_id: uuid.UUID) -> Grow | None:
    result = await db.execute(
        select(Grow).where(Grow.id == grow_id, Grow.user_id == user_id)
    )
    return result.scalar_one_or_none()


async def update_grow(db: AsyncSession, grow: Grow, **kwargs) -> Grow:
    for key, value in kwargs.items():
        if value is not None:
            setattr(grow, key, value)
    await db.flush()
    await db.refresh(grow)
    return grow


async def delete_grow(db: AsyncSession, grow: Grow) -> None:
    await db.delete(grow)
    await db.flush()


async def create_grow_event(
    db: AsyncSession, user_id: uuid.UUID, **kwargs
) -> GrowEvent:
    event = GrowEvent(user_id=user_id, **kwargs)
    db.add(event)
    await db.flush()
    await db.refresh(event)
    return event


async def get_grow_events(
    db: AsyncSession, grow_id: uuid.UUID, user_id: uuid.UUID
) -> list[GrowEvent]:
    result = await db.execute(
        select(GrowEvent)
        .where(GrowEvent.grow_id == grow_id, GrowEvent.user_id == user_id)
        .order_by(GrowEvent.event_date.desc())
    )
    return list(result.scalars().all())


async def get_grow_event(
    db: AsyncSession, event_id: uuid.UUID, user_id: uuid.UUID
) -> GrowEvent | None:
    result = await db.execute(
        select(GrowEvent).where(GrowEvent.id == event_id, GrowEvent.user_id == user_id)
    )
    return result.scalar_one_or_none()


async def update_grow_event(
    db: AsyncSession, event: GrowEvent, **kwargs
) -> GrowEvent:
    for key, value in kwargs.items():
        if value is not None:
            setattr(event, key, value)
    await db.flush()
    await db.refresh(event)
    return event


async def delete_grow_event(db: AsyncSession, event: GrowEvent) -> None:
    await db.delete(event)
    await db.flush()


async def create_grow_image(
    db: AsyncSession,
    user_id: uuid.UUID,
    file_path: str,
    file_name: str,
    file_size: int,
    mime_type: str,
    grow_id: uuid.UUID | None = None,
    grow_event_id: uuid.UUID | None = None,
    grow_week_id: uuid.UUID | None = None,
    grow_harvest_id: uuid.UUID | None = None,
    strain_id: uuid.UUID | None = None,
    seed_id: uuid.UUID | None = None,
    is_primary: bool = False,
) -> GrowImage:
    image = GrowImage(
        user_id=user_id,
        file_path=file_path,
        file_name=file_name,
        file_size=file_size,
        mime_type=mime_type,
        grow_id=grow_id,
        grow_event_id=grow_event_id,
        grow_week_id=grow_week_id,
        grow_harvest_id=grow_harvest_id,
        strain_id=strain_id,
        seed_id=seed_id,
        is_primary=is_primary,
    )
    db.add(image)
    await db.flush()
    await db.refresh(image)
    return image


async def get_strain_primary_image(
    db: AsyncSession, strain_id: uuid.UUID, user_id: uuid.UUID
) -> GrowImage | None:
    result = await db.execute(
        select(GrowImage)
        .where(
            GrowImage.strain_id == strain_id,
            GrowImage.user_id == user_id,
            GrowImage.is_primary == True,
        )
        .limit(1)
    )
    return result.scalar_one_or_none()


async def get_grow_image_by_id(
    db: AsyncSession, image_id: uuid.UUID, user_id: uuid.UUID
) -> GrowImage | None:
    result = await db.execute(
        select(GrowImage).where(GrowImage.id == image_id, GrowImage.user_id == user_id)
    )
    return result.scalar_one_or_none()


async def get_grow_images(
    db: AsyncSession,
    user_id: uuid.UUID,
    grow_id: uuid.UUID | None = None,
    grow_event_id: uuid.UUID | None = None,
    grow_week_id: uuid.UUID | None = None,
    grow_harvest_id: uuid.UUID | None = None,
    strain_id: uuid.UUID | None = None,
    seed_id: uuid.UUID | None = None,
) -> list[GrowImage]:
    query = select(GrowImage).where(GrowImage.user_id == user_id)
    if grow_id:
        query = query.where(GrowImage.grow_id == grow_id)
    if grow_event_id:
        query = query.where(GrowImage.grow_event_id == grow_event_id)
    if grow_week_id:
        query = query.where(GrowImage.grow_week_id == grow_week_id)
    if grow_harvest_id:
        query = query.where(GrowImage.grow_harvest_id == grow_harvest_id)
    if strain_id:
        query = query.where(GrowImage.strain_id == strain_id)
    if seed_id:
        query = query.where(GrowImage.seed_id == seed_id)
    query = query.order_by(GrowImage.created_at.desc())
    result = await db.execute(query)
    return list(result.scalars().all())


async def get_grow_cover_image(
    db: AsyncSession, grow_id: uuid.UUID, user_id: uuid.UUID
) -> GrowImage | None:
    result = await db.execute(
        select(GrowImage)
        .where(GrowImage.grow_id == grow_id, GrowImage.user_id == user_id)
        .order_by(GrowImage.created_at.desc())
        .limit(1)
    )
    return result.scalar_one_or_none()


async def create_grow_week(
    db: AsyncSession, user_id: uuid.UUID, grow_id: uuid.UUID, **kwargs
) -> GrowWeek:
    week = GrowWeek(user_id=user_id, grow_id=grow_id, **kwargs)
    db.add(week)
    await db.flush()
    await db.refresh(week)
    return week


async def get_grow_weeks(db: AsyncSession, grow_id: uuid.UUID, user_id: uuid.UUID) -> list[GrowWeek]:
    result = await db.execute(
        select(GrowWeek)
        .where(GrowWeek.grow_id == grow_id, GrowWeek.user_id == user_id)
        .order_by(GrowWeek.week_number)
    )
    return list(result.scalars().all())


async def get_grow_week(db: AsyncSession, week_id: uuid.UUID, user_id: uuid.UUID) -> GrowWeek | None:
    result = await db.execute(
        select(GrowWeek).where(GrowWeek.id == week_id, GrowWeek.user_id == user_id)
    )
    return result.scalar_one_or_none()


async def update_grow_week(db: AsyncSession, week: GrowWeek, **kwargs) -> GrowWeek:
    for key, value in kwargs.items():
        if value is not None:
            setattr(week, key, value)
    await db.flush()
    await db.refresh(week)
    return week


async def delete_grow_week(db: AsyncSession, week: GrowWeek) -> None:
    await db.delete(week)
    await db.flush()


async def create_grow_harvest(
    db: AsyncSession, user_id: uuid.UUID, grow_id: uuid.UUID, **kwargs
) -> GrowHarvest:
    harvest = GrowHarvest(user_id=user_id, grow_id=grow_id, **kwargs)
    db.add(harvest)
    await db.flush()
    await db.refresh(harvest)
    return harvest


async def get_grow_harvest(db: AsyncSession, grow_id: uuid.UUID, user_id: uuid.UUID) -> GrowHarvest | None:
    result = await db.execute(
        select(GrowHarvest).where(GrowHarvest.grow_id == grow_id, GrowHarvest.user_id == user_id)
    )
    return result.scalar_one_or_none()


async def update_grow_harvest(db: AsyncSession, harvest: GrowHarvest, **kwargs) -> GrowHarvest:
    for key, value in kwargs.items():
        if value is not None:
            setattr(harvest, key, value)
    await db.flush()
    await db.refresh(harvest)
    return harvest


async def delete_grow_harvest(db: AsyncSession, harvest: GrowHarvest) -> None:
    await db.delete(harvest)
    await db.flush()


async def search_all(
    db: AsyncSession,
    user_id: uuid.UUID,
    q: str,
    skip: int = 0,
    limit: int = 20,
) -> tuple[list[Strain], list[Grow], int, int]:
    pattern = f"%{q}%"

    strain_query = (
        select(Strain)
        .where(
            Strain.user_id == user_id,
            or_(
                Strain.name.ilike(pattern),
                Strain.breeder.ilike(pattern),
                Strain.genetics.ilike(pattern),
                Strain.genetic_origin.ilike(pattern),
                Strain.effects.ilike(pattern),
                Strain.aroma.ilike(pattern),
                Strain.description.ilike(pattern),
            ),
        )
        .order_by(Strain.name)
        .offset(skip)
        .limit(limit)
    )
    strain_result = await db.execute(strain_query)
    strains = list(strain_result.scalars().all())

    strain_count_query = (
        select(func.count())
        .select_from(Strain)
        .where(
            Strain.user_id == user_id,
            or_(
                Strain.name.ilike(pattern),
                Strain.breeder.ilike(pattern),
                Strain.genetics.ilike(pattern),
                Strain.genetic_origin.ilike(pattern),
                Strain.effects.ilike(pattern),
                Strain.aroma.ilike(pattern),
                Strain.description.ilike(pattern),
            ),
        )
    )
    strain_count_result = await db.execute(strain_count_query)
    total_strains = strain_count_result.scalar() or 0

    grow_query = (
        select(Grow)
        .join(Strain, Grow.strain_id == Strain.id)
        .where(
            Grow.user_id == user_id,
            or_(
                Grow.name.ilike(pattern),
                Grow.notes.ilike(pattern),
                Grow.medium.ilike(pattern),
                Grow.lighting.ilike(pattern),
                Grow.nutrients.ilike(pattern),
                cast(Grow.start_date, String).ilike(pattern),
                Strain.name.ilike(pattern),
            ),
        )
        .order_by(Grow.start_date.desc())
        .offset(skip)
        .limit(limit)
    )
    grow_result = await db.execute(grow_query)
    grows = list(grow_result.scalars().all())

    grow_count_query = (
        select(func.count())
        .select_from(Grow)
        .join(Strain, Grow.strain_id == Strain.id)
        .where(
            Grow.user_id == user_id,
            or_(
                Grow.name.ilike(pattern),
                Grow.notes.ilike(pattern),
                Grow.medium.ilike(pattern),
                Grow.lighting.ilike(pattern),
                Grow.nutrients.ilike(pattern),
                cast(Grow.start_date, String).ilike(pattern),
                Strain.name.ilike(pattern),
            ),
        )
    )
    grow_count_result = await db.execute(grow_count_query)
    total_grows = grow_count_result.scalar() or 0

    return strains, grows, total_strains, total_grows
