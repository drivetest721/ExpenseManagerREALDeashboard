'''
Purpose : File upload validation utilities for attachment handling.

Inputs  : File objects, MIME types, file sizes.

Output  : Boolean validation results, file metadata.

Dependencies: None (stdlib only)
'''

import mimetypes
from typing import Optional

# Maximum file size: 10 MB
MAX_FILE_BYTES = 10 * 1024 * 1024

# Allowed MIME types
ALLOWED_MIMES = {
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",  # docx
}

# Allowed extensions (fallback if MIME detection fails)
ALLOWED_EXTENSIONS = {
    ".jpg",
    ".jpeg",
    ".png",
    ".webp",
    ".pdf",
    ".docx",
}


def validateMime(strFileName: str, strContentType: Optional[str] = None) -> bool:
    """
    Purpose : Validate if a file's MIME type is allowed.

    Inputs  :   (1) strFileName     : Original filename (str)
                (2) strContentType  : Content-Type header (str, optional)

    Output  : True if valid, False otherwise (bool)

    Example : validateMime("invoice.pdf", "application/pdf") → True
              validateMime("script.exe", None) → False
    """
    # Check extension
    strExt = None
    if "." in strFileName:
        strExt = "." + strFileName.rsplit(".", 1)[-1].lower()

    if strExt and strExt not in ALLOWED_EXTENSIONS:
        return False

    # Check MIME
    if strContentType and strContentType in ALLOWED_MIMES:
        return True

    # Fallback: guess MIME from extension
    strGuessedMime, _ = mimetypes.guess_type(strFileName)
    if strGuessedMime and strGuessedMime in ALLOWED_MIMES:
        return True

    return False


def validateFileSize(iSize: int) -> bool:
    """
    Purpose : Validate if a file size is within limits.

    Inputs  :   (1) iSize : File size in bytes (int)

    Output  : True if valid, False otherwise (bool)

    Example : validateFileSize(5000000) → True
              validateFileSize(20000000) → False
    """
    return 0 < iSize <= MAX_FILE_BYTES
