/**
 * CAPayDialog — modal for CA to mark a reimbursement as PAID.
 * Captures transaction_ref, payment_method and an optional note.
 */
import { useState } from 'react';
import { X } from 'lucide-react';
import { payReimbursementApi } from '../../utils/approvalApi';

interface CAPayDialogProps {
  strReimbursementId: string;
  onSuccess: () => void;
  onClose: () => void;
}

export default function CAPayDialog({
  strReimbursementId,
  onSuccess,
  onClose,
}: CAPayDialogProps) {
  const [strTxRef, setStrTxRef] = useState<string>('');
  const [strMethod, setStrMethod] = useState<string>('UPI');
  const [strNote, setStrNote] = useState<string>('');
  const [bIsLoading, setBIsLoading] = useState<boolean>(false);
  const [strError, setStrError] = useState<string>('');

  async function handleSubmit() {
    if (!strTxRef.trim()) {
      setStrError('Transaction reference is required');
      return;
    }
    setBIsLoading(true);
    setStrError('');
    try {
      await payReimbursementApi(strReimbursementId, {
        transaction_ref: strTxRef.trim(),
        payment_method: strMethod || undefined,
        note: strNote || undefined,
      });
      onSuccess();
      onClose();
    } catch (objErr: any) {
      setStrError(objErr.response?.data?.detail || 'Payment failed');
    } finally {
      setBIsLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-3 sm:p-4">
      <div className="bg-white rounded-lg p-4 sm:p-6 max-w-md w-full">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Mark as Paid</h3>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-400" /></button>
        </div>

        <div className="space-y-3 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 cursor-default">
              Transaction Reference <span className="text-red-600">*</span>
            </label>
            <input
              type="text"
              value={strTxRef}
              onChange={(e) => setStrTxRef(e.target.value)}
              placeholder="e.g. UPI/2026/123456"
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 cursor-default">
              Payment Method
            </label>
            <select
              value={strMethod}
              onChange={(e) => setStrMethod(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm bg-white"
            >
              <option value="UPI">UPI</option>
              <option value="BANK_TRANSFER">Bank Transfer</option>
              <option value="CHEQUE">Cheque</option>
              <option value="CASH">Cash</option>
              <option value="OTHER">Other</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 cursor-default">
              Note (optional)
            </label>
            <textarea
              value={strNote}
              onChange={(e) => setStrNote(e.target.value)}
              rows={2}
              placeholder="Internal note"
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
            />
          </div>
        </div>

        {strError && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded p-2 mb-4 text-sm cursor-default">
            {strError}
          </div>
        )}

        <div className="flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 text-sm"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={bIsLoading}
            className="px-4 py-2 bg-[#00703C] text-white rounded hover:bg-[#005a30] text-sm disabled:opacity-50"
          >
            {bIsLoading ? 'Processing...' : 'Confirm Payment'}
          </button>
        </div>
      </div>
    </div>
  );
}
