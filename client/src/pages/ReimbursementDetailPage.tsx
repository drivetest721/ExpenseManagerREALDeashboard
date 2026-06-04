/**
 * ReimbursementDetailPage — Full detail view in 3-panel layout
 * (re-uses ReimbursementShell structure from NewReimbursementPage).
 *
 * Left   : Reimbursement details table
 * Center : Attachment viewer
 * Right  : Activity logs timeline
 */
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FileText } from 'lucide-react';
import ReimbursementShell from '../components/Reimbursement/shared/ReimbursementShell';
import ReimbursementDetailsPanel from '../components/Reimbursement/ReimbursementDetailsPanel';
import ActivityLogsPanel from '../components/Reimbursement/ActivityLogsPanel';
import { useInvoicePreview } from '../components/Reimbursement/shared/useInvoicePreview';
import { getReimbursementDetailApi, getReimbursementChainApi } from '../utils/reimbursementApi';
import type { Reimbursement } from '../types/reimbursement';
import type { ChainViewResponse } from '../utils/reimbursementApi';

export default function ReimbursementDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [objReimbursement, setObjReimbursement] = useState<Reimbursement | null>(null);
  const [objChain, setObjChain] = useState<ChainViewResponse | null>(null);
  const [bLoading, setBLoading] = useState(true);
  const [strError, setStrError] = useState('');

  const preview = useInvoicePreview(setStrError);

  useEffect(() => {
    if (!id) {
      setStrError('No reimbursement ID provided');
      setBLoading(false);
      return;
    }
    fetchDetail();
  }, [id]);

  async function fetchDetail() {
    if (!id) return;
    setBLoading(true);
    setStrError('');
    try {
      const [objReimb, objChainData] = await Promise.all([
        getReimbursementDetailApi(id),
        getReimbursementChainApi(id),
      ]);
      setObjReimbursement(objReimb);
      setObjChain(objChainData);

      // Build attachment list from items
      const lsAllAttachments: string[] = [];
      for (const item of objReimb.items) {
        for (const attId of item.attachments) {
          lsAllAttachments.push(attId);
        }
      }
      preview.rebuildFromIds(lsAllAttachments);
    } catch (objErr: any) {
      setStrError(objErr.response?.data?.detail || 'Failed to load reimbursement details');
    } finally {
      setBLoading(false);
    }
  }

  const handleCancel = () => {
    navigate('/expense');
  };

  // While loading or error
  if (bLoading || !objReimbursement || !objChain) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-6 max-w-md w-full">
          {bLoading && (
            <div className="text-center">
              <div className="inline-block w-8 h-8 border-4 border-[#00703C] border-t-transparent rounded-full animate-spin mb-3" />
              <p className="text-gray-600">Loading reimbursement details...</p>
            </div>
          )}
          {strError && (
            <div>
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-md px-4 py-3 mb-4">
                {strError}
              </div>
              <button
                onClick={handleCancel}
                className="w-full px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-md transition-colors"
              >
                Go Back
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <ReimbursementShell
      icon={<FileText className="w-5 h-5" />}
      title={`Reimbursement Detail · ${objReimbursement.reimbursement_code || objReimbursement.reimbursement_id.slice(-8)}`}
      subtitle={`${objReimbursement.form_type.replace(/_/g, ' ')} · ${objReimbursement.status.replace(/_/g, ' ')}`}
      onCancel={handleCancel}
      strError={strError}
      onClearError={() => setStrError('')}
      leftPanel={<ReimbursementDetailsPanel 
        objReimbursement={objReimbursement} 
        strCurrentReviewerId={objChain.current_reviewer_id}
        onActionSuccess={fetchDetail}
      />}
      lsAllAttachments={preview.lsAllAttachments}
      iPreviewIdx={preview.iPreviewIdx}
      setIPreviewIdx={preview.setIPreviewIdx}
      objPreviewMeta={preview.objPreviewMeta}
      strPreviewUrl={preview.strPreviewUrl}
      bScanning={preview.bScanning}
      lsPaymentMethods={[]} // Not applicable for detail view
      strSelectedPaymentMethod=""
      onSelectPaymentMethod={() => {}}
      // Override right panel with ActivityLogsPanel
      rightPanelOverride={
        <ActivityLogsPanel
          lsChain={objChain.approval_chain}
          iCurrentStep={objChain.current_step}
          lsLogs={objChain.logs}
          strInitiatorName={objReimbursement.initiator_name}
          strStatus={objReimbursement.status}
          strReimbursementId={objReimbursement.reimbursement_id}
        />
      }
    />
  );
}
