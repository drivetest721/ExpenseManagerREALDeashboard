/**
 * ReimbursementDetailModal — full detail view with chain, items, and actions.
 */
import { useEffect, useState } from 'react';
import { X, Paperclip, ExternalLink, Receipt } from 'lucide-react';
import { getReimbursementDetailApi, getReimbursementChainApi } from '../../utils/reimbursementApi';
import type { ChainViewResponse } from '../../utils/reimbursementApi';
import type { Reimbursement } from '../../types/reimbursement';
import AttachmentViewerModal from './AttachmentViewerModal';
import { useAuth } from '../../hooks/useAuth';
import QueryAskDialog from './QueryAskDialog';
import CAPayDialog from './CAPayDialog';
import PaymentDetailsModal from './PaymentDetailsModal';

interface ReimbursementDetailModalProps {
  strReimbursementId: string;
  onClose: () => void;
  onDeleted?: () => void;
  onChainUpdate?: (objChain: ChainViewResponse) => void;
}

export default function ReimbursementDetailModal({
  strReimbursementId,
  onClose,
  onDeleted,
  onChainUpdate,
}: ReimbursementDetailModalProps) {
  const { objUser } = useAuth();
  const [objReimbursement, setObjReimbursement] = useState<Reimbursement | null>(null);
  const [objChain, setObjChain] = useState<ChainViewResponse | null>(null);
  const [bIsLoading, setBIsLoading] = useState<boolean>(true);
  const [strError, setStrError] = useState<string>('');
  const [bShowAction, setBShowAction] = useState<boolean>(false);
  const [bShowPay, setBShowPay] = useState<boolean>(false);
  const [bShowPaymentDetails, setBShowPaymentDetails] = useState<boolean>(false);
  const [lsViewerIds, setLsViewerIds] = useState<string[] | null>(null);
  const [iViewerIndex, setIViewerIndex] = useState<number>(0);

  useEffect(() => {
    fetchDetail();

  }, [strReimbursementId]);

  async function fetchDetail() {
    setBIsLoading(true);
    setStrError('');
    try {
      const [objReimb, objChainData] = await Promise.all([
        getReimbursementDetailApi(strReimbursementId),
        getReimbursementChainApi(strReimbursementId),
      ]);
      setObjReimbursement(objReimb);
      setObjChain(objChainData);
      if (onChainUpdate) onChainUpdate(objChainData);
      if (onChainUpdate) onChainUpdate(objChainData);
    } catch (objErr: any) {
      setStrError(objErr.response?.data?.detail || 'Failed to load reimbursement details');
    } finally {
      setBIsLoading(false);
    }
  }

  if (!objReimbursement || !objChain) {
    return (
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-3 sm:p-4">
        <div className="bg-white rounded-lg p-4 sm:p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
          {bIsLoading && <p className="text-gray-600 cursor-default">Loading...</p>}
          {strError && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded p-3 cursor-default">
              {strError}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-3 sm:p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto custom-scrollbar p-4 sm:p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4 pb-4 border-b border-gray-200">
          <div>
            <h3 className="text-lg sm:text-xl font-semibold text-gray-900">Reimbursement Details</h3>
            {objReimbursement.reimbursement_code && (
              <span className="inline-block mt-1 text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-[#00703C]/10 text-[#00703C]">
                {objReimbursement.reimbursement_code}
              </span>
            )}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 cursor-pointer">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Basic Info */}
        <div className="mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 text-sm">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">Initiator</p>
              <p className="font-semibold text-gray-900 mt-0.5">{objReimbursement.initiator_name}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">Status</p>
              <p className="font-semibold text-gray-900 mt-0.5 capitalize">
                {objReimbursement.status.replace(/_/g, ' ')}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">Type</p>
              <p className="font-semibold text-gray-900 mt-0.5">
                {objReimbursement.form_type === 'business_trip' ? 'Business Trip' : 'General'}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">Created</p>
              <p className="font-semibold text-gray-900 mt-0.5">
                {new Date(objReimbursement.created_at).toLocaleString()}
              </p>
            </div>
          </div>
        </div>

        {/* Expense Items */}
        <div className="mb-6">
          <h4 className="text-sm font-semibold text-gray-900 mb-3 cursor-default">Expense Items</h4>
          <div className="border border-gray-200 rounded-lg overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-center font-semibold text-gray-600 text-xs uppercase tracking-wide border-l border-r border-gray-200">Category</th>
                  <th className="px-3 py-2 text-center font-semibold text-gray-600 text-xs uppercase tracking-wide border-r border-gray-200">Sub-category</th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-600 text-xs uppercase tracking-wide border-r border-gray-200">Amount</th>
                  <th className="px-3 py-2 text-center font-semibold text-gray-600 text-xs uppercase tracking-wide border-r border-gray-200">Date</th>
                  <th className="px-3 py-2 text-center font-semibold text-gray-600 text-xs uppercase tracking-wide border-r border-gray-200">Description</th>
                  <th className="px-3 py-2 text-center font-semibold text-gray-600 text-xs uppercase tracking-wide border-r border-gray-200">Invoices</th>
                </tr>
              </thead>
              <tbody>
                {objReimbursement.items.map((objItem, iIdx) => (
                  <tr key={iIdx} className="hover:bg-gray-50 transition-colors">
                    <td className="px-3 py-2.5 text-center text-gray-900 font-medium border-l border-r border-gray-200">
                      {objItem.category_name || objItem.category_id}
                    </td>
                    <td className="px-3 py-2.5 text-center text-gray-600 border-r border-gray-200">{objItem.sub_category || '—'}</td>
                    <td className="px-3 py-2.5 text-right text-gray-900 font-semibold border-r border-gray-200">
                      {'\u20b9'}{objItem.amount.toLocaleString()}
                    </td>
                    <td className="px-3 py-2.5 text-center text-gray-600 whitespace-nowrap border-r border-gray-200">{objItem.expense_date}</td>
                    <td className="px-3 py-2.5 text-center text-gray-600 border-r border-gray-200">{objItem.description || '—'}</td>
                    <td className="px-3 py-2.5 text-center border-r border-gray-200">
                      {objItem.attachments.length === 0 ? (
                        <span className="text-gray-300 text-xs">—</span>
                      ) : (
                        <div className="flex flex-col gap-1">
                          {objItem.attachments.map((_strAttId, iJ) => (
                            <button
                              key={iJ}
                              onClick={() => { setLsViewerIds(objItem.attachments); setIViewerIndex(iJ); }}
                              className="inline-flex items-center gap-1 text-xs text-[#00703C] hover:text-[#005a30] hover:underline cursor-pointer transition-colors"
                            >
                              <Paperclip className="w-3 h-3 flex-shrink-0" />
                              <span>Invoice {iJ + 1}</span>
                              <ExternalLink className="w-3 h-3 flex-shrink-0" />
                            </button>
                          ))}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-6 flex justify-end gap-2 flex-wrap">
          {objUser && (() => {
            const bIsInitiator = objUser.user_id === objReimbursement.initiator_id;
            const bIsReviewer = objUser.user_id === objChain.current_reviewer_id;
            const bIsCA = (objUser.departments || []).some((d) => d.role === 'ca');
            const bIsOwner = (objUser.departments || []).some((d) => d.role === 'owner');
            const bCanPay =  bIsCA &&
              ['OWNER_APPROVED', 'CA_PENDING', 'CA_REAPPLIED'].includes(objReimbursement.status);
            const bCanViewPaymentDetails = (bIsInitiator || bIsOwner || bIsCA) && objReimbursement.payment_proof;
            console.log(objReimbursement);
            return (
              <>
                {bCanPay && (
                  <button
                    onClick={() => setBShowPay(true)}
                    className="px-4 py-2 bg-green-700 text-white rounded hover:bg-green-800 text-sm"
                  >
                    Mark as Paid
                  </button>
                )}
                {bCanViewPaymentDetails && (
                  <button
                    onClick={() => setBShowPaymentDetails(true)}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm flex items-center gap-2"
                  >
                    <Receipt className="w-4 h-4" />
                    Show Payment Details
                  </button>
                )}
                {(bIsInitiator || bIsReviewer) && (
                  <button
                    onClick={() => setBShowAction(true)}
                    className="px-4 py-2 bg-[#00703C] text-white rounded hover:bg-[#005a30] text-sm"
                  >
                    Take Action
                  </button>
                )}
              </>
            );
          })()}
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
          >
            Close
          </button>
        </div>
      </div>

      {/* QueryAsk Dialog */}
      {bShowAction && objUser && (
        <QueryAskDialog
          strReimbursementId={strReimbursementId}
          strStatus={objReimbursement.status}
          bIsInitiator={objUser.user_id === objReimbursement.initiator_id}
          bIsCurrentReviewer={objUser.user_id === objChain.current_reviewer_id}
          bIsCA={(objUser.departments || []).some((d) => d.role === 'ca')}
          onSuccess={fetchDetail}
          onClose={() => setBShowAction(false)}
          onDeleted={() => { if (onDeleted) onDeleted(); onClose(); }}
        />
      )}

      {/* CA Pay Dialog */}
      {bShowPay && (
        <CAPayDialog
          strReimbursementId={strReimbursementId}
          onSuccess={fetchDetail}
          onClose={() => setBShowPay(false)}
        />
      )}

      {/* Payment Details Modal */}
      {bShowPaymentDetails && objReimbursement && (
        <PaymentDetailsModal
          objReimbursement={objReimbursement}
          onClose={() => setBShowPaymentDetails(false)}
        />
      )}

      {/* Attachment Viewer */}
      {lsViewerIds && (
        <AttachmentViewerModal
          lsAttachmentIds={lsViewerIds}
          iInitialIndex={iViewerIndex}
          onClose={() => setLsViewerIds(null)}
        />
      )}
    </div>
  );
}