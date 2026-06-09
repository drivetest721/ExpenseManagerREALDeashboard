/**
 * NewReimbursementPage — composes the shared ReimbursementShell with the
 * General Expense / Business Trip variants.
 * 
 * Supports both Create and Edit modes:
 *   Create: /expense/new/:formType
 *   Edit:   /expense/edit/:id
 *
 * Business Trip mode:
 *   1. User picks From + To date in the pre-step.
 *   2. Once both dates are set, the left panel switches to BusinessTripMatrix
 *      (dates as columns, categories as rows, amount per cell).
 *   3. Until then, an empty-state prompts for dates.
 *
 * General mode: classic GeneralExpenseTable.
 */
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FileText, Plane, CalendarRange, CalendarDays, CalendarCheck2, ChevronLeft, ChevronRight } from 'lucide-react';
import DateInputDDMMYYYY from '../components/common/DateInputDDMMYYYY';
import ReimbursementShell from '../components/Reimbursement/shared/ReimbursementShell';
import GeneralExpenseTable, {
  createEmptyRow,
  validateExpenseRows,
  rowsToItems,
  type ExpenseRow,
  type ErrorField,
} from '../components/Reimbursement/GeneralExpenseTable';
import BusinessTripMatrix, {
  createEmptyMatrixRow,
  buildDateRange,
  validateMatrixRows,
  matrixToItems,
  matrixAllAttachmentIds,
  type MatrixRow,
  type MatrixErrorField,
} from '../components/Reimbursement/BusinessTripMatrix';
import { useInvoicePreview } from '../components/Reimbursement/shared/useInvoicePreview';
import { useReimbursementSave } from '../components/Reimbursement/shared/useReimbursementSave';
import { listCategoriesApi } from '../utils/categoryApi';
import { listMyPaymentMethodsApi } from '../utils/paymentMethodApi';
import { getReimbursementDetailApi, updateDraftApi } from '../utils/reimbursementApi';
import { reapplyReimbursementApi, caReapplyReimbursementApi } from '../utils/approvalApi';
import type { Category } from '../types/category';
import type { PaymentMethod } from '../types/paymentMethod';
import type { FormType, ReimbursementStatus } from '../types/reimbursement';
import type { FooterMode } from '../components/Reimbursement/shared/ReimbursementFooter';

type RouteFormType = 'general' | 'business-trip';

export default function NewReimbursementPage() {
  const { formType, id } = useParams<{ formType?: RouteFormType; id?: string }>();
  const navigate = useNavigate();
  const bIsEdit = !!id;

  // In edit mode, bIsBusinessTrip is set from the loaded reimbursement (not the URL param).
  // For create mode it comes straight from the URL param.
  const [bIsBusinessTrip, setBIsBusinessTrip] = useState(formType === 'business-trip');
  const strFormTypeEnum: FormType = bIsBusinessTrip ? 'business_trip' : 'general';

  // ── State ──
  const [bIsLoading, setBIsLoading] = useState(bIsEdit);
  const [strReimbStatus, setStrReimbStatus] = useState<ReimbursementStatus>('DRAFT');
  const [strReApplyMessage, setStrReApplyMessage] = useState('');
  const [bIsReApplying, setBIsReApplying] = useState(false);
  const [lsCategories, setLsCategories] = useState<Category[]>([]);
  const [lsRows, setLsRows] = useState<ExpenseRow[]>([]);
  const [lsMatrixRows, setLsMatrixRows] = useState<MatrixRow[]>([
    createEmptyMatrixRow(),
    createEmptyMatrixRow(),
  ]);
  const [lsPaymentMethods, setLsPaymentMethods] = useState<PaymentMethod[]>([]);
  const [strSelectedPaymentMethod, setStrSelectedPaymentMethod] = useState('');
  const [strDescription, setStrDescription] = useState('');
  const [bShowDescription, setBShowDescription] = useState(true);
  const [strTripFrom, setStrTripFrom] = useState('');
  const [strTripTo, setStrTripTo] = useState('');
  const [strError, setStrError] = useState('');
  const [iLeftPageSize, setILeftPageSize] = useState(4);
  const [iLeftPageIdx, setILeftPageIdx] = useState(0);
  const [objErrorField, setObjErrorField] = useState<ErrorField | null>(null);
  const [objMatrixErrorField, setObjMatrixErrorField] = useState<MatrixErrorField | null>(null);

  // Derive footer mode from loaded status
  const strFooterMode: FooterMode =
    (strReimbStatus === 'QUERY_RAISED' || strReimbStatus === 'PRIVATE_ASK') ? 'reapply' :
    strReimbStatus === 'CA_QUERY' ? 'ca-reapply' :
    'normal';

  const preview = useInvoicePreview(setStrError);

  const lsDateRange = bIsBusinessTrip ? buildDateRange(strTripFrom, strTripTo) : [];
  const bShowMatrix = bIsBusinessTrip && lsDateRange.length > 0;
  const iLeftRowCount = bShowMatrix ? lsMatrixRows.length : lsRows.length;
  const iLeftPageCount = Math.max(1, Math.ceil(iLeftRowCount / iLeftPageSize));

  useEffect(() => {
    if (iLeftPageIdx >= iLeftPageCount) {
      setILeftPageIdx(iLeftPageCount - 1);
    }
  }, [iLeftPageCount, iLeftPageIdx]);

  useEffect(() => {
    setILeftPageIdx(0);
  }, [bIsBusinessTrip, bShowMatrix]);

  const handleLeftRowAdded = () => {
    const iNewRows = iLeftRowCount + 1;
    setILeftPageIdx(Math.max(0, Math.ceil(iNewRows / iLeftPageSize) - 1));
  };

  const leftPanelToolbar = (
    <div className="rounded-full border border-gray-200 bg-white/95 backdrop-blur-sm px-2 py-1.5 flex items-center gap-2 shadow-sm">
      <label className="text-[10px] uppercase tracking-[0.12em] text-gray-500">Rows</label>
      <select
        value={iLeftPageSize}
        onChange={e => setILeftPageSize(Number(e.target.value))}
        className="h-8 rounded-lg border border-gray-300 bg-white px-2 text-sm text-gray-700 focus:border-[#00703C] focus:ring-[#00703C]/30"
      >
        {[4, 6, 8, 12].map(size => (
          <option key={size} value={size}>{size}</option>
        ))}
      </select>
      <button
        type="button"
        onClick={() => setILeftPageIdx(i => Math.max(0, i - 1))}
        disabled={iLeftPageIdx === 0}
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-600 disabled:cursor-not-allowed disabled:opacity-40 hover:border-[#00703C] hover:text-[#00703C]"
        title="Previous page"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>
      <div className="text-xs font-semibold text-gray-700">
        {iLeftPageIdx + 1}/{iLeftPageCount}
      </div>
      <button
        type="button"
        onClick={() => setILeftPageIdx(i => Math.min(iLeftPageCount - 1, i + 1))}
        disabled={iLeftPageIdx >= iLeftPageCount - 1}
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-600 disabled:cursor-not-allowed disabled:opacity-40 hover:border-[#00703C] hover:text-[#00703C]"
        title="Next page"
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );

  // ── Auto-dismiss error ──
  useEffect(() => {
    if (!strError) return;
    const t = setTimeout(() => {
      setStrError('');
      setObjErrorField(null);
      setObjMatrixErrorField(null);
    }, 6000);
    return () => clearTimeout(t);
  }, [strError]);

  // ── Initial load ──
  useEffect(() => {
    (async () => {
      try {
        const [lsCats, lsPms] = await Promise.all([listCategoriesApi(), listMyPaymentMethodsApi()]);
        const lsActive = lsCats.filter(c => c.is_active);
        setLsCategories(lsActive);
        setLsPaymentMethods(lsPms);

        const objDefault = lsPms.find(pm => pm.is_default);
        if (objDefault) setStrSelectedPaymentMethod(objDefault.payment_method_id);

        // If in edit mode, fetch and populate existing reimbursement data
        if (bIsEdit && id) {
          try {
            const objReimb = await getReimbursementDetailApi(id);
            setStrDescription(objReimb.description || '');
            setStrReimbStatus(objReimb.status);
            // Derive form type from loaded data (URL may not carry formType for edit route)
            setBIsBusinessTrip(objReimb.form_type === 'business_trip');
            
            // Populate based on form type
            if (objReimb.form_type === 'business_trip' && objReimb.business_trip_meta) {
              setStrTripFrom(objReimb.business_trip_meta.from_date);
              setStrTripTo(objReimb.business_trip_meta.to_date);
              
              // Convert items to matrix rows
              const lsDateRange = buildDateRange(objReimb.business_trip_meta.from_date, objReimb.business_trip_meta.to_date);

              // Group items by category, building a properly-typed MatrixRow map
              const objCategoryMap: Record<string, MatrixRow> = {};
              for (const item of objReimb.items) {
                if (!objCategoryMap[item.category_id]) {
                  const objCells: Record<string, { amount: number; attachments: string[]; _attachmentNames: string[]; useSameInvoice: boolean }> = {};
                  for (const date of lsDateRange) {
                    objCells[date] = { amount: 0, attachments: [], _attachmentNames: [], useSameInvoice: false };
                  }
                  objCategoryMap[item.category_id] = {
                    category_id: item.category_id,
                    sub_category: item.sub_category || '',
                    cells: objCells,
                  };
                }
                const dateKey = item.expense_date;
                if (objCategoryMap[item.category_id].cells[dateKey] !== undefined) {
                  const lsAttIds = item.attachments || [];
                  objCategoryMap[item.category_id].cells[dateKey] = {
                    amount: item.amount,
                    attachments: lsAttIds,
                    // Provide placeholder names so existing chips render and can be removed
                    _attachmentNames: lsAttIds.map((_, j) => `Invoice ${j + 1}`),
                    useSameInvoice: false,
                  };
                }
              }
              setLsMatrixRows(Object.values(objCategoryMap) as MatrixRow[]);
            } else {
              // General expenses - convert items to rows
              const lsRows: ExpenseRow[] = objReimb.items.map(item => {
                const lsAttIds = item.attachments || [];
                return {
                  category_id: item.category_id,
                  sub_category: item.sub_category || '',
                  amount: item.amount,
                  expense_date: item.expense_date,
                  description: item.description || '',
                  attachments: lsAttIds,
                  // Provide placeholder names so existing chips render and can be removed
                  _attachmentNames: lsAttIds.map((_, j) => `Invoice ${j + 1}`),
                  useSameInvoice: false,
                };
              });
              setLsRows(lsRows.length > 0 ? lsRows : [createEmptyRow(), createEmptyRow()]);
            }
          } catch (objEditErr: any) {
            setStrError(objEditErr?.response?.data?.detail || 'Failed to load reimbursement data. Please refresh the page.');
          }
        } else {
          // Create mode - initialize empty rows
          setLsRows([createEmptyRow(), createEmptyRow()]);
        }
        
        setBIsLoading(false);
      } catch (objErr: any) {
        setStrError(objErr?.response?.data?.detail || 'Failed to load categories and payment methods. Please refresh the page.');
        setBIsLoading(false);
      }
    })();
  }, [bIsEdit, id, bIsBusinessTrip]);

  // ── Keep preview's attachment list in sync with active dataset ──
  useEffect(() => {
    if (bShowMatrix) {
      preview.rebuildFromIds(matrixAllAttachmentIds(lsMatrixRows));
    } else {
      const lsIds: string[] = [];
      for (const r of lsRows) for (const id of r.attachments) lsIds.push(id);
      preview.rebuildFromIds(lsIds);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bShowMatrix, lsRows, lsMatrixRows]);

  const noopRefresh = () => {
    /* attachments are watched via useEffect above */
  };

  // ── Helper: Find which row contains the currently previewed attachment ──
  const getCurrentPreviewedRowIndex = (): number => {
    if (preview.lsAllAttachments.length === 0) return -1;
    const strCurrentAttachmentId = preview.lsAllAttachments[preview.iPreviewIdx];
    
    if (bShowMatrix) {
      // For matrix: find row that contains this attachment
      for (let i = 0; i < lsMatrixRows.length; i++) {
        const row = lsMatrixRows[i];
        for (const cell of Object.values(row.cells)) {
          if (cell.attachments.includes(strCurrentAttachmentId)) {
            return i;
          }
        }
      }
    } else {
      // For general table: find row that contains this attachment
      for (let i = 0; i < lsRows.length; i++) {
        if (lsRows[i].attachments.includes(strCurrentAttachmentId)) {
          return i;
        }
      }
    }
    return -1;
  };

  const iHighlightedRowIdx = getCurrentPreviewedRowIndex();

  // ── Save / Submit ──
  const buildPayload = () => {
    if (bIsBusinessTrip) {
      if (!strTripFrom || !strTripTo) {
        setStrError('Trip dates are required for business trip');
        setObjErrorField({ rowIdx: -1, field: 'tripDates' });
        return null;
      }
      if (new Date(strTripFrom) > new Date(strTripTo)) {
        setStrError('Trip end date must be after start date');
        setObjErrorField({ rowIdx: -1, field: 'tripDates' });
        return null;
      }
      const err = validateMatrixRows(lsMatrixRows, lsDateRange, lsCategories, strDescription);
      if (err) {
        setStrError(err.error);
        setObjMatrixErrorField({ rowIdx: err.rowIdx, field: err.field, dateKey: err.dateKey });
        return null;
      }
      return {
        form_type: strFormTypeEnum,
        description: strDescription.trim(),
        items: matrixToItems(lsMatrixRows, lsDateRange),
        business_trip_meta: { from_date: strTripFrom, to_date: strTripTo },
      };
    }

    const err = validateExpenseRows(lsRows, lsCategories, strDescription);
    if (err) {
      setStrError(err.error);
      setObjErrorField({ rowIdx: err.rowIdx, field: err.field });
      return null;
    }
    return {
      form_type: strFormTypeEnum,
      description: strDescription.trim(),
      items: rowsToItems(lsRows),
    };
  };

  const { bIsSaving, save } = useReimbursementSave(
    buildPayload,
    () => navigate('/expense'),
    setStrError,
    id,
  );

  // ── Re-Apply handler (QUERY_RAISED / PRIVATE_ASK / CA_QUERY) ───────────────
  const handleReApply = async () => {
    if (!id) return;
    const objPayload = buildPayload();
    if (!objPayload) return;
    if (!strReApplyMessage.trim()) {
      setStrError('Please provide a message before reapplying.');
      return;
    }
    setBIsReApplying(true);
    setStrError('');
    try {
      // Step 1: Persist the edited data
      await updateDraftApi(id, {
        description: objPayload.description,
        items: objPayload.items,
        business_trip_meta: objPayload.business_trip_meta,
      });
      // Step 2: Transition the state machine
      if (strReimbStatus === 'CA_QUERY') {
        await caReapplyReimbursementApi(id, strReApplyMessage.trim());
      } else {
        await reapplyReimbursementApi(id, strReApplyMessage.trim());
      }
      // After successful re-apply, redirect to the reimbursement detail page
      navigate(`/expense/detail/${id}`);
    } catch (objErr: any) {
      setStrError(objErr?.response?.data?.detail || 'Re-apply failed. Please try again.');
    } finally {
      setBIsReApplying(false);
    }
  };

  const handleCancel = () => {
    const bGeneralHasData = lsRows.some(
      r => r.category_id || r.amount || r.expense_date || r.attachments.length > 0,
    );
    const bMatrixHasData = lsMatrixRows.some(
      r => r.category_id || Object.values(r.cells).some(c => c.amount > 0 || c.attachments.length > 0),
    );
    const bHasData =
      (bIsBusinessTrip ? bMatrixHasData : bGeneralHasData) || strDescription.trim().length > 0;
    if (bHasData && !window.confirm('Are you sure you want to discard all data?')) return;
    navigate('/expense');
  };

  // ── Pre-step (trip dates) ──
  const preStep = bIsBusinessTrip ? (
    <div
      className={`p-5 border-b-2 shadow-sm transition-all ${
        objErrorField?.field === 'tripDates'
          ? 'bg-red-50 border-red-500'
          : 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-300'
      }`}
    >
      <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
        <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#00703C] to-[#005a30] text-white flex items-center justify-center shadow-md">
          <CalendarRange className="w-5 h-5" />
        </span>
        <span className="uppercase tracking-wide text-gray-800">Trip Duration</span>
      </h3>
      <div className="flex gap-4">
        <div className="flex-1">
          <label className="text-xs font-semibold text-gray-700 uppercase mb-2 flex items-center gap-1.5">
            <CalendarDays className="w-3.5 h-3.5 text-[#00703C]" /> From Date
          </label>
          <DateInputDDMMYYYY
            value={strTripFrom}
            onChange={val => {
              setStrTripFrom(val);
              if (objErrorField?.field === 'tripDates') setObjErrorField(null);
            }}
            className="text-sm"
          />
        </div>
        <div className="flex-1">
          <label className="text-xs font-semibold text-gray-700 uppercase mb-2 flex items-center gap-1.5">
            <CalendarCheck2 className="w-3.5 h-3.5 text-[#00703C]" /> To Date
          </label>
          <DateInputDDMMYYYY
            value={strTripTo}
            onChange={val => {
              setStrTripTo(val);
              if (objErrorField?.field === 'tripDates') setObjErrorField(null);
            }}
            className="text-sm"
          />
        </div>
      </div>
    </div>
  ) : null;

  // ── Left panel: Matrix / General / empty-state ──
  const leftPanel = bIsBusinessTrip ? (
    bShowMatrix ? (
      <BusinessTripMatrix
        lsCategories={lsCategories}
        lsDateRange={lsDateRange}
        lsRows={lsMatrixRows}
        setLsRows={setLsMatrixRows}
        objErrorField={objMatrixErrorField}
        setObjErrorField={setObjMatrixErrorField}
        onError={setStrError}
        onAttachmentsChanged={noopRefresh}
        strDescription={strDescription}
        setStrDescription={setStrDescription}
        bShowDescription={bShowDescription}
        setBShowDescription={setBShowDescription}
        lsAllAttachments={preview.lsAllAttachments}
        iPageSize={iLeftPageSize}
        iPageIdx={iLeftPageIdx}
        onRowAdded={handleLeftRowAdded}
        iHighlightedRowIdx={iHighlightedRowIdx}
      />
    ) : (
      <div className="flex-1 flex flex-col items-center justify-center text-center px-6 py-10">
        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#00703C]/10 to-[#00703C]/5 flex items-center justify-center mb-5">
          <CalendarRange className="w-10 h-10 text-[#00703C]" />
        </div>
        <h3 className="text-lg font-bold text-gray-800 mb-2">Select trip duration to begin</h3>
        <p className="text-sm text-gray-500 max-w-sm">
          Once you choose the From and To dates above, an expense matrix will appear with one column per date.
        </p>
      </div>
    )
  ) : (
    <GeneralExpenseTable
      lsCategories={lsCategories}
      lsRows={lsRows}
      setLsRows={setLsRows}
      lsAllAttachments={preview.lsAllAttachments}
      objErrorField={objErrorField}
      setObjErrorField={setObjErrorField}
      onError={setStrError}
      onAttachmentsChanged={noopRefresh}
      strDescription={strDescription}
      setStrDescription={setStrDescription}
      bShowDescription={bShowDescription}
      setBShowDescription={setBShowDescription}
      iPageSize={iLeftPageSize}
      iPageIdx={iLeftPageIdx}
      onRowAdded={handleLeftRowAdded}
      iHighlightedRowIdx={iHighlightedRowIdx}
    />
  );

  // Show loading screen while fetching edit data
  if (bIsLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center">
          <div className="inline-flex h-12 w-12 animate-spin rounded-full border-4 border-gray-300 border-t-[#00703C] mb-4"></div>
          <p className="text-gray-600 font-medium">Loading reimbursement details...</p>
        </div>
      </div>
    );
  }

  // Compute titles based on mode
  const strTripLabel = bIsBusinessTrip ? 'Business Trip' : 'General Expense';
  const strTitle = bIsEdit
    ? strFooterMode !== 'normal'
      ? `Re-Apply — ${strTripLabel} Reimbursement`
      : `Edit ${strTripLabel} Reimbursement`
    : `New ${strTripLabel} Reimbursement`;

  const strSubtitle = bIsEdit
    ? strFooterMode === 'reapply'
      ? 'Update your reimbursement and reapply after the manager\'s query'
      : strFooterMode === 'ca-reapply'
      ? 'Update your reimbursement and reapply after the CA\'s query'
      : 'Update your reimbursement details'
    : 'Fill in expense details, upload invoices, and submit for approval';

  const bAnySaving = bIsSaving || bIsReApplying;

  return (
    <ReimbursementShell
      icon={bIsBusinessTrip ? <Plane className="w-8 h-8" /> : <FileText className="w-8 h-8" />}
      title={strTitle}
      subtitle={strSubtitle}
      onCancel={handleCancel}
      strError={strError}
      onClearError={() => setStrError('')}
      preStep={preStep}
      leftPanelToolbar={leftPanelToolbar}
      leftPanel={leftPanel}
      lsAllAttachments={preview.lsAllAttachments}
      iPreviewIdx={preview.iPreviewIdx}
      setIPreviewIdx={preview.setIPreviewIdx}
      objPreviewMeta={preview.objPreviewMeta}
      strPreviewUrl={preview.strPreviewUrl}
      bScanning={preview.bScanning}
      lsPaymentMethods={lsPaymentMethods}
      strSelectedPaymentMethod={strSelectedPaymentMethod}
      onSelectPaymentMethod={setStrSelectedPaymentMethod}
      bIsSaving={bAnySaving}
      onSaveDraft={() => save(false)}
      onSubmit={() => save(true)}
      strFooterMode={strFooterMode}
      strReApplyMessage={strReApplyMessage}
      onReApplyMessageChange={setStrReApplyMessage}
      onReApply={handleReApply}
    />
  );
}
