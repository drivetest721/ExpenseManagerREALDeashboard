/**
 * NewReimbursementModal — create a new reimbursement (DRAFT → optional submit).
 * Supports General and Business Trip form types, multiple items, attachments.
 * Features a 3-section tabbed interface for better UX.
 */
import { useState, useEffect } from 'react';
import { X, Plus, Trash2, Paperclip, ChevronRight, Check } from 'lucide-react';
import { InfoButton } from '../common/InfoButton';
import { createDraftApi, submitReimbursementApi } from '../../utils/reimbursementApi';
import { listCategoriesApi } from '../../utils/categoryApi';
import { uploadAttachmentApi } from '../../utils/attachmentApi';
import type { Category } from '../../types/category';
import type { ReimbursementItem, FormType } from '../../types/reimbursement';

interface NewReimbursementModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

interface DraftItem extends ReimbursementItem {
  _attachmentNames: string[]; // local display only
}

type TabId = 'step1' | 'step2' | 'step3';

function emptyItem(): DraftItem {
  return {
    category_id: '', sub_category: '', amount: 0,
    expense_date: new Date().toISOString().slice(0, 10),
    description: '', attachments: [], _attachmentNames: [],
  };
}

export default function NewReimbursementModal({ onClose, onSuccess }: NewReimbursementModalProps) {
  const [strActiveTab, setStrActiveTab] = useState<TabId>('step1');
  const [strFormType, setStrFormType] = useState<FormType>('general');
  const [strTripFrom, setStrTripFrom] = useState<string>('');
  const [strTripTo, setStrTripTo] = useState<string>('');
  const [lsItems, setLsItems] = useState<DraftItem[]>([emptyItem(), emptyItem(), emptyItem()]);
  const [lsCategories, setLsCategories] = useState<Category[]>([]);
  const [bIsSaving, setBIsSaving] = useState<boolean>(false);
  const [strError, setStrError] = useState<string>('');
  const [iUploadingIdx, setIUploadingIdx] = useState<number>(-1);

  useEffect(() => {
    listCategoriesApi().then(setLsCategories).catch(() => setStrError('Failed to load categories.'));
  }, []);

  function updateItem(iIdx: number, objPatch: Partial<DraftItem>) {
    setLsItems(ls => ls.map((it, i) => i === iIdx ? { ...it, ...objPatch } : it));
  }

  function addItem() { setLsItems(ls => [...ls, emptyItem()]); }
  function removeItem(iIdx: number) { setLsItems(ls => ls.filter((_, i) => i !== iIdx)); }

  async function handleAttachment(iIdx: number, objFile: File) {
    setIUploadingIdx(iIdx); setStrError('');
    try {
      const objResp = await uploadAttachmentApi(objFile);
      setLsItems(ls => ls.map((it, i) => i === iIdx ? {
        ...it,
        attachments: [...it.attachments, objResp.attachment_id],
        _attachmentNames: [...it._attachmentNames, objResp.file_name],
      } : it));
    } catch (e: any) {
      setStrError(e.response?.data?.detail || 'Upload failed.');
    } finally { setIUploadingIdx(-1); }
  }

  function removeAttachment(iItem: number, iAtt: number) {
    setLsItems(ls => ls.map((it, i) => i === iItem ? {
      ...it,
      attachments: it.attachments.filter((_, j) => j !== iAtt),
      _attachmentNames: it._attachmentNames.filter((_, j) => j !== iAtt),
    } : it));
  }

  /** A row is considered empty if the user hasn't touched any meaningful field. */
  function isRowEmpty(it: DraftItem): boolean {
    return (
      !it.category_id &&
      (!it.amount || it.amount <= 0) &&
      !it.description &&
      it.attachments.length === 0
    );
  }

  function validate(): string | null {
    const lsFilled = lsItems.filter(it => !isRowEmpty(it));
    if (lsFilled.length === 0) return 'Add at least one expense item.';
    if (strFormType === 'business_trip' && (!strTripFrom || !strTripTo)) return 'Trip dates are required.';
    if (strFormType === 'business_trip' && strTripFrom > strTripTo) return 'Trip "from" date must be before "to" date.';
    for (let i = 0; i < lsFilled.length; i++) {
      const it = lsFilled[i];
      if (!it.category_id) return `Item ${i + 1}: Category is required.`;
      if (!it.amount || it.amount <= 0) return `Item ${i + 1}: Amount must be greater than 0.`;
      if (!it.expense_date) return `Item ${i + 1}: Expense date is required.`;
      if (it.attachments.length === 0)
        return `Item ${i + 1}: An invoice attachment is required.`;
      const objCat = lsCategories.find(c => c.category_id === it.category_id);
      if (objCat && it.amount > objCat.max_limit)
        return `Item ${i + 1}: Amount exceeds the ₹${objCat.max_limit} limit for "${objCat.name}".`;
    }
    return null;
  }

  async function handleSave(bSubmit: boolean) {
    const strValErr = validate();
    if (strValErr) { setStrError(strValErr); return; }
    setBIsSaving(true); setStrError('');
    // Only send rows that have data — empty pre-loaded rows are silently dropped.
    const lsFilledItems = lsItems.filter(it => !isRowEmpty(it));
    try {
      const objDraft = await createDraftApi({
        form_type: strFormType,
        items: lsFilledItems.map(({ _attachmentNames, ...rest }) => { void _attachmentNames; return rest; }),
        business_trip_meta: strFormType === 'business_trip' ? { from_date: strTripFrom, to_date: strTripTo } : undefined,
      });
      if (bSubmit) await submitReimbursementApi(objDraft.reimbursement_id);
      onSuccess(); onClose();
    } catch (e: any) {
      setStrError(e.response?.data?.detail || 'Failed to save reimbursement.');
    } finally { setBIsSaving(false); }
  }

  const numTotal = lsItems.filter(it => !isRowEmpty(it)).reduce((a, b) => a + (b.amount || 0), 0);

  function getLimitError(it: DraftItem): string | null {
    if (isRowEmpty(it)) return null; // blank row — no error highlight
    const objCat = lsCategories.find(c => c.category_id === it.category_id);
    if (!objCat) return null;
    if (objCat.max_limit > 0 && it.amount > objCat.max_limit)
      return `Amount exceeds the ₹${objCat.max_limit.toLocaleString()} limit for "${objCat.name}".`;
    return null;
  }
  const bHasLimitErr = lsItems.some(it => !isRowEmpty(it) && getLimitError(it) !== null);

  // Tab validation helpers
  function canProceedFromStep1(): boolean {
    if (strFormType === 'business_trip') {
      return !!(strTripFrom && strTripTo && strTripFrom <= strTripTo);
    }
    return true; // General expense - always can proceed
  }

  function canProceedFromStep2(): boolean {
    const lsFilled = lsItems.filter(it => !isRowEmpty(it));
    if (lsFilled.length === 0) return false;
    for (const it of lsFilled) {
      if (!it.category_id || !it.amount || it.amount <= 0 || !it.expense_date || it.attachments.length === 0) {
        return false;
      }
    }
    return !bHasLimitErr;
  }

  function goToTab(strTab: TabId) {
    setStrError('');
    if (strTab === 'step2' && !canProceedFromStep1()) {
      setStrError(strFormType === 'business_trip' ? 'Please fill in valid trip dates.' : 'Please complete the form type selection.');
      return;
    }
    if (strTab === 'step3' && !canProceedFromStep2()) {
      setStrError('Please complete all expense items with required fields and invoices.');
      return;
    }
    setStrActiveTab(strTab);
  }

  // Tab metadata
  const lsTabs: Array<{ id: TabId; label: string; isComplete: boolean }> = [
    {
      id: 'step1',
      label: strFormType === 'general' ? 'Basic Info' : 'Trip Details',
      isComplete: canProceedFromStep1(),
    },
    {
      id: 'step2',
      label: 'Expense Items',
      isComplete: canProceedFromStep2(),
    },
    {
      id: 'step3',
      label: 'Review & Submit',
      isComplete: false,
    },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-start sm:items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 max-w-5xl w-full my-4 sm:my-8 max-h-[95vh] sm:max-h-[90vh] flex flex-col overflow-hidden">

        {/* ── Header ── */}
        <div className="flex items-center justify-between px-5 py-4 border-b-2 border-gray-100 flex-shrink-0">
          <h2 className="text-lg font-bold text-gray-900">New Reimbursement</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600 cursor-pointer transition-colors"><X className="w-5 h-5" /></button>
        </div>

        {/* ── Tab Navigation ── */}
        <div className="border-b border-gray-200 bg-gray-50 px-5 flex-shrink-0">
          <div className="flex gap-1">
            {lsTabs.map((objTab, iIdx) => (
              <button
                key={objTab.id}
                onClick={() => goToTab(objTab.id)}
                className={`
                  relative px-6 py-3 text-sm font-semibold cursor-pointer transition-all
                  ${strActiveTab === objTab.id
                    ? 'text-[#00703C] bg-white border-b-2 border-[#00703C]'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100/50'}
                  ${iIdx < lsTabs.length - 1 ? 'after:content-[""] after:absolute after:right-0 after:top-1/2 after:-translate-y-1/2 after:w-px after:h-4 after:bg-gray-300' : ''}
                `}
              >
                <span className="flex items-center gap-2">
                  {objTab.isComplete && objTab.id !== strActiveTab && (
                    <Check className="w-4 h-4 text-green-600" />
                  )}
                  <span>{iIdx + 1}. {objTab.label}</span>
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* ── Body ── */}
        <div className="flex-1 overflow-y-auto px-5 py-5 custom-scrollbar">
          {strError && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm flex gap-2"><span>⚠</span>{strError}</div>}

          {/* Step 1: Form Type / Trip Details */}
          {strActiveTab === 'step1' && (
            <div className="space-y-6 animate-fadeIn">
              {/* Form Type */}
              <div>
                <h3 className="text-base font-bold text-gray-900 pb-1 border-b-2 border-gray-200 mb-4">Form Type</h3>
                <div className="flex gap-6">
                  {(['general', 'business_trip'] as FormType[]).map(t => (
                    <label key={t} className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" checked={strFormType === t} onChange={() => setStrFormType(t)} className="w-4 h-4 accent-[#00703C] cursor-pointer" />
                      <span className="text-sm font-medium text-gray-700">{t === 'general' ? '📄 General Expense' : '✈️ Business Trip'}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Trip Dates */}
              {strFormType === 'business_trip' && (
                <div>
                  <h3 className="text-base font-bold text-gray-900 pb-1 border-b-2 border-gray-200 mb-4">Trip Details</h3>
                  <div className="grid grid-cols-2 gap-5">
                    <div>
                      <label className="block text-sm font-semibold mb-1 text-gray-900 flex items-center gap-1">From Date <span className="text-red-600">*</span> <InfoButton text="Start date of the business trip." strPlacement="right" /></label>
                      <input type="date" className="w-full border-b-2 border-gray-300 bg-amber-50 focus:border-blue-500 outline-none py-2 text-sm px-1 transition-colors cursor-pointer" value={strTripFrom} onChange={e => setStrTripFrom(e.target.value)} />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold mb-1 text-gray-900 flex items-center gap-1">To Date <span className="text-red-600">*</span> <InfoButton text="End date of the business trip." strPlacement="right" /></label>
                      <input type="date" className="w-full border-b-2 border-gray-300 bg-amber-50 focus:border-blue-500 outline-none py-2 text-sm px-1 transition-colors cursor-pointer" value={strTripTo} onChange={e => setStrTripTo(e.target.value)} />
                    </div>
                  </div>
                  {strTripFrom && strTripTo && strTripFrom > strTripTo && (
                    <p className="mt-2 text-red-600 text-sm">From date must be before To date.</p>
                  )}
                </div>
              )}

              <div className="flex justify-end pt-4">
                <button
                  onClick={() => goToTab('step2')}
                  disabled={!canProceedFromStep1()}
                  className="flex items-center gap-2 px-5 py-2.5 bg-[#00703C] text-white rounded-lg hover:bg-[#005a30] disabled:opacity-50 disabled:cursor-not-allowed font-semibold transition-colors"
                >
                  Next: Expense Items <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Expense Items */}
          {strActiveTab === 'step2' && (
            <div className="space-y-6 animate-fadeIn">
              <h3 className="text-base font-bold text-gray-900 pb-1 border-b-2 border-gray-200 flex items-center gap-2">
                Expense Items
                <span className="text-xs font-normal text-gray-400">(every row requires an invoice)</span>
              </h3>

              <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
                <table className="w-full text-sm border-collapse" style={{ minWidth: 860 }}>
                  <thead>
                    <tr className="bg-gray-50 text-xs font-bold text-gray-500 uppercase tracking-wider">
                      <th className="px-3 py-3 w-8 text-center cursor-default border-l border-r border-gray-200">#</th>
                      <th className="px-3 py-3 text-center cursor-default border-r border-gray-200">Category <span className="text-red-500">*</span></th>
                      <th className="px-3 py-3 text-center cursor-default border-r border-gray-200">Sub Category</th>
                      <th className="px-3 py-3 text-center cursor-default border-r border-gray-200">Amount (₹) <span className="text-red-500">*</span></th>
                      <th className="px-3 py-3 text-center cursor-default border-r border-gray-200">Expense Date <span className="text-red-500">*</span></th>
                      <th className="px-3 py-3 text-center cursor-default border-r border-gray-200">Description</th>
                      <th className="px-3 py-3 text-center cursor-default border-r border-gray-200">Invoice <span className="text-red-500">*</span></th>
                      <th className="px-2 py-3 w-8 text-center border-r border-gray-200"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {lsItems.map((it, iIdx) => {
                      const objCat = lsCategories.find(c => c.category_id === it.category_id);
                      const strLimitErr = getLimitError(it);
                      return (
                        <tr key={iIdx} className="hover:bg-amber-50/20 transition-colors align-top">
                          <td className="px-3 py-3 text-center text-xs font-semibold text-gray-400 cursor-default border-l border-r border-gray-200">{iIdx + 1}</td>
                          <td className="px-3 py-2 border-r border-gray-200">
                            <select
                              className="w-full border-b-2 border-gray-300 bg-amber-50 focus:border-blue-500 outline-none py-2 text-xs px-1 cursor-pointer transition-colors min-w-[130px]"
                              value={it.category_id}
                              onChange={e => updateItem(iIdx, { category_id: e.target.value, sub_category: '' })}
                            >
                              <option value="">— Select —</option>
                              {lsCategories.filter(c => c.is_active).map(c => (
                                <option key={c.category_id} value={c.category_id}>{c.name} (₹{c.max_limit.toLocaleString()})</option>
                              ))}
                            </select>
                          </td>
                          <td className="px-3 py-2 border-r border-gray-200">
                            {objCat && objCat.sub_categories.length > 0 ? (
                              <select
                                className="w-full border-b-2 border-gray-300 bg-amber-50 focus:border-blue-500 outline-none py-2 text-xs px-1 cursor-pointer transition-colors min-w-[110px]"
                                value={it.sub_category || ''}
                                onChange={e => updateItem(iIdx, { sub_category: e.target.value })}
                              >
                                <option value="">— None —</option>
                                {objCat.sub_categories.map(s => <option key={s} value={s}>{s}</option>)}
                              </select>
                            ) : (
                              <span className="text-gray-300 text-xs px-1">—</span>
                            )}
                          </td>
                          <td className="px-3 py-2 border-r border-gray-200">
                            <div className="relative min-w-[90px]">
                              <span className="absolute left-1 top-1/2 -translate-y-1/2 text-gray-400 text-xs">₹</span>
                              <input
                                type="number" min="0" step="0.01"
                                className={`w-full border-b-2 bg-amber-50 outline-none py-2 text-xs pl-5 pr-1 transition-colors ${strLimitErr ? 'border-red-500' : 'border-gray-300 focus:border-blue-500'}`}
                                value={it.amount || ''}
                                onChange={e => updateItem(iIdx, { amount: parseFloat(e.target.value) || 0 })}
                              />
                            </div>
                            {strLimitErr && <p className="text-red-500 text-xs mt-0.5 leading-tight">{strLimitErr}</p>}
                          </td>
                          <td className="px-3 py-2 border-r border-gray-200">
                            <input
                              type="date"
                              className="w-full border-b-2 border-gray-300 bg-amber-50 focus:border-blue-500 outline-none py-2 text-xs px-1 cursor-pointer transition-colors min-w-[120px]"
                              value={it.expense_date}
                              onChange={e => updateItem(iIdx, { expense_date: e.target.value })}
                            />
                          </td>
                          <td className="px-3 py-2 border-r border-gray-200">
                            <input
                              type="text"
                              placeholder="Optional…"
                              className="w-full border-b-2 border-gray-300 bg-amber-50 focus:border-blue-500 outline-none py-2 text-xs px-1 transition-colors min-w-[120px]"
                              value={it.description || ''}
                              onChange={e => updateItem(iIdx, { description: e.target.value })}
                            />
                          </td>
                          <td className="px-3 py-2 min-w-[130px] border-r border-gray-200">
                            {it._attachmentNames.length > 0 ? (
                              <div className="flex flex-col gap-1">
                                {it._attachmentNames.map((nm, j) => (
                                  <div key={j} className="flex items-center gap-1 text-xs bg-gray-50 px-2 py-1 rounded-lg border border-gray-200">
                                    <span className="truncate max-w-[80px]" title={nm}>📎 {nm}</span>
                                    <button onClick={() => removeAttachment(iIdx, j)} className="text-red-400 hover:text-red-600 cursor-pointer flex-shrink-0">
                                      <X className="w-3 h-3" />
                                    </button>
                                  </div>
                                ))}
                                <label className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium border border-gray-300 rounded-lg hover:bg-gray-50 cursor-pointer text-gray-500 transition-colors">
                                  <Paperclip className="w-3 h-3" /> Add
                                  <input type="file" accept="image/*,application/pdf" disabled={iUploadingIdx === iIdx} onChange={e => { const f = e.target.files?.[0]; if (f) { handleAttachment(iIdx, f); e.target.value = ''; } }} className="hidden" />
                                </label>
                              </div>
                            ) : (
                              <label className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold border border-dashed border-gray-400 rounded-lg hover:bg-gray-50 hover:border-[#00703C] cursor-pointer text-gray-600 hover:text-[#00703C] transition-colors whitespace-nowrap">
                                <Paperclip className="w-3.5 h-3.5" />
                                {iUploadingIdx === iIdx ? 'Uploading…' : 'Choose File'}
                                <input type="file" accept="image/*,application/pdf" disabled={iUploadingIdx === iIdx} onChange={e => { const f = e.target.files?.[0]; if (f) { handleAttachment(iIdx, f); e.target.value = ''; } }} className="hidden" />
                              </label>
                            )}
                          </td>
                          <td className="px-2 py-3 text-center border-r border-gray-200">
                            {lsItems.length > 1 && (
                              <button onClick={() => removeItem(iIdx)} className="w-6 h-6 rounded-full flex items-center justify-center text-red-400 hover:bg-red-50 hover:text-red-600 cursor-pointer transition-colors mx-auto">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <button
                onClick={addItem}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold border-2 border-dashed border-[#00703C]/40 rounded-lg hover:bg-[#00703C]/5 hover:border-[#00703C]/70 text-[#00703C] cursor-pointer transition-colors"
              >
                <Plus className="w-4 h-4" /> Add Row
              </button>

              <div className="flex justify-between pt-4">
                <button
                  onClick={() => goToTab('step1')}
                  className="flex items-center gap-2 px-5 py-2.5 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-semibold transition-colors"
                >
                  <ChevronRight className="w-4 h-4 rotate-180" /> Back
                </button>
                <button
                  onClick={() => goToTab('step3')}
                  disabled={!canProceedFromStep2()}
                  className="flex items-center gap-2 px-5 py-2.5 bg-[#00703C] text-white rounded-lg hover:bg-[#005a30] disabled:opacity-50 disabled:cursor-not-allowed font-semibold transition-colors"
                >
                  Next: Review & Submit <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Review & Submit */}
          {strActiveTab === 'step3' && (
            <div className="space-y-6 animate-fadeIn">
              <h3 className="text-base font-bold text-gray-900 pb-1 border-b-2 border-gray-200">Summary</h3>

              {/* Form Details */}
              <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-xs font-semibold text-gray-500 uppercase">Form Type</span>
                    <p className="text-sm font-medium text-gray-900 mt-1">
                      {strFormType === 'general' ? '📄 General Expense' : '✈️ Business Trip'}
                    </p>
                  </div>
                  {strFormType === 'business_trip' && (
                    <div>
                      <span className="text-xs font-semibold text-gray-500 uppercase">Trip Duration</span>
                      <p className="text-sm font-medium text-gray-900 mt-1">
                        {new Date(strTripFrom).toLocaleDateString('en-GB')} to {new Date(strTripTo).toLocaleDateString('en-GB')}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Expense Items Summary */}
              <div>
                <h4 className="text-sm font-bold text-gray-700 mb-3">Expense Items ({lsItems.filter(it => !isRowEmpty(it)).length})</h4>
                <div className="space-y-2">
                  {lsItems.filter(it => !isRowEmpty(it)).map((it, iIdx) => {
                    const objCat = lsCategories.find(c => c.category_id === it.category_id);
                    return (
                      <div key={iIdx} className="bg-white border border-gray-200 rounded-lg p-3 flex justify-between items-center">
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-gray-900">{objCat?.name || it.category_id}</p>
                          {it.sub_category && <p className="text-xs text-gray-600">{it.sub_category}</p>}
                          <p className="text-xs text-gray-500 mt-1">
                            {new Date(it.expense_date).toLocaleDateString('en-GB')}
                            {it.description && <span> • {it.description}</span>}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-gray-900">₹{it.amount.toLocaleString()}</p>
                          <p className="text-xs text-gray-500">{it.attachments.length} invoice(s)</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Total */}
              <div className="bg-[#00703C]/10 border-2 border-[#00703C]/30 rounded-lg p-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-semibold text-gray-700">Total Amount</span>
                  <span className="text-2xl font-bold text-[#00703C]">₹{numTotal.toLocaleString()}</span>
                </div>
              </div>

              <div className="flex justify-between pt-4">
                <button
                  onClick={() => goToTab('step2')}
                  className="flex items-center gap-2 px-5 py-2.5 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-semibold transition-colors"
                >
                  <ChevronRight className="w-4 h-4 rotate-180" /> Back to Items
                </button>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleSave(false)}
                    disabled={bIsSaving || bHasLimitErr}
                    className="px-5 py-2.5 bg-gray-700 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed font-semibold transition-colors"
                  >
                    {bIsSaving ? 'Saving…' : 'Save Draft'}
                  </button>
                  <button
                    onClick={() => handleSave(true)}
                    disabled={bIsSaving || bHasLimitErr}
                    className="px-5 py-2.5 bg-[#00703C] text-white rounded-lg hover:bg-[#005a30] disabled:opacity-50 disabled:cursor-not-allowed font-semibold transition-colors"
                  >
                    {bIsSaving ? 'Submitting…' : 'Save & Submit'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
