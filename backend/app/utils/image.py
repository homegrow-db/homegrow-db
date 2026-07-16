from io import BytesIO

from PIL import Image

HEIC_TYPES = {"image/heic", "image/heif"}


def convert_heic_to_png(contents: bytes, mime_type: str) -> tuple[bytes, str]:
    if mime_type not in HEIC_TYPES:
        return contents, mime_type
    img = Image.open(BytesIO(contents))
    buf = BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue(), "image/png"
