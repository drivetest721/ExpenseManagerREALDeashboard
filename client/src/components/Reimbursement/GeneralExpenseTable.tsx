/**
 * GeneralExpenseTable — Left-panel expense entry table for General Expense
 * (and also used as the simple-mode left panel for Business Trip until
 * the matrix UI is implemented).
 *
 * Owns: rows, column widths, validation field highlight, invoice upload,
 * row description and running total.
 */
import { useEffect, useState } from 'react';
import { Plus, Trash2, Paperclip, X } from 'lucide-react';
import StyledDropdown from '../common/StyledDropdown';
import DateInputDDMMYYYY from '../common/DateInputDDMMYYYY';
import { uploadAttachmentApi } from '../../utils/attachmentApi';
import { EXPENSE_LOOKBACK_DAYS } from '../../config/expenseConfig';
import type { Category } from '../../types/category';
import type { ReimbursementItem } from '../../types/reimbursement';

export interface ExpenseRow {
  category_id: string;
  sub_category: string;
  amount: number;
  expense_date: string;
  description: string;
  attachments: string[];
  useSameInvoice: boolean;
  _attachmentNames: string[];
}

export interface ErrorField {
  rowIdx: number;
  field: string;
}

export function createEmptyRow(strCategoryId = ''): ExpenseRow {
  return {
    category_id: strCategoryId,
    sub_category: '',
    amount: 0,
    expense_date: '',
    description: '',
    attachments: [],
    useSameInvoice: false,
    _attachmentNames: [],
  };
}

interface Props {
  lsCategories: Category[];
  lsRows: ExpenseRow[];
  setLsRows: (rows: ExpenseRow[]) => void;
  lsAllAttachments: string[];
  objErrorField: ErrorField | null;
  setObjErrorField: (f: ErrorField | null) => void;
  onError: (msg: string) => void;
  onAttachmentsChanged: () => void;
  // description
  strDescription: string;
  setStrDescription: (v: string) => void;
  bShowDescription: boolean;
  setBShowDescription: (v: boolean) => void;
  iPageSize: number;
  iPageIdx: number;
  onRowAdded?: () => void;
  // optional: lock first row's category (used for business trip seed)
  bLockFirstCategory?: boolean;
  // optional: highlight row that contains the currently previewed attachment
  iHighlightedRowIdx?: number;
}

export default function GeneralExpenseTable({
  lsCategories,
  lsRows,
  setLsRows,
  lsAllAttachments,
  objErrorField,
  setObjErrorField,
  onError,
  onAttachmentsChanged,
  strDescription: _strDescription,
  setStrDescription: _setStrDescription,
  bShowDescription: _bShowDescription,
  setBShowDescription: _setBShowDescription,
  iPageSize,
  iPageIdx,
  onRowAdded,
  bLockFirstCategory = false,
  iHighlightedRowIdx = -1,
}: Props) {
  const [iUploadingIdx, setIUploadingIdx] = useState(-1);

  // Helper functions for date constraints
  const getTodayDate = (): Date => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  };

  const getMinDate = (): Date => {
    const minDate = new Date();
    minDate.setDate(minDate.getDate() - EXPENSE_LOOKBACK_DAYS);
    minDate.setHours(0, 0, 0, 0);
    return minDate;
  };
  const [objColumnWidths, setObjColumnWidths] = useState<Record<string, number>>({
    '#': 50,
    category: 200,
    subCategory: 130,
    description: 240,
    amount: 120,
    date: 140,
    invoice: 160,
    actions: 40,
  });
  const [objResizingColumn, setObjResizingColumn] = useState<{ key: string; startX: number; startWidth: number } | null>(null);
  const iPageStart = iPageIdx * iPageSize;
  const lsVisibleRows = lsRows.slice(iPageStart, iPageStart + iPageSize);

  const updateRow = (iIdx: number, objPartial: Partial<ExpenseRow>) => {
    const iActualIdx = iPageStart + iIdx;
    const lsNew = [...lsRows];
    lsNew[iActualIdx] = { ...lsNew[iActualIdx], ...objPartial };
    setLsRows(lsNew);
    if ('attachments' in objPartial) onAttachmentsChanged();
  };

  const addRow = () => {
    const bHasEmpty = lsRows.some(
      r => !r.category_id && r.amount === 0 && !r.expense_date && r.attachments.length === 0,
    );
    if (bHasEmpty) {
      onError('Please fill the existing empty row before adding a new one');
      return;
    }
    setLsRows([...lsRows, createEmptyRow()]);
    onRowAdded?.();
  };

  const removeRow = (iIdx: number) => {
    if (lsRows.length <= 1) return;
    setLsRows(lsRows.filter((_, i) => i !== iIdx));
    onAttachmentsChanged();
  };

  const handleInvoiceUpload = async (iIdx: number, objFile: File) => {
    setIUploadingIdx(iIdx);
    try {
      const objResp = await uploadAttachmentApi(objFile);
      const lsNew = [...lsRows];
      lsNew[iIdx].attachments.push(objResp.attachment_id);
      lsNew[iIdx]._attachmentNames.push(objResp.file_name);
      setLsRows(lsNew);
      onAttachmentsChanged();
      if (objErrorField?.rowIdx === iIdx && objErrorField?.field === 'invoice') {
        setObjErrorField(null);
      }
    } catch (objErr: any) {
      onError(objErr?.response?.data?.detail || 'Failed to upload invoice. Please try again.');
    } finally {
      setIUploadingIdx(-1);
    }
  };

  const removeAttachment = (iRowIdx: number, iAttIdx: number) => {
    const lsNew = [...lsRows];
    lsNew[iRowIdx].attachments.splice(iAttIdx, 1);
    lsNew[iRowIdx]._attachmentNames.splice(iAttIdx, 1);
    setLsRows(lsNew);
    onAttachmentsChanged();
  };

  const toggleUseSameInvoice = (iIdx: number) => {
    const lsNew = [...lsRows];
    const bNewVal = !lsNew[iIdx].useSameInvoice;
    lsNew[iIdx].useSameInvoice = bNewVal;
    if (bNewVal && lsAllAttachments.length > 0) {
      lsNew[iIdx].attachments = [lsAllAttachments[0]];
      lsNew[iIdx]._attachmentNames = ['Shared Invoice'];
    } else {
      lsNew[iIdx].attachments = [];
      lsNew[iIdx]._attachmentNames = [];
    }
    setLsRows(lsNew);
    onAttachmentsChanged();
  };

  // ── Column resize ──
  const handleColumnResizeStart = (strKey: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    setObjResizingColumn({ key: strKey, startX: e.clientX, startWidth: objColumnWidths[strKey] });
  };

  useEffect(() => {
    if (!objResizingColumn) return;
    const handleMouseMove = (e: MouseEvent) => {
      const iDelta = e.clientX - objResizingColumn.startX;
      const iNewWidth = Math.max(50, objResizingColumn.startWidth + iDelta);
      setObjColumnWidths(prev => ({ ...prev, [objResizingColumn.key]: iNewWidth }));
    };
    const handleMouseUp = () => setObjResizingColumn(null);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [objResizingColumn]);

  const numTotal = lsRows.reduce((sum, r) => sum + (r.amount || 0), 0);

  return (
    <>
      <h2 className="text-lg font-bold text-gray-900 mb-4 flex-shrink-0 flex items-center justify-center">
        Expense Items
      </h2>

      <div className="flex-1 overflow-auto custom-scrollbar">
        <table className="w-full text-sm border-collapse" style={{ minWidth: 900 }}>
          <thead className="sticky top-0 bg-gradient-to-r from-gray-100 to-gray-50 z-10 shadow-sm">
            <tr className="text-xs font-bold text-gray-600 uppercase">
              {[
                { key: '#', label: '#' },
                { key: 'category', label: 'Category *' },
                { key: 'subCategory', label: 'Sub Category' },
                { key: 'description', label: 'Description *' },
                { key: 'amount', label: 'Amount (₹) *' },
                { key: 'date', label: 'Expense Date *' },
                { key: 'invoice', label: 'Invoice *' },
                { key: 'actions', label: '' },
              ].map((col, i, arr) => (
                <th
                  key={col.key}
                  className={`px-3 py-3.5 text-center border-gray-300 relative group ${
                    i === 0 ? 'border-l-2 border-r' : i === arr.length - 1 ? 'border-r-2' : 'border-r'
                  }`}
                  style={{ width: objColumnWidths[col.key] }}
                >
                  {col.label.includes('*') ? (
                    <div className="flex items-center justify-center gap-1">
                      {col.label.replace(' *', '')} <span className="text-red-500">*</span>
                    </div>
                  ) : (
                    col.label
                  )}
                  {i < arr.length - 1 && (
                    <div
                      onMouseDown={handleColumnResizeStart(col.key)}
                      className="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-[#00703C] transition-colors group-hover:opacity-100 opacity-0"
                    />
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {lsVisibleRows.map((row, iIdx) => {
              const iActualIdx = iPageStart + iIdx;
              const objCat = lsCategories.find(c => c.category_id === row.category_id);
              const errCell = (field: string) =>
                objErrorField?.rowIdx === iActualIdx && objErrorField?.field === field
                  ? 'bg-red-50 border-red-300 ring-2 ring-red-500/50'
                  : '';
              return (
                <tr
                  key={iActualIdx}
                  className={`transition-all border-b border-gray-100 ${
                    iActualIdx === iHighlightedRowIdx
                      ? 'bg-gradient-to-r from-blue-100 to-cyan-100 hover:from-blue-150 hover:to-cyan-150 ring-2 ring-blue-400 ring-inset'
                      : 'hover:bg-gradient-to-r hover:from-amber-50/50 hover:to-yellow-50/30'
                  }`}
                >
                  <td className="px-3 py-3 text-center text-xs font-bold text-gray-400 border-l-2 border-r border-gray-200">
                    {iActualIdx + 1}
                  </td>

                  <td className={`px-3 py-3 border-r border-gray-200 transition-all ${errCell('category')}`}>
                    <StyledDropdown
                      value={row.category_id}
                      onChange={val => {
                        updateRow(iIdx, { category_id: val, sub_category: '' });
                        if (objErrorField?.rowIdx === iActualIdx && objErrorField?.field === 'category') {
                          setObjErrorField(null);
                        }
                      }}
                      options={lsCategories.map(c => ({
                        value: c.category_id,
                        label: `${c.name} (₹${c.max_limit.toLocaleString('en-IN')})`,
                      }))}
                      placeholder="— Select Category —"
                      disabled={bLockFirstCategory && iActualIdx === 0}
                    />
                  </td>

                  <td className="px-3 py-3 border-r border-gray-200 text-center">
                    {objCat && objCat.sub_categories.length > 0 ? (
                      <StyledDropdown
                        value={row.sub_category}
                        onChange={val => updateRow(iIdx, { sub_category: val })}
                        options={objCat.sub_categories.map(s => ({ value: s, label: s }))}
                        placeholder="— None —"
                      />
                    ) : (
                      <span className="text-gray-300 text-xs italic">N/A</span>
                    )}
                  </td>

                  <td className={`px-3 py-3 border-r border-gray-200 transition-all ${errCell('description')}`}>
                    <input
                      type="text"
                      value={row.description || ''}
                      onChange={e => {
                        updateRow(iIdx, { description: e.target.value });
                        if (objErrorField?.rowIdx === iActualIdx && objErrorField?.field === 'description') {
                          setObjErrorField(null);
                        }
                      }}
                      className={`w-full px-3 py-2.5 border-2 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#00703C] focus:border-[#00703C] hover:border-[#00703C]/50 transition-all shadow-sm ${
                        objErrorField?.rowIdx === iActualIdx && objErrorField?.field === 'description'
                          ? 'border-red-500 bg-red-50'
                          : 'border-gray-300'
                      }`}
                      placeholder="Short description (required)"
                    />
                  </td>

                  <td className={`px-3 py-3 border-r border-gray-200 transition-all ${errCell('amount')}`}>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-xs font-semibold">₹</span>
                      <input
                        type="text"
                        value={row.amount ? row.amount.toLocaleString('en-IN') : ''}
                        onChange={e => {
                          const str = e.target.value.replace(/,/g, '').replace(/[^0-9]/g, '');
                          const iVal = parseInt(str || '0');
                          if (!isNaN(iVal) && iVal >= 0) {
                            updateRow(iIdx, { amount: iVal });
                            if (objErrorField?.rowIdx === iActualIdx && objErrorField?.field === 'amount') {
                              setObjErrorField(null);
                            }
                          } else if (e.target.value === '') {
                            updateRow(iIdx, { amount: 0 });
                          }
                        }}
                        onBlur={e => {
                          const str = e.target.value.replace(/,/g, '').replace(/[^0-9]/g, '');
                          const iVal = parseInt(str || '0');
                          if (isNaN(iVal) || iVal <= 0) updateRow(iIdx, { amount: 0 });
                        }}
                        className={`w-full px-3 pl-7 py-2.5 border-2 rounded-lg text-xs text-right focus:outline-none focus:ring-2 focus:ring-[#00703C] focus:border-[#00703C] font-semibold hover:border-[#00703C]/50 transition-all shadow-sm ${
                          objErrorField?.rowIdx === iActualIdx && objErrorField?.field === 'amount'
                            ? 'border-red-500 bg-red-50'
                            : 'border-gray-300'
                        }`}
                        placeholder="0"
                      />
                    </div>
                  </td>

                  <td className={`px-3 py-3 border-r border-gray-200 transition-all ${errCell('date')}`}>
                    <DateInputDDMMYYYY
                      value={row.expense_date}
                      onChange={val => {
                        updateRow(iIdx, { expense_date: val });
                        if (objErrorField?.rowIdx === iActualIdx && objErrorField?.field === 'date') {
                          setObjErrorField(null);
                        }
                      }}
                      minDate={getMinDate()}
                      maxDate={getTodayDate()}
                    />
                  </td>

                  <td className={`px-3 py-3 border-r border-gray-200 transition-all ${errCell('invoice')}`}>
                    <div className="space-y-2">
                      {row.attachments.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {row._attachmentNames.map((nm, j) => (
                            <div
                              key={j}
                              className="flex items-center gap-1.5 text-xs bg-gradient-to-r from-green-50 to-emerald-50 px-2.5 py-1.5 rounded-lg border border-green-200 shadow-sm"
                            >
                              <Paperclip className="w-3 h-3 text-green-600 flex-shrink-0" />
                              <span className="truncate max-w-[70px] font-medium text-green-700" title={nm}>
                                {nm}
                              </span>
                              <button
                                onClick={() => removeAttachment(iActualIdx, j)}
                                className="text-red-400 hover:text-red-600 hover:scale-110 transition-all"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="flex flex-col gap-2">
                        {!row.useSameInvoice && (
                          <label className="inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold border-2 border-dashed border-[#00703C]/40 rounded-lg hover:border-[#00703C] hover:bg-[#00703C]/5 cursor-pointer transition-all shadow-sm hover:shadow-md">
                            <Paperclip className="w-4 h-4 text-[#00703C]" />
                            <span className="text-[#00703C]">
                              {iUploadingIdx === iActualIdx
                                ? 'Uploading…'
                                : row.attachments.length > 0
                                ? 'Add Another'
                                : 'Upload Invoice'}
                            </span>
                            <input
                              type="file"
                              accept="image/*,application/pdf,.docx"
                              disabled={iUploadingIdx === iActualIdx}
                              onChange={e => {
                                const f = e.target.files?.[0];
                                if (f) {
                                  handleInvoiceUpload(iActualIdx, f);
                                  e.target.value = '';
                                }
                              }}
                              className="hidden"
                            />
                          </label>
                        )}
                        {lsAllAttachments.length > 0 && iActualIdx > 0 && (
                          <label className="flex items-center gap-2 text-xs cursor-pointer px-2 py-1.5 hover:bg-gray-50 rounded-lg transition-colors">
                            <input
                              type="checkbox"
                              checked={row.useSameInvoice}
                              onChange={() => toggleUseSameInvoice(iActualIdx)}
                              className="w-4 h-4 text-[#00703C] border-2 border-gray-300 rounded focus:ring-[#00703C] cursor-pointer"
                            />
                            <span className="text-gray-700 font-medium">Use Same Invoice</span>
                          </label>
                        )}
                      </div>
                    </div>
                  </td>

                  <td className="px-3 py-3 text-center border-r-2 border-gray-200">
                    {lsRows.length > 1 && !(bLockFirstCategory && iActualIdx === 0) && (
                      <button
                        onClick={() => removeRow(iActualIdx)}
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-red-400 hover:bg-red-50 hover:text-red-600 mx-auto transition-all hover:scale-110"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="bg-white">
              <td colSpan={8} className="px-3 py-4">
                <button
                  onClick={addRow}
                  className="flex items-center gap-2 px-4 py-2.5 text-sm font-bold border-2 border-dashed border-[#00703C]/50 rounded-lg hover:bg-[#00703C]/10 hover:border-[#00703C] text-[#00703C] transition-all hover:shadow-md"
                >
                  <Plus className="w-5 h-5" /> Add Row
                </button>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="flex-shrink-0 pt-4 flex justify-end items-center">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-medium text-gray-600">Total:</span>
          <span className="text-2xl font-bold text-[#00703C]">₹{numTotal.toLocaleString('en-IN')}</span>
        </div>
      </div>
    </>
  );
}

/** Validate rows + description and return a field-targeted error, or null. */
export function validateExpenseRows(
  lsRows: ExpenseRow[],
  lsCategories: Category[],
  _strDescription: string,
): { error: string; rowIdx: number; field: string } | null {
  // General description is optional now — per-row description is required.
  const lsWithData = lsRows.filter(r => r.category_id || r.amount > 0 || r.expense_date || r.attachments.length > 0);
  if (lsWithData.length === 0) {
    return { error: 'Please add at least one expense row', rowIdx: 0, field: 'category' };
  }

  for (let i = 0; i < lsRows.length; i++) {
    const r = lsRows[i];
    if (!r.category_id && !r.amount && !r.expense_date && r.attachments.length === 0) continue;
    if (!r.category_id) return { error: `Row ${i + 1}: Please select a category`, rowIdx: i, field: 'category' };
    if (r.amount <= 0) return { error: `Row ${i + 1}: Amount must be greater than ₹0`, rowIdx: i, field: 'amount' };
    if (!r.expense_date) return { error: `Row ${i + 1}: Please select expense date`, rowIdx: i, field: 'date' };
    if (r.attachments.length === 0) return { error: `Row ${i + 1}: Please upload an invoice`, rowIdx: i, field: 'invoice' };
    if (!r.description || r.description.trim().length < 3) return { error: `Row ${i + 1}: Description is required (min 3 chars)`, rowIdx: i, field: 'description' };

    const objCat = lsCategories.find(c => c.category_id === r.category_id);
    if (objCat && r.amount > objCat.max_limit) {
      return { error: `Row ${i + 1}: Amount exceeds category limit (₹${objCat.max_limit.toLocaleString()})`, rowIdx: i, field: 'amount' };
    }
  }
  return null;
}

/** Convert ExpenseRow[] to API ReimbursementItem[]. */
export function rowsToItems(lsRows: ExpenseRow[]): ReimbursementItem[] {
  return lsRows
    .filter(r => r.category_id && r.amount > 0 && r.expense_date)
    .map(r => ({
      category_id: r.category_id,
      sub_category: r.sub_category || undefined,
      amount: r.amount,
      expense_date: r.expense_date,
      description: r.description || undefined,
      attachments: r.attachments,
    }));
}
