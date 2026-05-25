'''
Purpose : IST (Indian Standard Time) timezone utilities.
          All timestamps stored in MongoDB MUST be IST local time.

Inputs  : UTC or naive datetime objects.

Output  : IST-aware datetime objects.

Dependencies: None (stdlib only — zoneinfo available in Python 3.9+)
'''

import logging
from datetime import datetime, timezone, timedelta
from zoneinfo import ZoneInfo

objLogger = logging.getLogger(__name__)

# UTC+5:30
_IST_TZ = ZoneInfo("Asia/Kolkata")
_IST_OFFSET = timedelta(hours=5, minutes=30)


def getCurrentIst() -> datetime:
    """
    Purpose : Return the current datetime in IST (Asia/Kolkata) timezone.

    Inputs  : None

    Output  : timezone-aware datetime in IST.

    Example : dtNow = getCurrentIst()
              # 2026-05-25 18:30:00+05:30
    """
    return datetime.now(tz=_IST_TZ)


def toIst(dtUtc: datetime) -> datetime:
    """
    Purpose : Convert a UTC (or naive-UTC) datetime to IST.

    Inputs  :   (1) dtUtc : UTC datetime (tz-aware preferred; naive treated as UTC).

    Output  : timezone-aware datetime in IST.

    Example : dtIst = toIst(datetime(2026, 5, 25, 13, 0, tzinfo=timezone.utc))
              # 2026-05-25 18:30:00+05:30
    """
    if dtUtc.tzinfo is None:
        # Treat naive as UTC
        dtUtc = dtUtc.replace(tzinfo=timezone.utc)
    return dtUtc.astimezone(_IST_TZ)


def toUtc(dtIst: datetime) -> datetime:
    """
    Purpose : Convert an IST datetime to UTC.

    Inputs  :   (1) dtIst : IST datetime (tz-aware preferred; naive treated as IST).

    Output  : timezone-aware datetime in UTC.

    Example : dtUtc = toUtc(getCurrentIst())
    """
    if dtIst.tzinfo is None:
        dtIst = dtIst.replace(tzinfo=_IST_TZ)
    return dtIst.astimezone(timezone.utc)


def formatIstDisplay(dtIst: datetime) -> str:
    """
    Purpose : Format an IST datetime as a human-readable string for logs / UI.

    Inputs  :   (1) dtIst : IST datetime.

    Output  : String in format "DD-Mon-YYYY HH:MM IST".

    Example : formatIstDisplay(getCurrentIst())
              # "25-May-2026 18:30 IST"
    """
    return dtIst.strftime("%d-%b-%Y %H:%M IST")
