/**
 * useReimbursementSave — Shared save-draft / submit handler.
 * Returns bIsSaving + a save(bSubmit) function. Caller passes a payload builder.
 *
 * Flow:
 *   Save Draft → POST /api/reimbursements/draft
 *   Submit     → POST /api/reimbursements/draft  (creates draft)
 *                 → POST /api/reimbursements/:id/submit  (transitions DRAFT → SUBMITTED)
 */
import { useState } from 'react';
import { createDraftApi, submitReimbursementApi } from '../../../utils/reimbursementApi';

export interface SaveResult {
  ok: boolean;
  error?: string;
}

export function useReimbursementSave(
  buildPayload: () => any | null,
  onSuccess: () => void,
  onError: (msg: string) => void,
) {
  const [bIsSaving, setBIsSaving] = useState(false);

  const save = async (bSubmit: boolean): Promise<SaveResult> => {
    const objPayload = buildPayload();
    if (!objPayload) return { ok: false };

    setBIsSaving(true);
    try {
      // Step 1: always create the draft first
      const objDraft = await createDraftApi(objPayload);

      // Step 2: if submit, transition DRAFT → SUBMITTED via a separate call
      if (bSubmit) {
        await submitReimbursementApi(objDraft.reimbursement_id);
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
