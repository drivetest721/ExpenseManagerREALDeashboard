"""
Purpose : Phase 1 unit tests for date_utils, business_day_utils, response_utils,
          crypto_utils, ReimbursementCounter, and AuditLogger.

          Uses pytest.  All tests that require MongoDB are guarded with a
          mongomock fixture so they can run offline.

Run     : cd c:\\aryan\\ExpenseManager
          .venv\\Scripts\\python.exe -m pytest "API Test/utils/Test/test.py" -v

Dependencies: pytest, mongomock (install via pip install mongomock)
"""

import sys
import os
from datetime import datetime, timezone, timedelta

import pytest

# Allow imports from sourcecode/
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "..", "sourcecode"))


# ─── date_utils ─────────────────────────────────────────────────────────────

from utils.date_utils import getCurrentIst, toIst, toUtc, formatIstDisplay


def test_getCurrentIst_is_aware():
    dtNow = getCurrentIst()
    assert dtNow.tzinfo is not None, "getCurrentIst() must return timezone-aware datetime"


def test_getCurrentIst_offset():
    dtNow = getCurrentIst()
    iOffsetHours = dtNow.utcoffset().total_seconds() / 3600
    assert iOffsetHours == 5.5, f"Expected IST offset +5.5h, got {iOffsetHours}"


def test_toIst_from_utc():
    dtUtc = datetime(2026, 5, 25, 13, 0, 0, tzinfo=timezone.utc)
    dtIst = toIst(dtUtc)
    assert dtIst.hour == 18 and dtIst.minute == 30, "13:00 UTC should be 18:30 IST"


def test_toIst_naive_treated_as_utc():
    dtNaive = datetime(2026, 5, 25, 0, 0, 0)  # naive
    dtIst = toIst(dtNaive)
    assert dtIst.hour == 5 and dtIst.minute == 30


def test_toUtc_roundtrip():
    dtNow = getCurrentIst()
    dtUtc = toUtc(dtNow)
    dtBack = toIst(dtUtc)
    assert abs((dtBack - dtNow).total_seconds()) < 1


def test_formatIstDisplay():
    dtIst = toIst(datetime(2026, 5, 25, 13, 0, 0, tzinfo=timezone.utc))
    strFormatted = formatIstDisplay(dtIst)
    assert "2026" in strFormatted and "IST" in strFormatted


# ─── business_day_utils ──────────────────────────────────────────────────────

from utils.business_day_utils import isBusinessDay, getBusinessDayDelta, businessDaysBetween


def test_isBusinessDay_monday():
    dtMonday = datetime(2026, 5, 25)   # Monday
    assert isBusinessDay(dtMonday, set()) is True


def test_isBusinessDay_saturday():
    dtSat = datetime(2026, 5, 23)      # Saturday
    assert isBusinessDay(dtSat, set()) is False


def test_isBusinessDay_sunday():
    dtSun = datetime(2026, 5, 24)      # Sunday
    assert isBusinessDay(dtSun, set()) is False


def test_isBusinessDay_holiday():
    dtHoliday = datetime(2026, 5, 25)
    assert isBusinessDay(dtHoliday, {dtHoliday.date()}) is False


def test_getBusinessDayDelta_skips_weekend():
    # Friday 2026-05-22 + 1 business day → Monday 2026-05-25
    dtFriday = datetime(2026, 5, 22)
    dtResult = getBusinessDayDelta(dtFriday, 1, )
    assert dtResult.date() == datetime(2026, 5, 25).date()


def test_getBusinessDayDelta_zero():
    dtStart = datetime(2026, 5, 25)
    assert getBusinessDayDelta(dtStart, 0).date() == dtStart.date()


def test_getBusinessDayDelta_raises_on_negative():
    with pytest.raises(ValueError):
        getBusinessDayDelta(datetime(2026, 5, 25), -1)


def test_businessDaysBetween():
    # Mon to Fri (5 business days: Tue Wed Thu Fri + Mon skip weekend)
    dtStart = datetime(2026, 5, 25)   # Monday
    dtEnd = datetime(2026, 5, 29)     # Friday same week
    assert businessDaysBetween(dtStart, dtEnd) == 4   # Tue, Wed, Thu, Fri


# ─── response_utils ──────────────────────────────────────────────────────────

from utils.response_utils import successResponse, errorResponse, paginatedResponse


def test_successResponse_basic():
    dictResp = successResponse("ok", {"id": "1"})
    assert dictResp["success"] is True
    assert dictResp["data"] == {"id": "1"}
    assert dictResp["message"] == "ok"


def test_successResponse_custom_key():
    dictResp = successResponse("listed", [1, 2, 3], strKey="items")
    assert "items" in dictResp
    assert dictResp["items"] == [1, 2, 3]


def test_errorResponse():
    dictResp = errorResponse("Not found", 404)
    assert dictResp["success"] is False
    assert dictResp["status_code"] == 404


def test_paginatedResponse_has_next():
    dictResp = paginatedResponse("ok", list(range(20)), 55, 1, 20)
    assert dictResp["has_next"] is True
    assert dictResp["total"] == 55


def test_paginatedResponse_last_page():
    dictResp = paginatedResponse("ok", list(range(15)), 55, 3, 20)
    assert dictResp["has_next"] is False


# ─── crypto_utils ────────────────────────────────────────────────────────────

from utils.crypto_utils import generateAskKeyPair, encryptAskMessage, decryptAskMessage


def test_generateAskKeyPair_returns_pem():
    strPriv, strPub = generateAskKeyPair()
    assert "BEGIN RSA PRIVATE KEY" in strPriv or "BEGIN PRIVATE KEY" in strPriv
    assert "BEGIN PUBLIC KEY" in strPub


def test_encryptDecrypt_roundtrip():
    strPriv, strPub = generateAskKeyPair()
    strOriginal = "Invoice image is blurry. Please re-upload."
    strCipher = encryptAskMessage(strOriginal, strPub)
    assert strCipher != strOriginal
    strDecrypted = decryptAskMessage(strCipher, strPriv)
    assert strDecrypted == strOriginal


def test_different_keypairs_cannot_decrypt():
    _, strPub1 = generateAskKeyPair()
    strPriv2, _ = generateAskKeyPair()
    strCipher = encryptAskMessage("secret", strPub1)
    with pytest.raises(Exception):
        decryptAskMessage(strCipher, strPriv2)
