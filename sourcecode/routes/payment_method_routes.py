'''
Purpose : CRUD routes for Payment Methods.
          Users can create/list/delete UPI ID or QR scanner payment methods.

Inputs  : HTTP requests (JSON bodies for mutations, path params for IDs).

Output  : JSON success/error responses with PaymentMethod metadata.

Dependencies: fastapi, mongodb_config, jwt_middleware, payment_method_schemas, AuditLogger
'''

import logging
from typing import List

from bson import ObjectId
from fastapi import APIRouter, HTTPException, status, Depends

from config.mongodb_config import get_collection
from middleware.jwt_middleware import getCurrentUserDependency
from schemas.payment_method_schemas import (
    PaymentMethodCreateRequest,
    PaymentMethodResponseSchema,
)
from controllers.AuditLogger import logMutation

objLogger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/payment-methods", tags=["PaymentMethods"])


# ── helpers ───────────────────────────────────────────────────────────────────

def _docToSchema(dictDoc: dict) -> PaymentMethodResponseSchema:
    """Map a MongoDB document to PaymentMethodResponseSchema."""
    dictDoc = dict(dictDoc)
    dictDoc["payment_method_id"] = str(dictDoc.pop("_id"))
    dictDoc["user_id"] = str(dictDoc.get("user_id", ""))
    return PaymentMethodResponseSchema(**dictDoc)


def hasAnyPaymentMethod(strUserId: str) -> bool:
    """Check if user has at least one payment method."""
    objPaymentMethods = get_collection("payment_methods")
    return objPaymentMethods.count_documents({"user_id": strUserId}) > 0


# ── routes ────────────────────────────────────────────────────────────────────

@router.post("/create", response_model=PaymentMethodResponseSchema, status_code=status.HTTP_201_CREATED)
async def createPaymentMethod(
    objRequest: PaymentMethodCreateRequest,
    dictCurrentUser: dict = Depends(getCurrentUserDependency),
):
    """
    Purpose : Create a new payment method for the current user.
    Access  : Any authenticated user.
    """
    try:
        objPaymentMethods = get_collection("payment_methods")
        strUserId = dictCurrentUser["user_id"]

        # Validate: UPI_ID requires upi_id; QR_CODE requires qr_image_url
        if objRequest.type.value == "UPI_ID" and not objRequest.upi_id:
            raise HTTPException(status_code=400, detail="UPI_ID type requires upi_id field")
        if objRequest.type.value == "QR_CODE" and not objRequest.qr_image_url:
            raise HTTPException(status_code=400, detail="QR_CODE type requires qr_image_url field")

        # If setting this as default, unset all other defaults
        if objRequest.is_default:
            objPaymentMethods.update_many(
                {"user_id": strUserId},
                {"$set": {"is_default": False}}
            )

        dictNew = objRequest.model_dump()
        dictNew["user_id"] = strUserId
        dictNew["type"] = objRequest.type.value

        objResult = objPaymentMethods.insert_one(dictNew)
        dictNew["_id"] = objResult.inserted_id

        logMutation("payment_methods", None, dictNew, "INSERT", strUserId, str(objResult.inserted_id))

        return _docToSchema(dictNew)

    except HTTPException:
        raise
    except Exception as objErr:
        objLogger.error(f"❌ CREATE PAYMENT METHOD ERROR: {objErr}")
        raise HTTPException(status_code=500, detail=str(objErr))


@router.get("/my", response_model=List[PaymentMethodResponseSchema])
async def listMyPaymentMethods(dictCurrentUser: dict = Depends(getCurrentUserDependency)):
    """
    Purpose : List all payment methods for the current user.
    Access  : Any authenticated user.
    """
    try:
        objPaymentMethods = get_collection("payment_methods")
        strUserId = dictCurrentUser["user_id"]

        lsDocs = list(objPaymentMethods.find({"user_id": strUserId}))
        return [_docToSchema(d) for d in lsDocs]

    except Exception as objErr:
        objLogger.error(f"❌ LIST MY PAYMENT METHODS ERROR: {objErr}")
        raise HTTPException(status_code=500, detail=str(objErr))


@router.put("/{payment_method_id}/default", response_model=PaymentMethodResponseSchema)
async def setDefaultPaymentMethod(
    payment_method_id: str,
    dictCurrentUser: dict = Depends(getCurrentUserDependency),
):
    """
    Purpose : Set a payment method as the default.
    Access  : Owner of the payment method.
    """
    try:
        objPaymentMethods = get_collection("payment_methods")
        strUserId = dictCurrentUser["user_id"]

        dictOld = objPaymentMethods.find_one({"_id": ObjectId(payment_method_id), "user_id": strUserId})
        if not dictOld:
            raise HTTPException(status_code=404, detail="Payment method not found")

        # Unset all other defaults
        objPaymentMethods.update_many(
            {"user_id": strUserId},
            {"$set": {"is_default": False}}
        )

        # Set this one as default
        objPaymentMethods.update_one(
            {"_id": ObjectId(payment_method_id)},
            {"$set": {"is_default": True}}
        )

        dictNew = objPaymentMethods.find_one({"_id": ObjectId(payment_method_id)})
        logMutation("payment_methods", dictOld, dictNew, "UPDATE", strUserId, payment_method_id)

        return _docToSchema(dictNew)

    except HTTPException:
        raise
    except Exception as objErr:
        objLogger.error(f"❌ SET DEFAULT PAYMENT METHOD ERROR: {objErr}")
        raise HTTPException(status_code=500, detail=str(objErr))


@router.delete("/{payment_method_id}", status_code=status.HTTP_204_NO_CONTENT)
async def deletePaymentMethod(
    payment_method_id: str,
    dictCurrentUser: dict = Depends(getCurrentUserDependency),
):
    """
    Purpose : Delete a payment method.
    Access  : Owner of the payment method.
    """
    try:
        objPaymentMethods = get_collection("payment_methods")
        strUserId = dictCurrentUser["user_id"]

        dictOld = objPaymentMethods.find_one({"_id": ObjectId(payment_method_id), "user_id": strUserId})
        if not dictOld:
            raise HTTPException(status_code=404, detail="Payment method not found")

        objPaymentMethods.delete_one({"_id": ObjectId(payment_method_id)})
        logMutation("payment_methods", dictOld, None, "DELETE", strUserId, payment_method_id)

        return None

    except HTTPException:
        raise
    except Exception as objErr:
        objLogger.error(f"❌ DELETE PAYMENT METHOD ERROR: {objErr}")
        raise HTTPException(status_code=500, detail=str(objErr))
