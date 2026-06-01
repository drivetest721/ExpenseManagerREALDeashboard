/**
 * ReimbursementShell — Page skeleton for both General Expense and Business Trip.
 * Provides: branded header (with cancel), error toast, optional pre-step slot,
 * resizable 3-pane layout (left/center/right) + bottom action footer.
 *
 * Consumer supplies:
 *   - title + icon
 *   - optional preStep (e.g. business trip date range)
 *   - leftPanel content (the expense entry UI)
 *   - lsAllAttachments / preview state (so center panel works)
 *   - lsPaymentMethods + selection
 *   - save / submit / cancel handlers
 */
import type { ReactNode } from 'react';
import { X, ChevronsLeft, ChevronsRight } from 'lucide-react';
import ErrorToast from './ErrorToast';
import InvoicePreviewPanel from './InvoicePreviewPanel';
import RightSidebar from './RightSidebar';
import ReimbursementFooter from './ReimbursementFooter';
import { useResizablePanels } from './useResizablePanels';
import type { AttachmentMeta } from '../../../utils/attachmentApi';
import type { PaymentMethod } from '../../../types/paymentMethod';

interface Props {
  // Header
  icon: ReactNode;
  title: string;
  subtitle?: string;
  onCancel: () => void;

  // Errors
  strError: string;
  onClearError: () => void;

  // Optional row above the 3-pane area (e.g. business trip date range)
  preStep?: ReactNode;

  // Left panel content (caller's expense entry UI)
  leftPanel: ReactNode;

  // Center: invoice preview
  lsAllAttachments: string[];
  iPreviewIdx: number;
  setIPreviewIdx: (i: number) => void;
  objPreviewMeta: AttachmentMeta | null;
  strPreviewUrl: string;
  bScanning: boolean;

  // Right: payment method
  lsPaymentMethods: PaymentMethod[];
  strSelectedPaymentMethod: string;
  onSelectPaymentMethod: (id: string) => void;

  // Footer
  bIsSaving: boolean;
  onSaveDraft: () => void;
  onSubmit: () => void;
}

export default function ReimbursementShell(props: Props) {
  const {
    icon, title, subtitle, onCancel,
    strError, onClearError,
    preStep,
    leftPanel,
    lsAllAttachments, iPreviewIdx, setIPreviewIdx, objPreviewMeta, strPreviewUrl, bScanning,
    lsPaymentMethods, strSelectedPaymentMethod, onSelectPaymentMethod,
    bIsSaving, onSaveDraft, onSubmit,
  } = props;

  const {
    refContainer,
    bResizing,
    bLeftCollapsed,
    bRightCollapsed,
    toggleLeftCollapse,
    toggleRightCollapse,
    handleMouseDown,
    getActualLeftWidth,
    getActualCenterWidth,
    getActualRightWidth,
  } = useResizablePanels();

  return (
    <div className="h-screen bg-gradient-to-br from-gray-50 via-gray-100 to-blue-50 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#00703C] to-[#005a30] border-b-4 border-[#00703C]/20 px-6 py-3 flex justify-between items-center flex-shrink-0 shadow-lg">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            {icon}
            <span>{title}</span>
          </h1>
          {subtitle && <p className="text-sm text-white/80 mt-1.5 ml-12">{subtitle}</p>}
        </div>
        <button
          onClick={onCancel}
          className="w-11 h-11 rounded-full flex items-center justify-center bg-white/10 hover:bg-white/20 text-white hover:scale-110 transition-all"
          title="Cancel"
        >
          <X className="w-6 h-6" />
        </button>
      </div>

      <ErrorToast message={strError} onClose={onClearError} />

      {preStep}

      {/* Main 3-Section Layout */}
      <div
        ref={refContainer}
        className="flex-1 flex gap-0 overflow-hidden relative"
        style={{ userSelect: bResizing ? 'none' : 'auto' }}
      >
        {/* LEFT */}
        {!bLeftCollapsed && (
          <div
            className="bg-white border-2 border-r-0 border-gray-300 shadow-lg p-5 flex flex-col overflow-hidden transition-all duration-500 relative"
            style={{ width: `${getActualLeftWidth()}%`, minWidth: '350px' }}
          >
            <button
              onClick={toggleLeftCollapse}
              className="absolute top-2 right-2 z-20 p-1.5 bg-[#00703C] hover:bg-[#005a30] text-white rounded-lg shadow-md transition-all hover:scale-110 cursor-pointer"
              title="Collapse expense panel"
            >
              <ChevronsLeft className="w-4 h-4" />
            </button>
            {leftPanel}
          </div>
        )}

        {bLeftCollapsed && (
          <button
            onClick={toggleLeftCollapse}
            className="flex-shrink-0 w-10 bg-[#00703C] hover:bg-[#005a30] text-white flex items-center justify-center transition-all duration-300 hover:w-12 shadow-lg rounded-l-xl cursor-pointer"
            title="Expand expense panel"
          >
            <ChevronsRight className="w-5 h-5" />
          </button>
        )}

        {/* LEFT DIVIDER */}
        {!bLeftCollapsed && (
          <div
            onMouseDown={handleMouseDown('left')}
            className={`w-1.5 cursor-col-resize hover:bg-[#00703C] transition-colors flex-shrink-0 relative group ${
              bResizing === 'left' ? 'bg-[#00703C]' : 'bg-gray-300'
            }`}
          >
            <div className="absolute inset-y-1/2 -translate-y-1/2 left-1/2 -translate-x-1/2 w-1 h-12 bg-gray-400 rounded-full group-hover:bg-white transition-colors"></div>
          </div>
        )}

        {/* CENTER: Invoice Preview */}
        <div
          className="bg-white border-y-2 border-gray-300 shadow-lg p-5 flex flex-col overflow-hidden transition-all duration-500"
          style={{ width: `${getActualCenterWidth()}%`, minWidth: '250px' }}
        >
          <InvoicePreviewPanel
            lsAllAttachments={lsAllAttachments}
            iPreviewIdx={iPreviewIdx}
            setIPreviewIdx={setIPreviewIdx}
            objPreviewMeta={objPreviewMeta}
            strPreviewUrl={strPreviewUrl}
            bScanning={bScanning}
          />
        </div>

        {/* RIGHT DIVIDER */}
        {!bRightCollapsed && (
          <div
            onMouseDown={handleMouseDown('right')}
            className={`w-1.5 cursor-col-resize hover:bg-[#00703C] transition-colors flex-shrink-0 relative group ${
              bResizing === 'right' ? 'bg-[#00703C]' : 'bg-gray-300'
            }`}
          >
            <div className="absolute inset-y-1/2 -translate-y-1/2 left-1/2 -translate-x-1/2 w-1 h-12 bg-gray-400 rounded-full group-hover:bg-white transition-colors"></div>
          </div>
        )}

        {/* RIGHT */}
        {!bRightCollapsed && (
          <div
            className="bg-white border-2 border-l-0 border-gray-300 shadow-lg p-5 flex flex-col gap-6 overflow-auto custom-scrollbar transition-all duration-500 relative"
            style={{ width: `${getActualRightWidth()}%`, minWidth: '280px' }}
          >
            <button
              onClick={toggleRightCollapse}
              className="absolute top-2 left-2 z-20 p-1.5 bg-[#00703C] hover:bg-[#005a30] text-white rounded-lg shadow-md transition-all hover:scale-110 cursor-pointer"
              title="Collapse approval chain"
            >
              <ChevronsRight className="w-4 h-4" />
            </button>
            <RightSidebar
              lsPaymentMethods={lsPaymentMethods}
              strSelectedPaymentMethod={strSelectedPaymentMethod}
              onSelectPaymentMethod={onSelectPaymentMethod}
            />
          </div>
        )}

        {bRightCollapsed && (
          <button
            onClick={toggleRightCollapse}
            className="flex-shrink-0 w-10 bg-[#00703C] hover:bg-[#005a30] text-white flex items-center justify-center transition-all duration-300 hover:w-12 shadow-lg rounded-r-xl cursor-pointer"
            title="Expand approval chain"
          >
            <ChevronsLeft className="w-5 h-5" />
          </button>
        )}
      </div>

      <ReimbursementFooter
        bIsSaving={bIsSaving}
        onSaveDraft={onSaveDraft}
        onSubmit={onSubmit}
      />
    </div>
  );
}
