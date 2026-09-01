from io import BytesIO
from pathlib import Path

from PIL import Image

HEIC_TYPES = {"image/heic", "image/heif"}

THUMBNAIL_MAX_SIZE = 512
THUMBNAIL_QUALITY = 82


def convert_heic_to_png(contents: bytes, mime_type: str) -> tuple[bytes, str]:
    if mime_type not in HEIC_TYPES:
        return contents, mime_type
    img = Image.open(BytesIO(contents))
    buf = BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue(), "image/png"


def get_or_create_thumbnail(file_path: Path, max_size: int = THUMBNAIL_MAX_SIZE) -> Path | None:
    thumb_path = file_path.with_name(f"{file_path.stem}_thumb.jpg")
    try:
        if thumb_path.exists() and thumb_path.stat().st_mtime >= file_path.stat().st_mtime:
            return thumb_path
        with Image.open(file_path) as img:
            img.thumbnail((max_size, max_size))
            if img.mode not in ("RGB", "L"):
                img = img.convert("RGB")
            img.save(thumb_path, format="JPEG", quality=THUMBNAIL_QUALITY, optimize=True)
        return thumb_path
    except Exception:
        return None
