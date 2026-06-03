/**
 * PaymentDetailsModal — displays payment proof and details when user clicks "Show Payment Details"
 * Visible only to Initiator and Owner.
 */
import { useState } from 'react';
import { X, Download, Eye } from 'lucide-react';
import type { Reimbursement, PaymentProof } from '../../types/reimbursement';
import AttachmentViewerModal from './AttachmentViewerModal';

interface PaymentDetailsModalProps {
  objReimbursement: Reimbursement;
  onClose: () => void;
}

export default function PaymentDetailsModal({
  objReimbursement,
  onClose,
}: PaymentDetailsModalProps) {
  const [bShowViewer, setBShowViewer] = useState(false);
  const objProof = objReimbursement.payment_proof;

  if (!objProof) {
    return (
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-3 sm:p-4">
        <div className="bg-white rounded-lg p-4 sm:p-6 max-w-md w-full">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Payment Details</h3>
            <button onClick={onClose}><X className="w-5 h-5 text-gray-400" /></button>
          </div>
          <p className="text-gray-600">No payment proof available</p>
        </div>
      </div>
    );
  }

  const fmtDate = (str: string) => {
    if (!str) return '—';
    const d = new Date(str);
    return d.toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const fmtAmt = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

  const fTotal = objReimbursement.items.reduce((sum, item) => sum + item.amount, 0);

  return (
    <>
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-3 sm:p-4">
        <div className="bg-white rounded-lg p-4 sm:p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto custom-scrollbar">
          <div className="flex items-center justify-between mb-4 pb-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Payment Details</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 cursor-pointer">
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Payment Amount */}
          <div className="mb-6 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-4 border border-green-200">
            <p className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-1">Amount Paid</p>
            <p className="text-3xl font-bold text-[#00703C]">{fmtAmt(fTotal)}</p>
          </div>

          {/* Payment Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Payment Method</p>
              <p className="text-sm font-medium text-gray-900">{objProof.payment_method || 'Not specified'}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Transaction Reference</p>
              <p className="text-sm font-mono font-semibold text-gray-900">{objProof.transaction_ref}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Payment Date</p>
              <p className="text-sm font-medium text-gray-900">{fmtDate(objProof.payment_date)}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Paid By</p>
              <p className="text-sm font-medium text-gray-900">{objProof.paid_by || '—'}</p>
            </div>
          </div>

          {/* Proof of Payment */}
          <div className="mb-6">
            <h4 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-blue-600 text-xs font-bold">📎</span>
              Proof of Payment
            </h4>
            <div className="border-2 border-dashed border-blue-300 rounded-lg p-4 bg-blue-50">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 rounded-lg bg-white border border-blue-200 flex items-center justify-center">
                  <span className="text-lg">📄</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">Payment Proof Document</p>
                  <p className="text-xs text-gray-500">Uploaded by Accountant</p>
                </div>
              </div>
              <button
                onClick={() => setBShowViewer(true)}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-semibold transition-colors"
              >
                <Eye className="w-4 h-4" />
                View Document
              </button>
            </div>
          </div>

          {/* Close Button */}
          <div className="flex justify-end pt-4 border-t border-gray-200">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 text-sm font-medium"
            >
              Close
            </button>
          </div>
        </div>
      </div>

      {/* Attachment Viewer Modal */}
      {bShowViewer && (
        <AttachmentViewerModal
          lsAttachmentIds={[objProof.attachment_id]}
          iInitialIndex={0}
          onClose={() => setBShowViewer(false)}
        />
      )}
    </>
  );
}
