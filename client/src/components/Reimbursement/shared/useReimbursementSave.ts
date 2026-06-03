/**
 * useReimbursementSave — Shared save-draft / submit handler.
 * Returns bIsSaving + a save(bSubmit) function. Caller passes a payload builder.
 *
 * Flow (Create):
 *   Save Draft → POST /api/reimbursements/draft
 *   Submit     → POST /api/reimbursements/draft  (creates draft)
 *                 → POST /api/reimbursements/:id/submit  (transitions DRAFT → SUBMITTED)
 *
 * Flow (Update):
 *   Save Draft → PUT /api/reimbursements/:id/draft
 *   Submit     → PUT /api/reimbursements/:id/draft (updates draft)
 *                 → POST /api/reimbursements/:id/submit (transitions DRAFT → SUBMITTED)
 */
import { useState } from 'react';
import { createDraftApi, updateDraftApi, submitReimbursementApi } from '../../../utils/reimbursementApi';

export interface SaveResult {
  ok: boolean;
  error?: string;
}

export function useReimbursementSave(
  buildPayload: () => any | null,
  onSuccess: () => void,
  onError: (msg: string) => void,
  strReimbursementId?: string,
) {
  const [bIsSaving, setBIsSaving] = useState(false);

  const save = async (bSubmit: boolean): Promise<SaveResult> => {
    const objPayload = buildPayload();
    if (!objPayload) return { ok: false };

    setBIsSaving(true);
    try {
      let strId: string;

      if (strReimbursementId) {
        // Step 1: Update existing draft
        const objDraft = await updateDraftApi(strReimbursementId, {
          description: objPayload.description,
          items: objPayload.items,
          business_trip_meta: objPayload.business_trip_meta,
        });
        strId = objDraft.reimbursement_id;
      } else {
        // Step 1: Create new draft
        const objDraft = await createDraftApi(objPayload);
        strId = objDraft.reimbursement_id;
      }

      // Step 2: if submit, transition DRAFT → SUBMITTED via a separate call
      if (bSubmit) {
        await submitReimbursementApi(strId);
      }

      onSuccess();
      return { ok: true };
    } catch (objErr: any) {
      const strMsg = objErr?.response?.data?.detail || 'Failed to save reimbursement. Please check your connection and try again.';
      onError(strMsg);
      return { ok: false, error: strMsg };
    } finally {
      setBIsSaving(false);
    }
  };

  return { bIsSaving, save };
}
