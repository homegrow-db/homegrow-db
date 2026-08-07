import io
import json
import os
import uuid
import zipfile
from datetime import date, datetime
from pathlib import Path

from sqlalchemy import Date, DateTime, Enum as SAEnum, delete, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.types import Uuid as SAUuid

from app.config import settings
from app.models import (
    Grow,
    GrowEvent,
    GrowHarvest,
    GrowImage,
    GrowWeek,
    Seed,
    Strain,
    User,
)

BACKUP_FORMAT = "homegrow-db-backup"
BACKUP_VERSION = 1

_MODELS_BY_KEY = {
    "strains": Strain,
    "seeds": Seed,
    "grows": Grow,
    "grow_weeks": GrowWeek,
    "grow_harvests": GrowHarvest,
    "grow_events": GrowEvent,
    "grow_images": GrowImage,
}

_DELETE_ORDER = [GrowImage, GrowHarvest, GrowEvent, GrowWeek, Grow, Seed, Strain]

_FK_TARGETS = {
    "strain_id": "strains",
    "seed_id": "seeds",
    "grow_id": "grows",
    "grow_week_id": "grow_weeks",
    "grow_harvest_id": "grow_harvests",
    "grow_event_id": "grow_events",
}


class BackupValidationError(Exception):
    pass


def _to_dict(row) -> dict:
    data = {}
    for col in row.__table__.columns:
        value = getattr(row, col.name)
        if isinstance(value, uuid.UUID):
            value = str(value)
        elif isinstance(value, (datetime, date)):
            value = value.isoformat()
        data[col.name] = value
    return data


def _coerce(model, data: dict) -> dict:
    result = {}
    for col in model.__table__.columns:
        if col.name not in data or data[col.name] is None:
            result[col.name] = None
            continue
        value = data[col.name]
        ctype = col.type
        try:
            if isinstance(ctype, DateTime):
                result[col.name] = datetime.fromisoformat(str(value))
            elif isinstance(ctype, Date):
                result[col.name] = date.fromisoformat(str(value))
            elif isinstance(ctype, SAUuid):
                result[col.name] = uuid.UUID(str(value))
            elif isinstance(ctype, SAEnum):
                enum_cls = getattr(ctype, "enum_class", None)
                if enum_cls:
                    result[col.name] = enum_cls(value)
                else:
                    result[col.name] = value
            else:
                pt = getattr(ctype, "python_type", None)
                if pt is bool:
                    result[col.name] = bool(value)
                elif pt is float:
                    result[col.name] = float(value)
                elif pt is int:
                    result[col.name] = int(value)
                else:
                    result[col.name] = value
        except (ValueError, TypeError):
            result[col.name] = value
    return result


async def build_backup(db: AsyncSession, user: User) -> bytes:
    strains = (await db.execute(select(Strain).where(Strain.user_id == user.id))).scalars().all()
    seeds = (await db.execute(select(Seed).where(Seed.user_id == user.id))).scalars().all()
    grows = (await db.execute(select(Grow).where(Grow.user_id == user.id))).scalars().all()
    weeks = (await db.execute(select(GrowWeek).where(GrowWeek.user_id == user.id))).scalars().all()
    harvests = (await db.execute(select(GrowHarvest).where(GrowHarvest.user_id == user.id))).scalars().all()
    events = (await db.execute(select(GrowEvent).where(GrowEvent.user_id == user.id))).scalars().all()
    images = (await db.execute(select(GrowImage).where(GrowImage.user_id == user.id))).scalars().all()

    image_files: dict[str, bytes] = {}
    for image in images:
        path = Path(image.file_path)
        if path.exists():
            image_files[path.name] = path.read_bytes()

    avatar_basename = None
    if user.avatar_path:
        avatar_path = Path(user.avatar_path)
        if avatar_path.exists():
            avatar_basename = avatar_path.name
            image_files[avatar_path.name] = avatar_path.read_bytes()

    payload = {
        "format": BACKUP_FORMAT,
        "version": BACKUP_VERSION,
        "exported_at": datetime.utcnow().isoformat(),
        "user": {
            "username": user.username,
            "email": user.email,
            "language": user.language,
            "avatar": avatar_basename,
        },
        "strains": [_to_dict(s) for s in strains],
        "seeds": [_to_dict(s) for s in seeds],
        "grows": [_to_dict(g) for g in grows],
        "grow_weeks": [_to_dict(w) for w in weeks],
        "grow_harvests": [_to_dict(h) for h in harvests],
        "grow_events": [_to_dict(e) for e in events],
        "grow_images": [_to_dict(i) for i in images],
    }

    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("backup.json", json.dumps(payload, ensure_ascii=False))
        for name, data in image_files.items():
            archive.writestr(f"images/{name}", data)
    return buffer.getvalue()


async def _clear_user_data(db: AsyncSession, user: User) -> None:
    existing_images = (await db.execute(
        select(GrowImage).where(GrowImage.user_id == user.id)
    )).scalars().all()
    for image in existing_images:
        _unlink(image.file_path)
    if user.avatar_path:
        _unlink(user.avatar_path)

    for model in _DELETE_ORDER:
        await db.execute(delete(model).where(model.user_id == user.id))
    user.avatar_path = None
    await db.flush()


def _unlink(path: str) -> None:
    try:
        p = Path(path)
        if p.exists():
            p.unlink()
    except OSError:
        pass


async def restore_backup(db: AsyncSession, user: User, zip_bytes: bytes) -> dict:
    try:
        archive = zipfile.ZipFile(io.BytesIO(zip_bytes))
    except zipfile.BadZipFile:
        raise BackupValidationError("Die Datei ist kein gültiges ZIP-Archiv.")

    contents = {name: archive.read(name) for name in archive.namelist() if not name.endswith("/")}
    if "backup.json" not in contents:
        raise BackupValidationError("Das Archiv enthält keine backup.json.")
    try:
        payload = json.loads(contents["backup.json"])
    except (ValueError, TypeError):
        raise BackupValidationError("backup.json ist kein gültiges JSON.")

    if payload.get("format") != BACKUP_FORMAT:
        raise BackupValidationError("Die Datei ist kein Homegrow-DB-Backup.")
    if payload.get("version") != BACKUP_VERSION:
        raise BackupValidationError(f"Nicht unterstützte Backup-Version: {payload.get('version')}")

    image_data: dict[str, bytes] = {}
    for name, data in contents.items():
        if name.startswith("images/"):
            image_data[os.path.basename(name)] = data

    await _clear_user_data(db, user)

    counts = {}
    created_images: list[GrowImage] = []
    id_maps: dict[str, dict] = {key: {} for key in _MODELS_BY_KEY}

    def _new_id(key: str, old_id) -> uuid.UUID:
        old_id = str(old_id)
        if old_id not in id_maps[key]:
            id_maps[key][old_id] = uuid.uuid4()
        return id_maps[key][old_id]

    def _ref(key: str, old_id):
        if not old_id:
            return None
        return id_maps[key].get(str(old_id))

    ref_map = {
        "strains": [],
        "seeds": ["strain_id"],
        "grows": ["strain_id", "seed_id"],
        "grow_weeks": ["grow_id"],
        "grow_harvests": ["grow_id"],
        "grow_events": ["grow_id"],
        "grow_images": ["grow_id", "grow_event_id", "grow_week_id", "grow_harvest_id", "strain_id", "seed_id"],
    }

    for key, model in _MODELS_BY_KEY.items():
        rows = payload.get(key) or []
        instances = []
        for item in rows:
            new_id = _new_id(key, item.get("id"))
            coerced = _coerce(model, {**item, "user_id": user.id, "id": new_id})
            if model is GrowImage:
                basename = os.path.basename(coerced.get("file_path") or "")
                if basename:
                    coerced["file_path"] = str(
                        Path(settings.IMAGE_STORAGE_PATH) / str(user.id) / basename
                    )
            for fk in ref_map[key]:
                target = _FK_TARGETS[fk]
                if coerced.get(fk):
                    coerced[fk] = _ref(target, coerced[fk])
            instance = model(**coerced)
            instances.append(instance)
            if key == "grow_images":
                created_images.append(instance)
        db.add_all(instances)
        counts[key] = len(instances)

    avatar_restored = False
    user_info = payload.get("user") or {}
    avatar_basename = user_info.get("avatar")
    if avatar_basename and avatar_basename in image_data:
        old_avatar = Path(user.avatar_path) if user.avatar_path else None
        if old_avatar and old_avatar.exists() and old_avatar.is_file():
            _unlink(str(old_avatar))
        upload_dir = Path(settings.IMAGE_STORAGE_PATH) / str(user.id)
        upload_dir.mkdir(parents=True, exist_ok=True)
        target = upload_dir / os.path.basename(avatar_basename)
        target.write_bytes(image_data[avatar_basename])
        user.avatar_path = str(target)
        avatar_restored = True

    language = user_info.get("language")
    if language in ("de", "en"):
        user.language = language

    await db.commit()

    for image in created_images:
        basename = os.path.basename(image.file_path or "")
        if basename and basename in image_data:
            path = Path(image.file_path)
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(image_data[basename])

    return {
        "restored": True,
        "avatar_restored": avatar_restored,
        "counts": counts,
    }