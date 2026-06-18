/**
 * ReimbursementDetailsPanel — Left panel for detail view showing reimbursement
 * items as a perfectly aligned table with lines between columns and rows.
 * Includes action dropdown at bottom for reviewers.
 * UPDATED: Removed CA-specific actions, updated for 9-state workflow, added mark-viewed call.
 */
import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Reimbursement } from '../../types/reimbursement';
import {
  approveReimbursementApi,
  queryReimbursementApi,
  askReimbursementApi,
  reapplyReimbursementApi,
  acknowledgePaymentApi,
  rejectReimbursementApi,
  payReimbursementApi,
  markReimbursementViewedApi,
} from '../../utils/approvalApi';
import { submitReimbursementApi, deleteReimbursementApi } from '../../utils/reimbursementApi';
import { useAuth } from '../../hooks/useAuth';
import { uploadAttachmentApi } from '../../utils/attachmentApi';
import { fmtDateTimeFull } from './../common/DateTimeFormatter';
interface Props {
  objReimbursement: Reimbursement;
  strCurrentReviewerId?: string;
  onActionSuccess?: () => void;
}

// UPDATED: Removed ca_query and ca_reapply action types
type ActionType =
  | 'submit'
  | 'delete'
  | 'approve'
  | 'query'
  | 'ask'
  | 'reapply'
  | 'acknowledge'
  | 'reject'
  | 'pay';

// UPDATED: Removed CA-specific actions (unified workflow)
const ACTION_META: Record<ActionType, { label: string; needsMessage: boolean; needsPayment?: boolean }> = {
  submit:      { label: 'Submit for Approval', needsMessage: false },
  delete:      { label: 'Delete Draft', needsMessage: false },
  approve:     { label: 'Approve', needsMessage: false },
  query:       { label: 'Query (Public)', needsMessage: true },
  ask:         { label: 'Ask (Private)', needsMessage: true },
  reapply:     { label: 'Reapply', needsMessage: true },
  acknowledge: { label: 'Acknowledge Payment', needsMessage: false },
  reject:      { label: 'Reject', needsMessage: true },
  pay:         { label: 'Mark as Paid', needsMessage: false, needsPayment: true },
};

export default function ReimbursementDetailsPanel({ objReimbursement, strCurrentReviewerId, onActionSuccess }: Props) {
  const { objUser } = useAuth();
  const navigate = useNavigate();
  const [strSelectedAction, setStrSelectedAction] = useState<ActionType | ''>('');
  const [strMessage, setStrMessage] = useState('');
  const [strTxRef, setStrTxRef] = useState('');
  const [strPayMethod, setStrPayMethod] = useState('UPI');
  const [bIsSubmitting, setBIsSubmitting] = useState(false);
  const [strError, setStrError] = useState('');
  const [bIsUploadingProof, setBIsUploadingProof] = useState(false);
  const [strProofFileName, setStrProofFileName] = useState('');
  const [strProofAttachmentId, setStrProofAttachmentId] = useState('');
  const [objConfirmModal, setObjConfirmModal] = useState<{ bIsOpen: boolean; strType: 'delete' | 'reject' | null; }>({ bIsOpen: false, strType: null });

  // Determine user permissions
  const bIsInitiator = objUser?.user_id === objReimbursement.initiator_id;
  const bIsCA = (objUser?.departments || []).some((d) => d.role === 'ca');
  const bIsCurrentReviewer = objUser?.user_id === strCurrentReviewerId;

  // NEW: Mark reimbursement as viewed when opened by current reviewer
  useEffect(() => {
    console.log(objReimbursement);
    if (bIsCurrentReviewer && objReimbursement.reimbursement_id) {
      markReimbursementViewedApi(objReimbursement.reimbursement_id)
        .then(() => console.log('✅ Marked as viewed'))
        .catch((err) => console.warn('⚠️ Failed to mark as viewed:', err));
    }
  }, [bIsCurrentReviewer, objReimbursement.reimbursement_id]);

  // UPDATED: Check if reimbursement can be edited (support new and deprecated statuses)
  const bCanEdit = bIsInitiator && ['DRAFT', 'QUERY', 'ASK', 'QUERY_RAISED', 'PRIVATE_ASK', 'CA_QUERY'].includes(objReimbursement.status);

  // UPDATED: Determine available actions for new 9-state workflow
  const lsAvailableActions = useMemo<ActionType[]>(() => {
    const lsActions: ActionType[] = [];
    const strStatus = objReimbursement.status;
    console.log('Determining actions for status:', strStatus);

    // Initiator actions
    if (bIsInitiator && strStatus === 'DRAFT') {
      lsActions.push('submit', 'delete');
    }

    // Current reviewer actions (works for all types: manager, owner, CA)
    if (bIsCurrentReviewer && ['SUBMITTED', 'IN_REVIEW', 'REAPPLIED', 'OWNER_APPROVED', 'CA_PENDING', 'CA_REAPPLIED'].includes(strStatus)) {
      
      lsActions.push('query', 'ask',);
      if (bIsCA) {
        // CA can also pay
        lsActions.push('pay', 'reject');

      } else if (!bIsInitiator){ 
        //Not Ca and Not Initiator
        lsActions.push('approve')
        
      }
    }

    // Initiator reapply (unified for all query/ask types)
    if (bIsInitiator && ['QUERY', 'ASK', 'QUERY_RAISED', 'PRIVATE_ASK', 'CA_QUERY'].includes(strStatus)) {
      lsActions.push('reapply');
    }

    // Initiator acknowledge payment
    if (bIsInitiator && strStatus === 'PAID') {
      lsActions.push('acknowledge');
    }

    console.log('Available actions:', lsActions, { bIsInitiator, strStatus, bIsCA, bIsCurrentReviewer });
    return lsActions;
  }, [objReimbursement.status, bIsInitiator, bIsCurrentReviewer, bIsCA]);

  const fmtDate = (str: string) => {
    if (!str) return '—';
    const d = new Date(str);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const fmtAmt = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

  // UPDATED: STATUS_COLORS for new 9-state workflow with backward compatibility
  const STATUS_COLORS: Record<string, string> = {
    // New 9 core states
    DRAFT: 'bg-gray-100 text-gray-700',
    SUBMITTED: 'bg-blue-100 text-blue-700',
    IN_REVIEW: 'bg-yellow-100 text-yellow-700',
    QUERY: 'bg-orange-100 text-orange-700',
    ASK: 'bg-purple-100 text-purple-700',
    REAPPLIED: 'bg-blue-100 text-blue-700',
    REJECTED: 'bg-red-100 text-red-700',
    PAID: 'bg-emerald-100 text-emerald-700',
    ACKNOWLEDGED: 'bg-green-100 text-green-700',

    // Deprecated states (backward compatibility)
    QUERY_RAISED: 'bg-orange-100 text-orange-700',
    PRIVATE_ASK: 'bg-purple-100 text-purple-700',
    OWNER_APPROVED: 'bg-green-100 text-green-700',
    CA_PENDING: 'bg-purple-100 text-purple-700',
    CA_QUERY: 'bg-orange-100 text-orange-700',
    CA_REAPPLIED: 'bg-blue-100 text-blue-700',
    PAYMENT_ACKNOWLEDGED: 'bg-green-100 text-green-700',
    AUTO_REJECTED: 'bg-red-200 text-red-800',
    CLOSED: 'bg-gray-200 text-gray-600',
  };

  const fTotal = objReimbursement.items.reduce((sum, item) => sum + item.amount, 0);

  async function handleAction() {
    if (!strSelectedAction) return;
    
    const objMeta = ACTION_META[strSelectedAction];
    if (objMeta.needsMessage && !strMessage.trim()) {
      setStrError('Please provide a message');
      return;
    }
    if (objMeta.needsPayment && !strTxRef.trim()) {
      setStrError('Transaction reference is required');
      return;
    }
    if (strSelectedAction === 'delete') {
      setObjConfirmModal({ bIsOpen: true, strType: 'delete' });
      return;
    }
    if (strSelectedAction === 'reject') {
      setObjConfirmModal({ bIsOpen: true, strType: 'reject' });
      return;
    }
    
    setBIsSubmitting(true);
    setStrError('');
    
    try {
      // UPDATED: Removed ca_query and ca_reapply (now unified)
      const objMap: Record<ActionType, () => Promise<any>> = {
        submit:      () => submitReimbursementApi(objReimbursement.reimbursement_id),
        delete:      () => deleteReimbursementApi(objReimbursement.reimbursement_id),
        approve:     () => approveReimbursementApi(objReimbursement.reimbursement_id),
        query:       () => queryReimbursementApi(objReimbursement.reimbursement_id, strMessage),
        ask:         () => askReimbursementApi(objReimbursement.reimbursement_id, strMessage),
        reapply:     () => reapplyReimbursementApi(objReimbursement.reimbursement_id, strMessage),
        acknowledge: () => acknowledgePaymentApi(objReimbursement.reimbursement_id, strMessage || undefined),
        reject:      () => rejectReimbursementApi(objReimbursement.reimbursement_id, strMessage),
        pay:         () => payReimbursementApi(objReimbursement.reimbursement_id, {
          transaction_ref: strTxRef,
          payment_method: strPayMethod || undefined,
          note: strMessage || undefined,
          payment_proof_attachment_id: strProofAttachmentId || undefined,
        }),
      };
      
      await objMap[strSelectedAction]();
      
      // Reset form
      setStrSelectedAction('');
      setStrMessage('');
      setStrTxRef('');
      setStrError('');
      
      // Notify parent to refresh
      if (onActionSuccess) onActionSuccess();
    } catch (objErr: any) {
      setStrError(objErr.response?.data?.detail || 'Action failed');
    } finally {
      setBIsSubmitting(false);
    }
  }
  // Handle confirmed delete/reject action
  const handleConfirmAction = async () => {
    if (!objConfirmModal.strType) return;
    
    const actionType = objConfirmModal.strType === 'delete' ? 'delete' : 'reject';
    setObjConfirmModal({ bIsOpen: false, strType: null });
    
    setBIsSubmitting(true);
    setStrError('');
    
    try {
      const objMap: Record<'delete' | 'reject', () => Promise<any>> = {
        delete:      () => deleteReimbursementApi(objReimbursement.reimbursement_id),
        reject:      () => rejectReimbursementApi(objReimbursement.reimbursement_id, strMessage),
      };
      
      await objMap[actionType]();
      
      // Reset form
      setStrSelectedAction('');
      setStrMessage('');
      setStrTxRef('');
      setStrError('');
      
      // Notify parent to refresh
      if (onActionSuccess) onActionSuccess();
    } catch (objErr: any) {
      setStrError(objErr.response?.data?.detail || 'Action failed');
    } finally {
      setBIsSubmitting(false);
    }
  }

  console.log({ bIsInitiator, bIsCurrentReviewer, bIsCA, lsAvailableActions });
  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-green-50 to-emerald-50">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-bold text-gray-900">Reimbursement Details</h3>
          <div className="flex items-center gap-2">
            {bCanEdit && (
              <button
                onClick={() => navigate(`/expense/edit/${objReimbursement.reimbursement_id}`)}
                className="px-3 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-md hover:bg-blue-700 transition-colors flex items-center gap-1"
                title="Edit this reimbursement"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Edit
              </button>
            )}
            <span
              className={`px-3 py-1 rounded-full text-xs font-semibold ${
                STATUS_COLORS[objReimbursement.status] ?? 'bg-gray-100 text-gray-700'
              }`}
            >
              {objReimbursement.status.replace(/_/g, ' ')}
            </span>
          </div>
        </div>
        <div className="text-sm text-gray-600 space-y-1">
          <div>
            <span className="font-semibold">Code:</span>{' '}
            <span className="font-mono">{objReimbursement.reimbursement_code || '—'}</span>
          </div>
          <div>
            <span className="font-semibold">Form Type:</span>{' '}
            <span className="capitalize">{objReimbursement.form_type.replace(/_/g, ' ')}</span>
          </div>
          <div>
            <span className="font-semibold">Initiator:</span> {objReimbursement.initiator_name}
          </div>
          <div>
            <span className="font-semibold">Created:</span> {fmtDateTimeFull(objReimbursement.created_at)}
          </div>
          {/* {objReimbursement.description && (
            <div>
              <span className="font-semibold">Description:</span> {objReimbursement.description}
            </div>
          )} */}
        </div>
      </div>

      {/* Business Trip Meta */}
      {objReimbursement.business_trip_meta && (
        <div className="p-3 border-b border-gray-200 bg-blue-50 text-sm text-gray-700">
          <span className="font-semibold">Trip Duration:</span>{' '}
          {fmtDate(objReimbursement.business_trip_meta.from_date)} →{' '}
          {fmtDate(objReimbursement.business_trip_meta.to_date)}
        </div>
      )}

      {/* Items Table */}
      <div className="flex-1 overflow-auto custom-scrollbar">
        <table className="w-full text-sm border-collapse">
          <thead className="sticky top-0 bg-gray-100 z-10">
            <tr className="text-xs font-bold text-gray-700 uppercase">
              <th className="px-3 py-3 text-center border-l border-r border-b border-gray-300">#</th>
              <th className="px-3 py-3 text-center border-r border-b border-gray-300">Category</th>
              <th className="px-3 py-3 text-center border-r border-b border-gray-300">Sub Category</th>
              <th className="px-3 py-3 text-center border-r border-b border-gray-300">Description</th>
              <th className="px-3 py-3 text-center border-r border-b border-gray-300">Expense Date</th>
              <th className="px-3 py-3 text-center border-r border-b border-gray-300">Attachments</th>
              <th className="px-3 py-3 text-right border-r border-b border-gray-300">Amount</th>
            </tr>
          </thead>
          <tbody>
            {objReimbursement.items.map((item, idx) => (
              <tr key={idx} className="hover:bg-gray-50 transition-colors">
                <td className="px-3 py-3 text-center border-l border-r border-b border-gray-200 font-semibold text-gray-600">
                  {idx + 1}
                </td>
                <td className="px-3 py-3 text-center border-r border-b border-gray-200 font-medium text-gray-800">
                  {item.category_name || item.category_id}
                </td>
                <td className="px-3 py-3 text-center border-r border-b border-gray-200 text-gray-600">
                  {item.sub_category || '—'}
                </td>
                <td className="px-3 py-3 text-center border-r border-b border-gray-200 text-gray-600">
                  {item.description || '—'}
                </td>
                <td className="px-3 py-3 text-center border-r border-b border-gray-200 text-gray-600">
                  {fmtDate(item.expense_date)}
                </td>
                <td className="px-3 py-3 text-center border-r border-b border-gray-200">
                  <span className="inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded-full font-semibold">
                    {item.attachments.length} file{item.attachments.length !== 1 ? 's' : ''}
                  </span>
                </td>
                <td className="px-3 py-3 text-right border-r border-b border-gray-200 font-bold text-gray-900 tabular-nums">
                  {fmtAmt(item.amount)}
                </td>
              </tr>
            ))}
            {/* Total Row */}
            <tr className="bg-green-50 font-bold sticky bottom-0">
              <td colSpan={6} className="px-3 py-3 text-right border-l border-r border-t border-b border-gray-300 text-gray-900">
                Total:
              </td>
              <td className="px-3 py-3 text-right border-r border-t border-b border-gray-300 text-lg text-[#00703C] tabular-nums">
                {fmtAmt(fTotal)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      {/* Action Section - Bottom of left panel */}
      {lsAvailableActions.length > 0 && (
        <div className="border-t-2 border-gray-200 bg-gray-50 p-4">
          <h4 className="text-sm font-bold text-gray-900 mb-3">Take Action</h4>
          
          {/* Action Dropdown */}
          <div className="mb-3">
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Select Action
            </label>
            <select
              value={strSelectedAction}
              onChange={(e) => setStrSelectedAction(e.target.value as ActionType | '')}
              className="w-full h-10 border border-gray-300 rounded-md px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#00703C] focus:border-transparent"
            >
              <option value="" className='pointer-cursor'>Choose an action...</option>
              {lsAvailableActions.map((action) => (
                <option key={action} value={action} className='pointer-cursor'>
                  {ACTION_META[action].label}
                </option>
              ))}
            </select>
          </div>

          {/* Payment Fields (for Pay action) */}
          {strSelectedAction === 'pay' && (
            <>
              <div className="mb-3">
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Transaction Reference <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  value={strTxRef}
                  onChange={(e) => setStrTxRef(e.target.value)}
                  placeholder="Enter transaction ID"
                  className="w-full h-10 border border-gray-300 rounded-md px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#00703C]"
                />
              </div>
              <div className="mb-3">
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Payment Method
                </label>
                <select
                  value={strPayMethod}
                  onChange={(e) => setStrPayMethod(e.target.value)}
                  className="w-full h-10 border border-gray-300 rounded-md px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#00703C]"
                >
                  <option value="UPI">UPI</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="Cheque">Cheque</option>
                  <option value="Cash">Cash</option>
                </select>
              </div>
              {/* Proof of payment upload */}
              <div className="mb-3 bg-blue-50 border border-blue-200 rounded-lg p-3">
                <label className="block text-xs font-medium text-gray-700 mb-2">Proof of Payment (optional)</label>
                {strProofFileName ? (
                  <div className="flex items-center justify-between bg-white border border-green-200 rounded px-3 py-2 mb-2">
                    <span className="text-sm text-green-700 font-medium truncate">{strProofFileName}</span>
                    <button
                      onClick={() => { setStrProofFileName(''); setStrProofAttachmentId(''); }}
                      className="text-red-500 hover:text-red-700 cursor-pointer"
                    >
                      Remove
                    </button>
                  </div>
                ) : null}
                <label className="flex items-center gap-2 px-3 py-2 text-sm font-medium border-2 border-dashed border-blue-300 rounded cursor-pointer hover:bg-blue-50">
                  <span className="text-blue-600">{bIsUploadingProof ? 'Uploading...' : 'Choose Image or PDF'}</span>
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    disabled={bIsUploadingProof || bIsSubmitting}
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const allowed = ['image/jpeg','image/png','image/gif','application/pdf'];
                      if (!allowed.includes(file.type)) {
                        setStrError('Only JPG, PNG, GIF, and PDF files are allowed');
                        return;
                      }
                      if (file.size > 10 * 1024 * 1024) {
                        setStrError('File size must be less than 10MB');
                        return;
                      }
                      setStrError('');
                      setBIsUploadingProof(true);
                      try {
                        const resp = await uploadAttachmentApi(file);
                        setStrProofAttachmentId(resp.attachment_id);
                        setStrProofFileName(file.name);
                      } catch (err: any) {
                        setStrError(err?.response?.data?.detail || 'Failed to upload proof file');
                      } finally {
                        setBIsUploadingProof(false);
                      }
                    }}
                    className="hidden"
                  />
                </label>
                <p className="text-xs text-gray-500 mt-2">JPG, PNG, GIF, or PDF (max 10MB)</p>
              </div>
            </>
          )}

          {/* Message/Description Field */}
          {strSelectedAction && (ACTION_META[strSelectedAction as ActionType]?.needsMessage || strSelectedAction === 'pay') && (
            <div className="mb-3">
              <label className="block text-xs font-medium text-gray-700 mb-1">
                {strSelectedAction === 'pay' ? 'Note (optional)' : 'Message'} 
                {ACTION_META[strSelectedAction as ActionType]?.needsMessage && <span className="text-red-600"> *</span>}
              </label>
              <textarea
                value={strMessage}
                onChange={(e) => setStrMessage(e.target.value)}
                rows={3}
                placeholder={strSelectedAction === 'pay' ? 'Additional notes...' : 'Enter your message...'}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00703C] focus:border-transparent resize-none"
              />
            </div>
          )}

          {/* Error Message */}
          {strError && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-md px-3 py-2 mb-3 text-xs">
              {strError}
            </div>
          )}
          {/* Submit Button */}
          {strSelectedAction && (
            <button
              onClick={handleAction}
              disabled={bIsSubmitting}
              className="w-full h-10 bg-[#00703C] text-white rounded-md text-sm font-semibold hover:bg-[#005a30] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {bIsSubmitting ? 'Processing...' : `Confirm ${ACTION_META[strSelectedAction as ActionType]?.label}`}
            </button>
          )}
        </div>
      )}
      
      {/* Confirmation Modal */}
      {objConfirmModal.bIsOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-3 sm:p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden">
            {/* Header */}
            <div className={`bg-gradient-to-r ${objConfirmModal.strType === 'delete' ? 'from-red-50 to-orange-50 border-red-100' : 'from-orange-50 to-red-50 border-red-100'} border-b px-6 py-4 flex items-center gap-3`}>
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                </svg>
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900">
                  {objConfirmModal.strType === 'delete' ? 'Delete Draft?' : 'Reject Reimbursement?'}
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">This action cannot be undone</p>
              </div>
            </div>
            {/* Body */}
            <div className="px-6 py-4">
              <p className="text-sm text-gray-600">
                {objConfirmModal.strType === 'delete' 
                  ? 'This draft reimbursement will be permanently deleted and cannot be recovered.'
                  : 'This reimbursement will be rejected. The initiator will be notified and can reapply.'}
              </p>
            </div>
            {/* Footer */}
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex gap-3 justify-end">
              <button
                onClick={() => setObjConfirmModal({ bIsOpen: false, strType: null })}
                disabled={bIsSubmitting}
                className="px-4 py-2 rounded-xl border border-gray-300 bg-white text-sm font-semibold text-gray-700 hover:bg-gray-100 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmAction}
                disabled={bIsSubmitting}
                className="px-4 py-2 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {bIsSubmitting ? 'Processing...' : (objConfirmModal.strType === 'delete' ? 'Delete Draft' : 'Reject')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
