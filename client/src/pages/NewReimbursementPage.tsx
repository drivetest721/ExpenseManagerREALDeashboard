/**
 * NewReimbursementPage — composes the shared ReimbursementShell with the
 * General Expense / Business Trip variants.
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
import { FileText, Plane, CalendarRange, CalendarDays, CalendarCheck2 } from 'lucide-react';
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
import type { Category } from '../types/category';
import type { PaymentMethod } from '../types/paymentMethod';
import type { FormType } from '../types/reimbursement';

type RouteFormType = 'general' | 'business-trip';

export default function NewReimbursementPage() {
  const { formType } = useParams<{ formType: RouteFormType }>();
  const navigate = useNavigate();
  const bIsBusinessTrip = formType === 'business-trip';
  const strFormTypeEnum: FormType = bIsBusinessTrip ? 'business_trip' : 'general';

  // ── State ──
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
  const [objErrorField, setObjErrorField] = useState<ErrorField | null>(null);
  const [objMatrixErrorField, setObjMatrixErrorField] = useState<MatrixErrorField | null>(null);

  const preview = useInvoicePreview(setStrError);

  const lsDateRange = bIsBusinessTrip ? buildDateRange(strTripFrom, strTripTo) : [];
  const bShowMatrix = bIsBusinessTrip && lsDateRange.length > 0;

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

        setLsRows([createEmptyRow(), createEmptyRow()]);
      } catch (objErr: any) {
        setStrError(objErr?.response?.data?.detail || 'Failed to load categories and payment methods. Please refresh the page.');
      }
    })();
  }, [bIsBusinessTrip]);

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
  );

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
    />
  );

  return (
    <ReimbursementShell
      icon={bIsBusinessTrip ? <Plane className="w-8 h-8" /> : <FileText className="w-8 h-8" />}
      title={bIsBusinessTrip ? 'New Business Trip Reimbursement' : 'New General Expense Reimbursement'}
      subtitle="Fill in expense details, upload invoices, and submit for approval"
      onCancel={handleCancel}
      strError={strError}
      onClearError={() => setStrError('')}
      preStep={preStep}
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
      bIsSaving={bIsSaving}
      onSaveDraft={() => save(false)}
      onSubmit={() => save(true)}
    />
  );
}
