'''
Purpose : Lightweight virus / malware scanner for uploaded attachments.
          Strategy:
            1. If a ClamAV daemon is reachable (VIRUS_SCAN_CLAMD_HOST), delegate to it.
            2. Otherwise fall back to a structural scan:
                 - EICAR test-signature detection (works for any file type).
                 - DOCX-specific safety checks: must be a valid OOXML zip,
                   no embedded VBA macros (vbaProject.bin),
                   no suspicious external relationship targets.

Inputs  : raw bytes + filename.

Output  : dict { status, engine, details }
          status \u2208 { "clean", "infected", "error", "skipped" }

Dependencies: stdlib only (zipfile, io, os).  pyclamd is optional.
'''

import io
import os
import zipfile
import logging

objLogger = logging.getLogger(__name__)

# EICAR antivirus test string \u2014 every reputable AV must flag this.
EICAR_SIGNATURE = (
    b"X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*"
)

# DOCX parts that, if present, indicate macros or risky behaviour.
DOCX_SUSPICIOUS_PARTS = (
    "word/vbaProject.bin",         # VBA macros
    "word/vbaData.xml",
    "word/activeX/",
    "word/embeddings/oleObject",   # OLE-embedded executables
)

# Suspicious relationship target schemes/keywords inside .rels files.
DOCX_SUSPICIOUS_REL_TOKENS = (
    b"mhtml:",
    b"javascript:",
    b"vbscript:",
    b"file://",
)


def _scanWithClamd(bytContent: bytes) -> dict | None:
    """Try to scan via an external ClamAV daemon. Returns None when not available."""
    strHost = os.getenv("VIRUS_SCAN_CLAMD_HOST")
    if not strHost:
        return None
    try:
        import pyclamd  # optional dependency
    except Exception:
        return None
    try:
        iPort = int(os.getenv("VIRUS_SCAN_CLAMD_PORT", "3310"))
        objCd = pyclamd.ClamdNetworkSocket(host=strHost, port=iPort)
        if not objCd.ping():
            return None
        objRes = objCd.scan_stream(bytContent)
        if objRes is None:
            return {"status": "clean", "engine": "clamav", "details": "OK"}
        # objRes example: {'stream': ('FOUND', 'Eicar-Test-Signature')}
        strSig = ""
        try:
            strSig = list(objRes.values())[0][1]
        except Exception:
            strSig = str(objRes)
        return {"status": "infected", "engine": "clamav", "details": strSig}
    except Exception as objErr:
        objLogger.warning(f"clamd scan failed, falling back: {objErr}")
        return None


def _scanDocxStructure(bytContent: bytes) -> dict:
    """Inspect DOCX OOXML zip for macros / suspicious relationships."""
    try:
        with zipfile.ZipFile(io.BytesIO(bytContent), "r") as objZip:
            lsNames = objZip.namelist()
            for strPart in DOCX_SUSPICIOUS_PARTS:
                for strName in lsNames:
                    if strName.startswith(strPart) or strName == strPart:
                        return {
                            "status": "infected",
                            "engine": "structural",
                            "details": f"Suspicious component: {strName}",
                        }
            for strName in lsNames:
                if strName.endswith(".rels"):
                    try:
                        bytRel = objZip.read(strName)
                    except Exception:
                        continue
                    strLower = bytRel.lower()
                    for bytTok in DOCX_SUSPICIOUS_REL_TOKENS:
                        if bytTok in strLower:
                            return {
                                "status": "infected",
                                "engine": "structural",
                                "details": f"Suspicious link in {strName}: {bytTok.decode()}",
                            }
    except zipfile.BadZipFile:
        return {
            "status": "infected",
            "engine": "structural",
            "details": "File is not a valid DOCX/OOXML archive",
        }
    except Exception as objErr:
        return {"status": "error", "engine": "structural", "details": str(objErr)}
    return {"status": "clean", "engine": "structural", "details": "OK"}


def scanFileBytes(bytContent: bytes, strFileName: str) -> dict:
    """
    Purpose : Scan an attachment payload for malware.

    Inputs  :   (1) bytContent  : raw file bytes
                (2) strFileName : original filename (used for extension routing)

    Output  : dict { status, engine, details }
    """
    if os.getenv("VIRUS_SCAN_ENABLED", "1") == "0":
        return {"status": "skipped", "engine": "disabled", "details": "Scanning disabled"}

    if EICAR_SIGNATURE in bytContent:
        return {"status": "infected", "engine": "signature", "details": "EICAR-Test-Signature"}

    objClamRes = _scanWithClamd(bytContent)
    if objClamRes is not None:
        return objClamRes

    strLower = (strFileName or "").lower()
    if strLower.endswith(".docx"):
        return _scanDocxStructure(bytContent)

    return {"status": "clean", "engine": "basic", "details": "OK"}
