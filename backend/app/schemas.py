import uuid
from datetime import date, datetime
from typing import Generic, TypeVar

from pydantic import BaseModel, EmailStr, Field

from app.models import GrowEventType, GrowStatus, SeedStatus

T = TypeVar("T")


class PaginatedResponse(BaseModel, Generic[T]):
    items: list[T]
    total: int
    skip: int = 0
    limit: int = 100


class UserCreate(BaseModel):
    email: EmailStr = Field(max_length=128)
    username: str = Field(min_length=3, max_length=32)
    password: str = Field(min_length=8, max_length=72)


class UserLogin(BaseModel):
    username: str
    password: str


class UserUpdate(BaseModel):
    email: EmailStr | None = Field(default=None, max_length=128)
    username: str | None = Field(default=None, min_length=3, max_length=32)
    password: str | None = Field(default=None, min_length=8, max_length=72)
    language: str | None = Field(default=None, pattern=r"^(en|de)$")


class UserResponse(BaseModel):
    id: uuid.UUID
    email: str
    username: str
    is_active: bool
    is_superuser: bool = False
    language: str = "en"
    avatar_path: str | None = None
    totp_enabled: bool = False
    created_at: datetime

    model_config = {"from_attributes": True}


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class TokenPayload(BaseModel):
    sub: str
    exp: int
    purpose: str = "access"


class LoginResponse(BaseModel):
    access_token: str | None = None
    temp_token: str | None = None
    requires_2fa: bool = False
    token_type: str = "bearer"


class TotpSetupResponse(BaseModel):
    secret: str
    uri: str
    qr_code: str  # base64 PNG


class TotpVerifyRequest(BaseModel):
    code: str = Field(min_length=6, max_length=6)


class RegistrationStatusResponse(BaseModel):
    registration_open: bool = True


class TotpDisableRequest(BaseModel):
    password: str


class StrainCreate(BaseModel):
    name: str = Field(max_length=128)
    breeder: str | None = Field(default=None, max_length=128)
    genetics: str | None = Field(default=None, max_length=64)
    genetic_origin: str | None = None
    effects: str | None = None
    aroma: str | None = None
    thc_content: float | None = Field(default=None, ge=0, le=100)
    cbd_content: float | None = Field(default=None, ge=0, le=100)
    flowering_weeks: int | None = Field(default=None, ge=1)
    description: str | None = None


class StrainUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=128)
    breeder: str | None = Field(default=None, max_length=128)
    genetics: str | None = Field(default=None, max_length=64)
    genetic_origin: str | None = None
    effects: str | None = None
    aroma: str | None = None
    thc_content: float | None = Field(default=None, ge=0, le=100)
    cbd_content: float | None = Field(default=None, ge=0, le=100)
    flowering_weeks: int | None = Field(default=None, ge=1)
    description: str | None = None


class StrainResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    name: str
    breeder: str | None
    genetics: str | None
    genetic_origin: str | None
    effects: str | None
    aroma: str | None
    thc_content: float | None
    cbd_content: float | None
    flowering_weeks: int | None
    description: str | None
    seed_count: int = 0
    grow_count: int = 0
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class SeedCreate(BaseModel):
    strain_id: uuid.UUID
    quantity: int = Field(default=1, ge=1)
    purchase_date: date | None = None
    source: str | None = Field(default=None, max_length=128)
    notes: str | None = None


class SeedUpdate(BaseModel):
    quantity: int | None = Field(default=None, ge=1)
    purchase_date: date | None = None
    source: str | None = Field(default=None, max_length=128)
    notes: str | None = None


class SeedResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    strain_id: uuid.UUID
    quantity: int
    purchase_date: date | None
    source: str | None
    notes: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class GrowCreate(BaseModel):
    strain_id: uuid.UUID
    seed_id: uuid.UUID | None = None
    name: str = Field(max_length=128)
    start_date: date
    end_date: date | None = None
    status: GrowStatus = GrowStatus.planned
    medium: str | None = Field(default=None, max_length=64)
    lighting: str | None = Field(default=None, max_length=64)
    nutrients: str | None = None
    notes: str | None = None


class GrowUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=128)
    start_date: date | None = None
    end_date: date | None = None
    status: GrowStatus | None = None
    medium: str | None = Field(default=None, max_length=64)
    lighting: str | None = Field(default=None, max_length=64)
    nutrients: str | None = None
    notes: str | None = None


class GrowResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    strain_id: uuid.UUID
    seed_id: uuid.UUID | None
    name: str
    start_date: date
    end_date: date | None
    status: GrowStatus
    medium: str | None
    lighting: str | None
    nutrients: str | None
    notes: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class GrowEventCreate(BaseModel):
    event_date: date | None = None
    event_type: GrowEventType = GrowEventType.note
    description: str | None = None


class GrowEventUpdate(BaseModel):
    event_date: date | None = None
    event_type: GrowEventType | None = None
    description: str | None = None


class GrowEventResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    grow_id: uuid.UUID
    event_date: date
    event_type: GrowEventType
    description: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class GrowWeekCreate(BaseModel):
    week_number: int = Field(ge=1)
    notes: str | None = None
    fertilizer: str | None = None
    watering: str | None = None
    light_intensity: str | None = None
    light_cycle: str | None = None
    temperature: str | None = None


class GrowWeekUpdate(BaseModel):
    week_number: int | None = Field(default=None, ge=1)
    notes: str | None = None
    fertilizer: str | None = None
    watering: str | None = None
    light_intensity: str | None = None
    light_cycle: str | None = None
    temperature: str | None = None


class GrowWeekResponse(BaseModel):
    id: uuid.UUID
    grow_id: uuid.UUID
    week_number: int
    notes: str | None
    fertilizer: str | None
    watering: str | None
    light_intensity: str | None
    light_cycle: str | None
    temperature: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class GrowHarvestCreate(BaseModel):
    harvest_date: date | None = None
    weight: float | None = Field(default=None, ge=0)
    notes: str | None = None


class GrowHarvestUpdate(BaseModel):
    harvest_date: date | None = None
    weight: float | None = Field(default=None, ge=0)
    notes: str | None = None


class GrowHarvestResponse(BaseModel):
    id: uuid.UUID
    grow_id: uuid.UUID
    harvest_date: date
    weight: float | None
    notes: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class SearchResults(BaseModel):
    strains: list[StrainResponse] = []
    grows: list[GrowResponse] = []
    total_strains: int = 0
    total_grows: int = 0


class GrowImageResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    grow_id: uuid.UUID | None = None
    grow_event_id: uuid.UUID | None = None
    grow_week_id: uuid.UUID | None = None
    grow_harvest_id: uuid.UUID | None = None
    strain_id: uuid.UUID | None = None
    seed_id: uuid.UUID | None = None
    file_path: str
    file_name: str
    file_size: int
    mime_type: str
    is_primary: bool
    created_at: datetime

    model_config = {"from_attributes": True}
