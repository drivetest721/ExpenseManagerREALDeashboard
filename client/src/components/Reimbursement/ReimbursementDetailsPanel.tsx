/**
 * ReimbursementDetailsPanel — Left panel for detail view showing reimbursement
 * items as a perfectly aligned table with lines between columns and rows.
 * Includes action dropdown at bottom for reviewers.
 */
import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Reimbursement } from '../../types/reimbursement';
import {
  approveReimbursementApi,
  queryReimbursementApi,
  askReimbursementApi,
  reapplyReimbursementApi,
  caQueryReimbursementApi,
  caReapplyReimbursementApi,
  acknowledgePaymentApi,
  rejectReimbursementApi,
  payReimbursementApi,
} from '../../utils/approvalApi';
import { submitReimbursementApi, deleteReimbursementApi } from '../../utils/reimbursementApi';
import { useAuth } from '../../hooks/useAuth';

interface Props {
  objReimbursement: Reimbursement;
  strCurrentReviewerId?: string;
  onActionSuccess?: () => void;
}

type ActionType =
  | 'submit'
  | 'delete'
  | 'approve'
  | 'query'
  | 'ask'
  | 'reapply'
  | 'ca_query'
  | 'ca_reapply'
  | 'acknowledge'
  | 'reject'
  | 'pay';

const ACTION_META: Record<ActionType, { label: string; needsMessage: boolean; needsPayment?: boolean }> = {
  submit:      { label: 'Submit for Approval', needsMessage: false },
  delete:      { label: 'Delete Draft', needsMessage: false },
  approve:     { label: 'Approve', needsMessage: false },
  query:       { label: 'Query (Public)', needsMessage: true },
  ask:         { label: 'Ask (Private)', needsMessage: true },
  reapply:     { label: 'Reapply', needsMessage: true },
  ca_query:    { label: 'CA Query', needsMessage: true },
  ca_reapply:  { label: 'Respond to CA', needsMessage: true },
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

  // Determine user permissions
  const bIsInitiator = objUser?.user_id === objReimbursement.initiator_id;
  const bIsCA = (objUser?.departments || []).some((d) => d.role === 'ca');
  const bIsCurrentReviewer = objUser?.user_id === strCurrentReviewerId;

  // Check if reimbursement can be edited (initiator only, specific statuses)
  const bCanEdit = bIsInitiator && ['DRAFT', 'QUERY_RAISED', 'PRIVATE_ASK', 'CA_QUERY'].includes(objReimbursement.status);

  // Determine available actions
  const lsAvailableActions = useMemo<ActionType[]>(() => {
    const lsActions: ActionType[] = [];
    const strStatus = objReimbursement.status;

    if (bIsInitiator && strStatus === 'DRAFT') {
      lsActions.push('submit', 'delete');
    }
    if (bIsCurrentReviewer && !bIsCA && ['SUBMITTED', 'IN_REVIEW', 'REAPPLIED'].includes(strStatus)) {
      lsActions.push('approve', 'query', 'ask');
    }
    if (bIsCurrentReviewer && bIsCA && ['OWNER_APPROVED', 'CA_PENDING', 'CA_REAPPLIED'].includes(strStatus)) {
      lsActions.push('pay', 'ca_query', 'ask', 'reject');
    }
    if (bIsInitiator && ['QUERY_RAISED', 'PRIVATE_ASK'].includes(strStatus)) {
      lsActions.push('reapply');
    }
    if (bIsInitiator && strStatus === 'CA_QUERY') {
      lsActions.push('ca_reapply');
    }
    if (bIsInitiator && strStatus === 'PAID') {
      lsActions.push('acknowledge');
    }
    return lsActions;
  }, [objReimbursement.status, bIsInitiator, bIsCurrentReviewer, bIsCA]);

  const fmtDate = (str: string) => {
    if (!str) return '—';
    const d = new Date(str);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const fmtAmt = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

  const STATUS_COLORS: Record<string, string> = {
    DRAFT: 'bg-gray-100 text-gray-700',
    SUBMITTED: 'bg-blue-100 text-blue-700',
    IN_REVIEW: 'bg-yellow-100 text-yellow-700',
    QUERY_RAISED: 'bg-orange-100 text-orange-700',
    PRIVATE_ASK: 'bg-orange-100 text-orange-700',
    REAPPLIED: 'bg-blue-100 text-blue-700',
    OWNER_APPROVED: 'bg-green-100 text-green-700',
    CA_PENDING: 'bg-purple-100 text-purple-700',
    CA_QUERY: 'bg-orange-100 text-orange-700',
    CA_REAPPLIED: 'bg-blue-100 text-blue-700',
    PAID: 'bg-emerald-100 text-emerald-700',
    PAYMENT_ACKNOWLEDGED: 'bg-teal-100 text-teal-700',
    REJECTED: 'bg-red-100 text-red-700',
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
    if (strSelectedAction === 'delete' && !window.confirm('Delete this draft? This cannot be undone.')) {
      return;
    }
    if (strSelectedAction === 'reject' && !window.confirm('Are you sure you want to reject this reimbursement?')) {
      return;
    }
    
    setBIsSubmitting(true);
    setStrError('');
    
    try {
      const objMap: Record<ActionType, () => Promise<any>> = {
        submit:      () => submitReimbursementApi(objReimbursement.reimbursement_id),
        delete:      () => deleteReimbursementApi(objReimbursement.reimbursement_id),
        approve:     () => approveReimbursementApi(objReimbursement.reimbursement_id),
        query:       () => queryReimbursementApi(objReimbursement.reimbursement_id, strMessage),
        ask:         () => askReimbursementApi(objReimbursement.reimbursement_id, strMessage),
        reapply:     () => reapplyReimbursementApi(objReimbursement.reimbursement_id, strMessage),
        ca_query:    () => caQueryReimbursementApi(objReimbursement.reimbursement_id, strMessage),
        ca_reapply:  () => caReapplyReimbursementApi(objReimbursement.reimbursement_id, strMessage),
        acknowledge: () => acknowledgePaymentApi(objReimbursement.reimbursement_id, strMessage || undefined),
        reject:      () => rejectReimbursementApi(objReimbursement.reimbursement_id, strMessage),
        pay:         () => payReimbursementApi(objReimbursement.reimbursement_id, {
          transaction_ref: strTxRef,
          payment_method: strPayMethod || undefined,
          note: strMessage || undefined,
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
            <span className="font-semibold">Created:</span> {fmtDate(objReimbursement.created_at)}
          </div>
          {objReimbursement.description && (
            <div>
              <span className="font-semibold">Description:</span> {objReimbursement.description}
            </div>
          )}
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
              <td colSpan={5} className="px-3 py-3 text-right border-l border-r border-t border-b border-gray-300 text-gray-900">
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
              <option value="">Choose an action...</option>
              {lsAvailableActions.map((action) => (
                <option key={action} value={action}>
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
    </div>
  );
}
