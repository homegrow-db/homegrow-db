import uuid
from datetime import date, datetime
from enum import StrEnum

from sqlalchemy import Boolean, Date, DateTime, Enum, Float, ForeignKey, Integer, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class SeedStatus(StrEnum):
    storage = "storage"
    germinating = "germinating"
    seedling = "seedling"
    vegetative = "vegetative"
    flowering = "flowering"
    harvested = "harvested"
    discarded = "discarded"


class GrowStatus(StrEnum):
    planned = "planned"
    ongoing = "ongoing"
    completed = "completed"
    failed = "failed"


class GrowEventType(StrEnum):
    seed_sowing = "seed_sowing"
    germination = "germination"
    seedling = "seedling"
    vegetative = "vegetative"
    flowering_start = "flowering_start"
    flowering = "flowering"
    harvest = "harvest"
    drying = "drying"
    curing = "curing"
    note = "note"


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(), primary_key=True, default=uuid.uuid4
    )
    email: Mapped[str] = mapped_column(unique=True, index=True)
    username: Mapped[str] = mapped_column(unique=True, index=True)
    hashed_password: Mapped[str]
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_superuser: Mapped[bool] = mapped_column(Boolean, default=False)
    totp_secret: Mapped[str | None] = mapped_column(nullable=True)
    totp_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    language: Mapped[str] = mapped_column(default="en")
    avatar_path: Mapped[str | None] = mapped_column(nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    strains: Mapped[list["Strain"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    seeds: Mapped[list["Seed"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    grows: Mapped[list["Grow"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    grow_events: Mapped[list["GrowEvent"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    grow_weeks: Mapped[list["GrowWeek"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    grow_harvests: Mapped[list["GrowHarvest"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    images: Mapped[list["GrowImage"]] = relationship(back_populates="user", cascade="all, delete-orphan")


class Strain(Base):
    __tablename__ = "strains"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(), ForeignKey("users.id"), nullable=False
    )
    name: Mapped[str] = mapped_column(index=True)
    breeder: Mapped[str | None]
    genetics: Mapped[str | None]
    genetic_origin: Mapped[str | None] = mapped_column(Text)
    effects: Mapped[str | None] = mapped_column(Text)
    aroma: Mapped[str | None] = mapped_column(Text)
    thc_content: Mapped[float | None] = mapped_column(Float)
    cbd_content: Mapped[float | None] = mapped_column(Float)
    flowering_weeks: Mapped[int | None] = mapped_column(Integer)
    description: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    user: Mapped["User"] = relationship(back_populates="strains")
    seeds: Mapped[list["Seed"]] = relationship(back_populates="strain", cascade="all, delete-orphan")
    grows: Mapped[list["Grow"]] = relationship(back_populates="strain", cascade="all, delete-orphan")
    images: Mapped[list["GrowImage"]] = relationship(
        back_populates="strain", cascade="all, delete-orphan"
    )


class Seed(Base):
    __tablename__ = "seeds"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(), ForeignKey("users.id"), nullable=False
    )
    strain_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(), ForeignKey("strains.id"), nullable=False
    )
    quantity: Mapped[int] = mapped_column(Integer, default=1)
    status: Mapped[SeedStatus] = mapped_column(
        Enum(SeedStatus, name="seed_status"), default=SeedStatus.storage
    )
    purchase_date: Mapped[date | None] = mapped_column(Date)
    source: Mapped[str | None]
    notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    user: Mapped["User"] = relationship(back_populates="seeds")
    strain: Mapped["Strain"] = relationship(back_populates="seeds")
    grows: Mapped[list["Grow"]] = relationship(back_populates="seed", cascade="all, delete-orphan")
    images: Mapped[list["GrowImage"]] = relationship(
        back_populates="seed", cascade="all, delete-orphan"
    )


class Grow(Base):
    __tablename__ = "grows"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(), ForeignKey("users.id"), nullable=False
    )
    strain_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(), ForeignKey("strains.id"), nullable=False
    )
    seed_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(), ForeignKey("seeds.id")
    )
    name: Mapped[str]
    start_date: Mapped[date] = mapped_column(Date)
    end_date: Mapped[date | None] = mapped_column(Date)
    status: Mapped[GrowStatus] = mapped_column(
        Enum(GrowStatus, name="grow_status"), default=GrowStatus.planned
    )
    medium: Mapped[str | None]
    lighting: Mapped[str | None]
    nutrients: Mapped[str | None] = mapped_column(Text)
    notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    user: Mapped["User"] = relationship(back_populates="grows")
    strain: Mapped["Strain"] = relationship(back_populates="grows")
    seed: Mapped["Seed | None"] = relationship(back_populates="grows")
    events: Mapped[list["GrowEvent"]] = relationship(
        back_populates="grow", cascade="all, delete-orphan"
    )
    images: Mapped[list["GrowImage"]] = relationship(
        back_populates="grow", cascade="all, delete-orphan"
    )
    weeks: Mapped[list["GrowWeek"]] = relationship(
        back_populates="grow", cascade="all, delete-orphan"
    )
    harvest: Mapped["GrowHarvest | None"] = relationship(
        back_populates="grow", cascade="all, delete-orphan", uselist=False
    )


class GrowWeek(Base):
    __tablename__ = "grow_weeks"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(), primary_key=True, default=uuid.uuid4)
    grow_id: Mapped[uuid.UUID] = mapped_column(Uuid(), ForeignKey("grows.id"), nullable=False)
    user_id: Mapped[uuid.UUID] = mapped_column(Uuid(), ForeignKey("users.id"), nullable=False)
    week_number: Mapped[int] = mapped_column(Integer)
    notes: Mapped[str | None] = mapped_column(Text)
    fertilizer: Mapped[str | None]
    watering: Mapped[str | None]
    light_intensity: Mapped[str | None]
    light_cycle: Mapped[str | None]
    temperature: Mapped[str | None]
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    grow: Mapped["Grow"] = relationship(back_populates="weeks")
    user: Mapped["User"] = relationship()
    images: Mapped[list["GrowImage"]] = relationship(back_populates="grow_week", cascade="all, delete-orphan")


class GrowHarvest(Base):
    __tablename__ = "grow_harvests"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(), primary_key=True, default=uuid.uuid4)
    grow_id: Mapped[uuid.UUID] = mapped_column(Uuid(), ForeignKey("grows.id"), nullable=False, unique=True)
    user_id: Mapped[uuid.UUID] = mapped_column(Uuid(), ForeignKey("users.id"), nullable=False)
    harvest_date: Mapped[date] = mapped_column(Date, default=date.today)
    weight: Mapped[float | None] = mapped_column(Float)
    notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    grow: Mapped["Grow"] = relationship(back_populates="harvest")
    user: Mapped["User"] = relationship()
    images: Mapped[list["GrowImage"]] = relationship(back_populates="grow_harvest", cascade="all, delete-orphan")


class GrowEvent(Base):
    __tablename__ = "grow_events"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(), ForeignKey("users.id"), nullable=False
    )
    grow_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(), ForeignKey("grows.id"), nullable=False
    )
    event_date: Mapped[date] = mapped_column(Date, default=date.today)
    event_type: Mapped[GrowEventType] = mapped_column(
        Enum(GrowEventType, name="grow_event_type"), default=GrowEventType.note
    )
    description: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    user: Mapped["User"] = relationship(back_populates="grow_events")
    grow: Mapped["Grow"] = relationship(back_populates="events")
    images: Mapped[list["GrowImage"]] = relationship(
        back_populates="grow_event", cascade="all, delete-orphan"
    )


class AppSetting(Base):
    __tablename__ = "app_settings"

    key: Mapped[str] = mapped_column(primary_key=True)
    value: Mapped[str]


class GrowImage(Base):
    __tablename__ = "grow_images"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(Uuid(), ForeignKey("users.id"), nullable=False)
    grow_id: Mapped[uuid.UUID | None] = mapped_column(Uuid(), ForeignKey("grows.id"))
    grow_event_id: Mapped[uuid.UUID | None] = mapped_column(Uuid(), ForeignKey("grow_events.id"))
    grow_week_id: Mapped[uuid.UUID | None] = mapped_column(Uuid(), ForeignKey("grow_weeks.id"))
    grow_harvest_id: Mapped[uuid.UUID | None] = mapped_column(Uuid(), ForeignKey("grow_harvests.id"))
    strain_id: Mapped[uuid.UUID | None] = mapped_column(Uuid(), ForeignKey("strains.id"))
    seed_id: Mapped[uuid.UUID | None] = mapped_column(Uuid(), ForeignKey("seeds.id"))
    file_path: Mapped[str]
    file_name: Mapped[str]
    file_size: Mapped[int] = mapped_column(Integer)
    mime_type: Mapped[str]
    is_primary: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    user: Mapped["User"] = relationship(back_populates="images")
    grow: Mapped["Grow | None"] = relationship(back_populates="images")
    grow_event: Mapped["GrowEvent | None"] = relationship(back_populates="images")
    grow_week: Mapped["GrowWeek | None"] = relationship(back_populates="images")
    grow_harvest: Mapped["GrowHarvest | None"] = relationship(back_populates="images")
    strain: Mapped["Strain | None"] = relationship(back_populates="images")
    seed: Mapped["Seed | None"] = relationship(back_populates="images")
