/**
 * QueryAskDialog — modal for approve / query / ask / reapply / CA actions.
 * Picks valid actions based on reimbursement status + caller's role.
 */
import { useState, useMemo } from 'react';
import { X } from 'lucide-react';
import {
  approveReimbursementApi,
  queryReimbursementApi,
  askReimbursementApi,
  reapplyReimbursementApi,
  caQueryReimbursementApi,
  caReapplyReimbursementApi,
  acknowledgePaymentApi,
  rejectReimbursementApi,
} from '../../utils/approvalApi';
import { submitReimbursementApi, deleteReimbursementApi } from '../../utils/reimbursementApi';

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
  | 'reject';

interface QueryAskDialogProps {
  strReimbursementId: string;
  strStatus: string;
  bIsInitiator: boolean;
  bIsCurrentReviewer: boolean;
  bIsCA: boolean;
  onSuccess: () => void;
  onClose: () => void;
  onDeleted?: () => void;
}

const ACTION_META: Record<ActionType, { label: string; clsIdle: string; clsActive: string; needsMessage: boolean }> = {
  submit:      { label: 'Submit for Approval', clsIdle: 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200', clsActive: 'bg-emerald-600 text-white', needsMessage: false },
  delete:      { label: 'Delete Draft',         clsIdle: 'bg-red-100 text-red-700 hover:bg-red-200',             clsActive: 'bg-red-600 text-white',     needsMessage: false },
  approve:     { label: 'Approve',       clsIdle: 'bg-green-100 text-green-700 hover:bg-green-200',   clsActive: 'bg-green-600 text-white',  needsMessage: false },
  query:       { label: 'Query',         clsIdle: 'bg-orange-100 text-orange-700 hover:bg-orange-200', clsActive: 'bg-orange-600 text-white', needsMessage: true },
  ask:         { label: 'Private Ask',  clsIdle: 'bg-purple-100 text-purple-700 hover:bg-purple-200', clsActive: 'bg-purple-600 text-white', needsMessage: true },
  reapply:     { label: 'Reapply',       clsIdle: 'bg-blue-100 text-blue-700 hover:bg-blue-200',     clsActive: 'bg-blue-600 text-white',   needsMessage: true },
  ca_query:    { label: 'CA Query',      clsIdle: 'bg-orange-100 text-orange-700 hover:bg-orange-200', clsActive: 'bg-orange-600 text-white', needsMessage: true },
  ca_reapply:  { label: 'Respond to CA', clsIdle: 'bg-blue-100 text-blue-700 hover:bg-blue-200',     clsActive: 'bg-blue-600 text-white',   needsMessage: true },
  acknowledge: { label: 'Acknowledge',   clsIdle: 'bg-green-100 text-green-700 hover:bg-green-200',   clsActive: 'bg-green-600 text-white',  needsMessage: false },
  reject:      { label: 'Reject',        clsIdle: 'bg-red-100 text-red-700 hover:bg-red-200',         clsActive: 'bg-red-600 text-white',    needsMessage: true },
};

export default function QueryAskDialog({
  strReimbursementId,
  strStatus,
  bIsInitiator,
  bIsCurrentReviewer,
  bIsCA,
  onSuccess,
  onClose,
  onDeleted,
}: QueryAskDialogProps) {
  const [strAction, setStrAction] = useState<ActionType | null>(null);
  const [strMessage, setStrMessage] = useState<string>('');
  const [bIsLoading, setBIsLoading] = useState<boolean>(false);
  const [strError, setStrError] = useState<string>('');

  // Determine which actions are available
  const lsAvailable = useMemo<ActionType[]>(() => {
    const lsActions: ActionType[] = [];
    if (bIsInitiator && strStatus === 'DRAFT') {
      lsActions.push('submit', 'delete');
    }
    if (bIsCurrentReviewer && !bIsCA && ['SUBMITTED', 'IN_REVIEW', 'REAPPLIED'].includes(strStatus)) {
      lsActions.push('approve', 'query', 'ask');
    }
    if (bIsCurrentReviewer && bIsCA && ['OWNER_APPROVED', 'CA_PENDING', 'CA_REAPPLIED'].includes(strStatus)) {
      // OWNER_APPROVED = CA is current_reviewer but not yet CA_PENDING (backward-compat).
      // Pay handled by separate dialog; expose CA query + ask + reject here.
      lsActions.push('ca_query', 'ask');
      lsActions.push('reject');
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
  }, [strStatus, bIsInitiator, bIsCurrentReviewer, bIsCA]);

  async function handleSubmit() {
    if (!strAction) return;
    const objMeta = ACTION_META[strAction];
    if (objMeta.needsMessage && !strMessage.trim()) {
      setStrError('Please provide a message');
      return;
    }
    if (strAction === 'delete' && !window.confirm('Delete this draft? This cannot be undone.')) {
      return;
    }
    setBIsLoading(true);
    setStrError('');
    try {
      const objMap: Record<ActionType, () => Promise<any>> = {
        submit:      () => submitReimbursementApi(strReimbursementId),
        delete:      () => deleteReimbursementApi(strReimbursementId),
        approve:     () => approveReimbursementApi(strReimbursementId),
        query:       () => queryReimbursementApi(strReimbursementId, strMessage),
        ask:         () => askReimbursementApi(strReimbursementId, strMessage),
        reapply:     () => reapplyReimbursementApi(strReimbursementId, strMessage),
        ca_query:    () => caQueryReimbursementApi(strReimbursementId, strMessage),
        ca_reapply:  () => caReapplyReimbursementApi(strReimbursementId, strMessage),
        acknowledge: () => acknowledgePaymentApi(strReimbursementId, strMessage || undefined),
        reject:      () => rejectReimbursementApi(strReimbursementId, strMessage),
      };
      await objMap[strAction]();
      if (strAction === 'delete' && onDeleted) {
        onDeleted();
      } else {
        onSuccess();
      }
      onClose();
    } catch (objErr: any) {
      setStrError(objErr.response?.data?.detail || 'Action failed');
    } finally {
      setBIsLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-3 sm:p-4">
      <div className="bg-white rounded-lg p-4 sm:p-6 max-w-md w-full">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Take Action</h3>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-400" /></button>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2 mb-4">
          {lsAvailable.length === 0 && (
            <p className="text-sm text-gray-600 cursor-default">No actions available for this state.</p>
          )}
          {lsAvailable.map((strKey) => {
            const objMeta = ACTION_META[strKey];
            const bSelected = strAction === strKey;
            return (
              <button
                key={strKey}
                onClick={() => setStrAction(strKey)}
                className={`px-3 py-2 rounded text-sm font-medium transition-colors ${
                  bSelected ? objMeta.clsActive : objMeta.clsIdle
                }`}
              >
                {objMeta.label}
              </button>
            );
          })}
        </div>

        {/* Message field */}
        {strAction && ACTION_META[strAction].needsMessage && (
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1 cursor-default">
              Message (required)
            </label>
            <textarea
              value={strMessage}
              onChange={(e) => setStrMessage(e.target.value)}
              rows={3}
              placeholder="Enter your message..."
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
            />

          </div>
        )}

        {strError && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded p-2 mb-4 text-sm cursor-default">
            {strError}
          </div>
        )}

        {strAction && (
          <div className="flex gap-2 justify-end">
            <button onClick={onClose} className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 text-sm">
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={bIsLoading}
              className="px-4 py-2 bg-[#00703C] text-white rounded hover:bg-[#005a30] text-sm disabled:opacity-50"
            >
              {bIsLoading ? 'Processing...' : 'Confirm'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
