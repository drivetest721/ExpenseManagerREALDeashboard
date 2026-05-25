'''
Purpose : Business-day calculation utilities for SLA enforcement.
          Business days exclude Saturdays, Sundays, and company holidays
          stored in the `holidays` MongoDB collection.

Inputs  : datetime objects (date portion used only).

Output  : Adjusted datetime objects or boolean flags.

Dependencies: config.mongodb_config (for holiday lookup)
'''

import logging
from datetime import datetime, date, timedelta
from typing import Optional, Set

objLogger = logging.getLogger(__name__)


def _getHolidayDates() -> Set[date]:
    """
    Purpose : Fetch all holiday dates from the `holidays` collection.
              Cached per-call (no in-memory caching to avoid stale data).

    Inputs  : None

    Output  : Set of date objects representing company holidays.

    Example : setHolidays = _getHolidayDates()
    """
    try:
        # Import here to avoid circular imports at module load
        from config.mongodb_config import get_collection
        objHolidays = get_collection("holidays")
        setCursor = objHolidays.find({}, {"date": 1, "_id": 0})
        setHolidayDates: Set[date] = set()
        for dictHoliday in setCursor:
            dtHoliday = dictHoliday.get("date")
            if isinstance(dtHoliday, datetime):
                setHolidayDates.add(dtHoliday.date())
            elif isinstance(dtHoliday, date):
                setHolidayDates.add(dtHoliday)
        return setHolidayDates
    except Exception as objErr:
        objLogger.warning(f"⚠️ Could not fetch holidays: {objErr}. Proceeding without.")
        return set()


def isBusinessDay(dtDate: datetime, setHolidays: Optional[Set[date]] = None) -> bool:
    """
    Purpose : Determine whether a given datetime falls on a business day
              (Mon–Fri, non-holiday).

    Inputs  :   (1) dtDate      : The date to check (datetime or date).
                (2) setHolidays : Optional pre-fetched holiday set (avoids DB hit).

    Output  : True if business day, False otherwise.

    Example : isBusinessDay(datetime(2026, 5, 25))  # Monday → True
              isBusinessDay(datetime(2026, 5, 24))  # Sunday → False
    """
    objDate = dtDate.date() if isinstance(dtDate, datetime) else dtDate
    if objDate.weekday() >= 5:          # 5 = Saturday, 6 = Sunday
        return False
    if setHolidays is None:
        setHolidays = _getHolidayDates()
    return objDate not in setHolidays


def getBusinessDayDelta(dtStart: datetime, iDays: int) -> datetime:
    """
    Purpose : Return the datetime that is `iDays` business days after `dtStart`.
              Skips weekends and company holidays.

    Inputs  :   (1) dtStart : Starting datetime.
                (2) iDays   : Number of business days to advance (int, must be ≥ 0).

    Output  : datetime advanced by iDays business days (time portion preserved).

    Example : deadline = getBusinessDayDelta(getCurrentIst(), 3)
              # 3 business days from now
    """
    if iDays < 0:
        raise ValueError("iDays must be non-negative")

    setHolidays = _getHolidayDates()
    dtCurrent = dtStart
    iCount = 0
    while iCount < iDays:
        dtCurrent = dtCurrent + timedelta(days=1)
        if isBusinessDay(dtCurrent, setHolidays):
            iCount += 1
    return dtCurrent


def businessDaysBetween(dtStart: datetime, dtEnd: datetime) -> int:
    """
    Purpose : Count the number of business days between two datetimes (exclusive of start).

    Inputs  :   (1) dtStart : Start datetime (exclusive).
                (2) dtEnd   : End datetime (inclusive).

    Output  : Integer count of business days.

    Example : iDays = businessDaysBetween(dtSubmitted, getCurrentIst())
    """
    setHolidays = _getHolidayDates()
    iCount = 0
    dtCurrent = dtStart + timedelta(days=1)
    while dtCurrent.date() <= dtEnd.date():
        if isBusinessDay(dtCurrent, setHolidays):
            iCount += 1
        dtCurrent += timedelta(days=1)
    return iCount
