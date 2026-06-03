/**
 * CAPayDialog — modal for CA to mark a reimbursement as PAID.
 * Captures transaction_ref, payment_method, optional note, and proof of payment.
 */
import { useState } from 'react';
import { X, Paperclip, Upload } from 'lucide-react';
import { payReimbursementApi } from '../../utils/approvalApi';
import { uploadAttachmentApi } from '../../utils/attachmentApi';

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
  const [objProofFile, setObjProofFile] = useState<File | null>(null);
  const [strProofFileName, setStrProofFileName] = useState<string>('');
  const [bIsLoading, setBIsLoading] = useState<boolean>(false);
  const [bIsUploading, setBIsUploading] = useState<boolean>(false);
  const [strError, setStrError] = useState<string>('');
  const [strProofAttachmentId, setStrProofAttachmentId] = useState<string>('');

  const handleProofFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      setStrError('Only JPG, PNG, GIF, and PDF files are allowed');
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setStrError('File size must be less than 10MB');
      return;
    }

    setObjProofFile(file);
    setStrProofFileName(file.name);
    setStrError('');

    // Upload the file immediately (uploadAttachmentApi expects a File)
    setBIsUploading(true);
    try {
      const response = await uploadAttachmentApi(file);
      setStrProofAttachmentId(response.attachment_id);
    } catch (err: any) {
      setStrError(err?.response?.data?.detail || 'Failed to upload proof file');
      setObjProofFile(null);
      setStrProofFileName('');
    } finally {
      setBIsUploading(false);
    }
  };

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
        payment_proof_attachment_id: strProofAttachmentId || undefined,
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
      <div className="bg-white rounded-lg p-4 sm:p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Mark as Paid</h3>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-400" /></button>
        </div>

        <div className="space-y-4 mb-4">
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

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <label className="block text-sm font-medium text-gray-700 mb-2 cursor-default flex items-center gap-2">
              <Paperclip className="w-4 h-4 text-blue-600" />
              Proof of Payment <span className="text-blue-600 font-bold">(Recommended)</span>
            </label>
            {strProofFileName ? (
              <div className="flex items-center justify-between bg-white border border-green-200 rounded px-3 py-2 mb-2">
                <span className="text-sm text-green-700 font-medium truncate flex items-center gap-2">
                  <Upload className="w-4 h-4" />
                  {strProofFileName}
                </span>
                <button
                  onClick={() => {
                    setObjProofFile(null);
                    setStrProofFileName('');
                    setStrProofAttachmentId('');
                  }}
                  className="text-red-500 hover:text-red-700 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : null}
            <label className="flex items-center gap-2 px-3 py-2 text-sm font-medium border-2 border-dashed border-blue-300 rounded cursor-pointer hover:bg-blue-100/30 transition-colors">
              <Paperclip className="w-4 h-4 text-blue-600" />
              <span className="text-blue-600">{bIsUploading ? 'Uploading...' : 'Choose Image or PDF'}</span>
              <input
                type="file"
                accept="image/*,.pdf"
                disabled={bIsUploading || bIsLoading}
                onChange={handleProofFileSelect}
                className="hidden"
              />
            </label>
            <p className="text-xs text-gray-500 mt-2">JPG, PNG, GIF, or PDF (max 10MB)</p>
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
            disabled={bIsLoading || bIsUploading}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={bIsLoading || bIsUploading}
            className="px-4 py-2 bg-[#00703C] text-white rounded hover:bg-[#005a30] text-sm disabled:opacity-50"
          >
            {bIsLoading ? 'Processing...' : 'Confirm Payment'}
          </button>
        </div>
      </div>
    </div>
  );
}
