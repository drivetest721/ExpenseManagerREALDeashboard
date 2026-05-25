'''
Purpose : Atomic reimbursement code generator.
          Uses MongoDB's `$inc` operation on the `counters` collection to produce
          guaranteed-unique, gap-free sequence numbers per calendar year.

          Format: RB-{YEAR}-{6-digit zero-padded sequence}
          Example: RB-2026-000001

Inputs  : Calendar year string.

Output  : Unique reimbursement code string.

Dependencies: config.mongodb_config
'''

import logging
import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config.mongodb_config import get_collection

objLogger = logging.getLogger(__name__)

_COUNTER_SEQUENCE_DIGITS = 6   # Zero-padded to 6 digits → max 999 999 per year


def getNextReimbursementCode(strYear: str) -> str:
    """
    Purpose : Atomically increment the per-year counter and return the next
              formatted reimbursement code.

    Inputs  :   (1) strYear : 4-digit calendar year string (e.g., "2026").

    Output  : Reimbursement code string in format "RB-YYYY-NNNNNN".

    Example : strCode = getNextReimbursementCode("2026")
              # "RB-2026-000001"

    Notes   : Uses find_one_and_update with upsert=True so the counter document
              is created automatically on first use per year.
              This operation is atomic — safe under concurrent requests.
    """
    strCounterName = f"reimbursement_{strYear}"
    objCounters = get_collection("counters")

    dictResult = objCounters.find_one_and_update(
        {"name": strCounterName},
        {"$inc": {"sequence": 1}},
        upsert=True,
        return_document=True,   # Return the document AFTER the update
    )

    iSequence: int = dictResult["sequence"]
    strCode = f"RB-{strYear}-{iSequence:0{_COUNTER_SEQUENCE_DIGITS}d}"

    objLogger.info(f"✅ Generated reimbursement code: {strCode}")
    return strCode


def getCurrentSequence(strYear: str) -> int:
    """
    Purpose : Return the current (last issued) sequence number for a given year
              without incrementing it.  Useful for audits and dashboards.

    Inputs  :   (1) strYear : 4-digit calendar year string (e.g., "2026").

    Output  : Integer sequence number (0 if no reimbursement has been issued yet).

    Example : iSeq = getCurrentSequence("2026")  # 42
    """
    strCounterName = f"reimbursement_{strYear}"
    objCounters = get_collection("counters")
    dictCounter = objCounters.find_one({"name": strCounterName})
    return dictCounter["sequence"] if dictCounter else 0
