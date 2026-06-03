'''
Purpose : Attachment upload/download routes using MongoDB GridFS.
          Supports: jpg, jpeg, png, webp, pdf, docx.

Inputs  : HTTP requests (multipart for upload, path params for download/delete).

Output  : JSON success/error responses with attachment metadata; binary streams for download.

Dependencies: fastapi, pymongo.gridfs, jwt_middleware, file_utils
'''

import logging
from io import BytesIO

from bson import ObjectId
from fastapi import APIRouter, HTTPException, status, Depends, UploadFile, File
from fastapi.responses import StreamingResponse
from gridfs import GridFS

from config.mongodb_config import get_database
from middleware.jwt_middleware import getCurrentUserDependency, getAdminUserDependency
from utils.file_utils import validateMime, validateFileSize, MAX_FILE_BYTES
from utils.virus_scan import scanFileBytes

objLogger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/attachments", tags=["Attachments"])


# ── helpers ───────────────────────────────────────────────────────────────────

def _getGridFS() -> GridFS:
    """Return a GridFS instance for the current database."""
    return GridFS(get_database())


# ── routes ────────────────────────────────────────────────────────────────────
@router.post("/upload", status_code=status.HTTP_201_CREATED)
async def uploadAttachment(
    objFile: UploadFile = File(...),
    dictCurrentUser: dict = Depends(getCurrentUserDependency),
):
    """
    Purpose : Upload a file to GridFS.
    Access  : Any authenticated user.
    Returns : { attachment_id, file_name, mime, size }
    """
    try:
        strFileName = objFile.filename or "unnamed"
        strContentType = objFile.content_type or ""

        # Validate MIME
        if not validateMime(strFileName, strContentType):
            raise HTTPException(
                status_code=400,
                detail=f"File type not allowed. Supported: jpg, jpeg, png, webp, pdf, docx"
            )

        # Read file content
        objContent = await objFile.read()
        iSize = len(objContent)

        # Validate size
        if not validateFileSize(iSize):
            raise HTTPException(
                status_code=400,
                detail=f"File size exceeds {MAX_FILE_BYTES // (1024 * 1024)} MB limit"
            )

        # Store in GridFS
        objGridFS = _getGridFS()
        objFileId = objGridFS.put(
            objContent,
            filename=strFileName,
            content_type=strContentType,
            uploaded_by=dictCurrentUser["user_id"],
        )

        objLogger.info(f"📎 ATTACHMENT UPLOADED: {objFileId} ({strFileName}) by {dictCurrentUser['user_id']}")

        return {
            "attachment_id": str(objFileId),
            "file_name": strFileName,
            "mime": strContentType,
            "size": iSize,
        }

    except HTTPException:
        raise
    except Exception as objErr:
        objLogger.error(f"❌ UPLOAD ATTACHMENT ERROR: {objErr}")
        raise HTTPException(status_code=500, detail=str(objErr))


@router.get("/{attachment_id}/meta")
async def getAttachmentMeta(
    attachment_id: str,
    dictCurrentUser: dict = Depends(getCurrentUserDependency),
):
    """
    Purpose : Return attachment metadata (filename, mime, size) without
              streaming the binary payload. Used by the viewer to decide
              how to render an item before fetching it.
    Access  : Any authenticated user.
    """
    try:
        objGridFS = _getGridFS()
        if not objGridFS.exists(ObjectId(attachment_id)):
            raise HTTPException(status_code=404, detail="Attachment not found")
        objGridFile = objGridFS.get(ObjectId(attachment_id))
        strFileName = objGridFile.filename or "download"
        strExt = ""
        if "." in strFileName:
            strExt = strFileName.rsplit(".", 1)[-1].lower()
        return {
            "attachment_id": attachment_id,
            "file_name": strFileName,
            "mime": objGridFile.content_type or "application/octet-stream",
            "size": objGridFile.length,
            "ext": strExt,
        }
    except HTTPException:
        raise
    except Exception as objErr:
        objLogger.error(f"\u274c ATTACHMENT META ERROR: {objErr}")
        raise HTTPException(status_code=500, detail=str(objErr))


@router.post("/{attachment_id}/scan")
async def scanAttachment(
    attachment_id: str,
    dictCurrentUser: dict = Depends(getCurrentUserDependency),
):
    """
    Purpose : Run a virus / malware scan on the attachment payload before
              the client opens it. Used primarily for Word documents.
    Access  : Any authenticated user.
    Returns : { status: clean|infected|error|skipped, engine, details }
    """
    try:
        objGridFS = _getGridFS()
        if not objGridFS.exists(ObjectId(attachment_id)):
            raise HTTPException(status_code=404, detail="Attachment not found")
        objGridFile = objGridFS.get(ObjectId(attachment_id))
        bytContent = objGridFile.read()
        strFileName = objGridFile.filename or "download"
        dictResult = scanFileBytes(bytContent, strFileName)
        objLogger.info(
            f"\U0001f9ea ATTACHMENT SCAN: {attachment_id} ({strFileName}) -> "
            f"{dictResult['status']} via {dictResult['engine']}"
        )
        return dictResult
    except HTTPException:
        raise
    except Exception as objErr:
        objLogger.error(f"\u274c ATTACHMENT SCAN ERROR: {objErr}")
        raise HTTPException(status_code=500, detail=str(objErr))


@router.get("/{attachment_id}")
async def downloadAttachment(
    attachment_id: str,
    dictCurrentUser: dict = Depends(getCurrentUserDependency),
):
    """
    Purpose : Download a file from GridFS.
    Access  : Any authenticated user (auth-checked).
    Returns : Binary stream with proper Content-Type.
    """
    try:
        objGridFS = _getGridFS()

        if not objGridFS.exists(ObjectId(attachment_id)):
            raise HTTPException(status_code=404, detail="Attachment not found")

        objGridFile = objGridFS.get(ObjectId(attachment_id))
        strContentType = objGridFile.content_type or "application/octet-stream"
        strFileName = objGridFile.filename or "download"

        objLogger.info(f"📥 ATTACHMENT DOWNLOADED: {attachment_id} ({strFileName}) by {dictCurrentUser['user_id']}")

        return StreamingResponse(
            BytesIO(objGridFile.read()),
            media_type=strContentType,
            headers={"Content-Disposition": f'inline; filename="{strFileName}"'},
        )

    except HTTPException:
        raise
    except Exception as objErr:
        objLogger.error(f"❌ DOWNLOAD ATTACHMENT ERROR: {objErr}")
        raise HTTPException(status_code=500, detail=str(objErr))


@router.delete("/{attachment_id}", status_code=status.HTTP_204_NO_CONTENT)
async def deleteAttachment(
    attachment_id: str,
    dictCurrentUser: dict = Depends(getAdminUserDependency),
):
    """
    Purpose : Delete a file from GridFS.
    Access  : Admin (Owner/CA) only.
    """
    try:
        objGridFS = _getGridFS()

        if not objGridFS.exists(ObjectId(attachment_id)):
            raise HTTPException(status_code=404, detail="Attachment not found")

        objGridFS.delete(ObjectId(attachment_id))
        objLogger.info(f"🗑️  ATTACHMENT DELETED: {attachment_id} by {dictCurrentUser['user_id']}")

        return None

    except HTTPException:
        raise
    except Exception as objErr:
        objLogger.error(f"❌ DELETE ATTACHMENT ERROR: {objErr}")
        raise HTTPException(status_code=500, detail=str(objErr))
