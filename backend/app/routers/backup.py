import datetime

from fastapi import APIRouter, Depends, HTTPException, UploadFile, status
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.backup import BackupValidationError, build_backup, restore_backup
from app.database import get_db
from app.dependencies import get_current_user
from app.models import User

router = APIRouter(prefix="/backup", tags=["Backup"])


@router.get("/export")
async def export_backup(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    content = await build_backup(db, current_user)
    filename = f"homegrow-backup-{datetime.date.today().isoformat()}.zip"
    return Response(
        content=content,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("/import", status_code=status.HTTP_200_OK)
async def import_backup(
    file: UploadFile,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if file.content_type not in ("application/zip", "application/x-zip-compressed", "application/octet-stream"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Die Datei muss ein ZIP-Archiv sein.",
        )
    content = await file.read()
    try:
        summary = await restore_backup(db, current_user, content)
    except BackupValidationError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    return summary