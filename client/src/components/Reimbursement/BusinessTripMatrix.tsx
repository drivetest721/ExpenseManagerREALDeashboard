/**
 * BusinessTripMatrix — Date × Category matrix for business trip reimbursements.
 *
 * - Columns: every date between trip from→to (inclusive).
 * - Rows: user-selected (category, sub_category) pairs.
 * - Cells: amount + per-cell invoice attachment.
 * - Footer row: per-date totals + grand total.
 * - Header summary: row count + sub-category count + per-date totals.
 *
 * Validation: at least one cell with amount>0; every filled cell needs an
 * invoice; every row must have a category selected.
 */
import { useMemo, useState } from 'react';
import { Trash2, Paperclip, X } from 'lucide-react';
import StyledDropdown from '../common/StyledDropdown';
import { uploadAttachmentApi } from '../../utils/attachmentApi';
import type { Category } from '../../types/category';
import type { ReimbursementItem } from '../../types/reimbursement';

export interface MatrixCell {
  amount: number;
  attachments: string[];
  _attachmentNames: string[];
  useSameInvoice: boolean;
}

export interface MatrixRow {
  category_id: string;
  sub_category: string;
  cells: Record<string, MatrixCell>; // key = yyyy-mm-dd
}

export interface MatrixErrorField {
  rowIdx: number;
  field: string;        // 'category' | 'amount' | 'invoice'
  dateKey?: string;     // for amount / invoice
}

export function createEmptyMatrixRow(): MatrixRow {
  return { category_id: '', sub_category: '', cells: {} };
}

function getCell(row: MatrixRow, key: string): MatrixCell {
  return row.cells[key] || { amount: 0, attachments: [], _attachmentNames: [], useSameInvoice: false };
}

/** Generate yyyy-mm-dd strings inclusive between fromIso and toIso. */
export function buildDateRange(strFromIso: string, strToIso: string): string[] {
  if (!strFromIso || !strToIso) return [];
  const dtFrom = new Date(strFromIso + 'T00:00:00');
  const dtTo = new Date(strToIso + 'T00:00:00');
  if (isNaN(dtFrom.getTime()) || isNaN(dtTo.getTime()) || dtFrom > dtTo) return [];
  const ls: string[] = [];
  const dt = new Date(dtFrom);
  while (dt <= dtTo) {
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, '0');
    const d = String(dt.getDate()).padStart(2, '0');
    ls.push(`${y}-${m}-${d}`);
    dt.setDate(dt.getDate() + 1);
  }
  return ls;
}

/** Short header label e.g. "28/5". */
function fmtDateShort(strIso: string): { strDay: string; strDow: string } {
  const dt = new Date(strIso + 'T00:00:00');
  const d = dt.getDate();
  const m = dt.getMonth() + 1;
  const lsDow = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return { strDay: `${d}/${m}`, strDow: lsDow[dt.getDay()] };
}

interface Props {
  lsCategories: Category[];
  lsDateRange: string[];
  lsRows: MatrixRow[];
  setLsRows: (rows: MatrixRow[]) => void;
  objErrorField: MatrixErrorField | null;
  setObjErrorField: (f: MatrixErrorField | null) => void;
  onError: (msg: string) => void;
  onAttachmentsChanged: () => void;
  strDescription: string;
  setStrDescription: (v: string) => void;
  bShowDescription: boolean;
  setBShowDescription: (v: boolean) => void;
  lsAllAttachments: string[];
  iPageSize: number;
  iPageIdx: number;
  onRowAdded?: () => void;
}

export default function BusinessTripMatrix({
  lsCategories,
  lsDateRange,
  lsRows,
  setLsRows,
  objErrorField,
  setObjErrorField,
  onError,
  onAttachmentsChanged,
  strDescription: _strDescription,
  setStrDescription: _setStrDescription,
  bShowDescription: _bShowDescription,
  setBShowDescription: _setBShowDescription,
  lsAllAttachments,
  iPageSize,
  iPageIdx,
  onRowAdded: _onRowAdded,
}: Props) {
  const [strUploadingKey, setStrUploadingKey] = useState('');
  const iPageStart = iPageIdx * iPageSize;
  const lsVisibleRows = lsRows.slice(iPageStart, iPageStart + iPageSize);

  const updateRow = (iIdx: number, fn: (r: MatrixRow) => MatrixRow) => {
    const iActualIdx = iPageStart + iIdx;
    const lsNew = [...lsRows];
    lsNew[iActualIdx] = fn(lsNew[iActualIdx]);
    setLsRows(lsNew);
  };

  const setCell = (iRowIdx: number, strKey: string, objPartial: Partial<MatrixCell>) => {
    updateRow(iRowIdx, r => {
      const objCell = { ...getCell(r, strKey), ...objPartial };
      return { ...r, cells: { ...r.cells, [strKey]: objCell } };
    });
  };

  const removeRow = (iIdx: number) => {
    if (lsRows.length <= 1) return;
    setLsRows(lsRows.filter((_, i) => i !== iIdx));
    onAttachmentsChanged();
  };

  const handleCellUpload = async (iRowIdx: number, strKey: string, objFile: File) => {
    const strUploadId = `${iRowIdx}-${strKey}`;
    setStrUploadingKey(strUploadId);
    try {
      const objResp = await uploadAttachmentApi(objFile);
      updateRow(iRowIdx, r => {
        const objCell = getCell(r, strKey);
        return {
          ...r,
          cells: {
            ...r.cells,
            [strKey]: {
              ...objCell,
              attachments: [...objCell.attachments, objResp.attachment_id],
              _attachmentNames: [...objCell._attachmentNames, objResp.file_name],
            },
          },
        };
      });
      onAttachmentsChanged();
      if (
        objErrorField?.rowIdx === iRowIdx &&
        objErrorField?.field === 'invoice' &&
        objErrorField?.dateKey === strKey
      ) {
        setObjErrorField(null);
      }
    } catch (objErr: any) {
      onError(objErr?.response?.data?.detail || 'Failed to upload invoice. Please try again.');
    } finally {
      setStrUploadingKey('');
    }
  };

  const removeCellAttachment = (iRowIdx: number, strKey: string, iAttIdx: number) => {
    updateRow(iRowIdx, r => {
      const objCell = getCell(r, strKey);
      return {
        ...r,
        cells: {
          ...r.cells,
          [strKey]: {
            ...objCell,
            attachments: objCell.attachments.filter((_, i) => i !== iAttIdx),
            _attachmentNames: objCell._attachmentNames.filter((_, i) => i !== iAttIdx),
          },
        },
      };
    });
    onAttachmentsChanged();
  };

  const toggleCellUseSameInvoice = (iRowIdx: number, strKey: string) => {
    const r = lsRows[iRowIdx];
    const objCell = getCell(r, strKey);
    const bNew = !objCell.useSameInvoice;
    if (bNew && lsAllAttachments.length > 0) {
      setCell(iRowIdx, strKey, {
        useSameInvoice: true,
        attachments: [lsAllAttachments[0]],
        _attachmentNames: ['Shared Invoice'],
      });
    } else {
      setCell(iRowIdx, strKey, {
        useSameInvoice: false,
        attachments: [],
        _attachmentNames: [],
      });
    }
    onAttachmentsChanged();
  };

  // ── Totals ──
  const objTotals = useMemo(() => {
    const objByDate: Record<string, number> = {};
    let numGrand = 0;
    const stCats = new Set<string>();
    const stSubs = new Set<string>();
    for (const r of lsRows) {
      if (r.category_id) stCats.add(r.category_id);
      if (r.sub_category) stSubs.add(`${r.category_id}::${r.sub_category}`);
      for (const k of lsDateRange) {
        const c = getCell(r, k);
        objByDate[k] = (objByDate[k] || 0) + c.amount;
        numGrand += c.amount;
      }
    }
    const lsRowTotals = lsRows.map(r =>
      lsDateRange.reduce((s, k) => s + getCell(r, k).amount, 0),
    );
    return { objByDate, numGrand, iCatCount: stCats.size, iSubCount: stSubs.size, lsRowTotals };
  }, [lsRows, lsDateRange]);

  const errCell = (rowIdx: number, field: string, dateKey?: string) =>
    objErrorField?.rowIdx === rowIdx &&
    objErrorField?.field === field &&
    (dateKey === undefined || objErrorField?.dateKey === dateKey)
      ? 'bg-red-50 ring-2 ring-red-500/50'
      : '';

  return (
    <>
      <h2 className="text-lg font-bold text-gray-900 mb-4 flex-shrink-0 flex items-center justify-center">
        Business Trip Expense Matrix
      </h2>

      <div className="flex-1 overflow-auto custom-scrollbar">
        <table className="text-sm border-collapse" style={{ minWidth: 900 + lsDateRange.length * 120 }}>
          <thead className="sticky top-0 bg-gradient-to-r from-gray-100 to-gray-50 z-10 shadow-sm">
            <tr className="text-xs font-bold text-gray-600 uppercase">
              <th className="px-3 py-3.5 text-center border-l-2 border-r border-gray-300" style={{ width: 50 }}>
                #
              </th>
              <th className="px-3 py-3.5 text-center border-r border-gray-300" style={{ width: 200 }}>
                Category <span className="text-red-500">*</span>
              </th>
              <th className="px-3 py-3.5 text-center border-r border-gray-300" style={{ width: 150 }}>
                Sub Category
              </th>
              {lsDateRange.map(k => {
                const f = fmtDateShort(k);
                return (
                  <th
                    key={k}
                    className="px-2 py-2 text-center border-r border-gray-300"
                    style={{ width: 120 }}
                  >
                    <div className="text-[10px] text-gray-500 font-medium">{f.strDow}</div>
                    <div className="text-sm text-gray-800 font-bold">{f.strDay}</div>
                  </th>
                );
              })}
              <th
                className="px-3 py-3.5 text-center border-r border-gray-300 bg-gradient-to-r from-[#00703C]/10 to-[#00703C]/5 text-[#00703C]"
                style={{ width: 110 }}
              >
                Total
              </th>
              <th className="px-3 py-3.5 text-center border-r-2 border-gray-300" style={{ width: 40 }} />
            </tr>
          </thead>
          <tbody>
            {lsVisibleRows.map((row, iIdx) => {
              const iActualIdx = iPageStart + iIdx;
              const objCat = lsCategories.find(c => c.category_id === row.category_id);
              return (
                <tr
                  key={iActualIdx}
                  className="hover:bg-gradient-to-r hover:from-amber-50/40 hover:to-yellow-50/20 transition-all border-b border-gray-100"
                >
                  <td className="px-3 py-3 text-center text-xs font-bold text-gray-400 border-l-2 border-r border-gray-200">
                    {iActualIdx + 1}
                  </td>

                  <td className={`px-3 py-3 border-r border-gray-200 transition-all ${errCell(iActualIdx, 'category')}`}>
                    <StyledDropdown
                      value={row.category_id}
                      onChange={val => {
                        updateRow(iIdx, r => ({ ...r, category_id: val, sub_category: '' }));
                        if (objErrorField?.rowIdx === iActualIdx && objErrorField?.field === 'category') {
                          setObjErrorField(null);
                        }
                      }}
                      options={lsCategories.map(c => ({
                        value: c.category_id,
                        label: `${c.name} (₹${c.max_limit.toLocaleString('en-IN')})`,
                      }))}
                      placeholder="— Select Category —"
                    />
                  </td>

                  <td className="px-3 py-3 border-r border-gray-200 text-center">
                    {objCat && objCat.sub_categories.length > 0 ? (
                      <StyledDropdown
                        value={row.sub_category}
                        onChange={val => updateRow(iIdx, r => ({ ...r, sub_category: val }))}
                        options={objCat.sub_categories.map(s => ({ value: s, label: s }))}
                        placeholder="— None —"
                      />
                    ) : (
                      <span className="text-gray-300 text-xs italic">N/A</span>
                    )}
                  </td>

                  {lsDateRange.map(k => {
                    const cell = getCell(row, k);
                    const strUploadId = `${iIdx}-${k}`;
                    return (
                      <td
                        key={k}
                        className={`px-2 py-2 border-r border-gray-200 transition-all align-top ${errCell(iActualIdx, 'amount', k)} ${errCell(iActualIdx, 'invoice', k)}`}
                      >
                        <div className="flex flex-col gap-1.5">
                          <div className="relative">
                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-[10px] font-semibold">
                              ₹
                            </span>
                            <input
                              type="number"
                              min="0"
                              step="1"
                              value={cell.amount || ''}
                              onChange={e => {
                                const iVal = parseInt(e.target.value);
                                setCell(iActualIdx, k, { amount: !isNaN(iVal) && iVal > 0 ? iVal : 0 });
                                if (
                                  objErrorField?.rowIdx === iActualIdx &&
                                  objErrorField?.field === 'amount' &&
                                  objErrorField?.dateKey === k
                                ) {
                                  setObjErrorField(null);
                                }
                              }}
                              className="w-full px-2 pl-5 py-1.5 border border-gray-300 rounded text-xs text-right focus:outline-none focus:ring-2 focus:ring-[#00703C] focus:border-[#00703C] hover:border-[#00703C]/50"
                              placeholder="-"
                            />
                          </div>

                          {cell.amount > 0 && (
                            <>
                              {!cell.useSameInvoice && (
                                <label className="flex items-center justify-center gap-1 px-1.5 py-1 text-[10px] font-semibold border border-dashed border-[#00703C]/40 rounded hover:border-[#00703C] hover:bg-[#00703C]/5 cursor-pointer text-[#00703C]">
                                  <Paperclip className="w-3 h-3" />
                                  {strUploadingKey === strUploadId
                                    ? 'Uploading…'
                                    : cell.attachments.length > 0
                                    ? '+ More'
                                    : 'Invoice'}
                                  <input
                                    type="file"
                                    accept="image/*,application/pdf,.docx"
                                    disabled={strUploadingKey === strUploadId}
                                    onChange={e => {
                                      const f = e.target.files?.[0];
                                      if (f) {
                                        handleCellUpload(iActualIdx, k, f);
                                        e.target.value = '';
                                      }
                                    }}
                                    className="hidden"
                                  />
                                </label>
                              )}
                              {cell.attachments.length > 0 && (
                                <div className="flex flex-wrap gap-1">
                                  {cell._attachmentNames.map((nm, j) => (
                                    <div
                                      key={j}
                                      className="flex items-center gap-1 text-[10px] bg-green-50 px-1.5 py-0.5 rounded border border-green-200"
                                      title={nm}
                                    >
                                      <Paperclip className="w-2.5 h-2.5 text-green-600" />
                                      <span className="truncate max-w-[50px] text-green-700 font-medium">
                                        {nm}
                                      </span>
                                      <button
                                        onClick={() => removeCellAttachment(iActualIdx, k, j)}
                                        className="text-red-400 hover:text-red-600"
                                      >
                                        <X className="w-2.5 h-2.5" />
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              )}
                              {lsAllAttachments.length > 0 && cell.attachments.length === 0 && (
                                <label className="flex items-center gap-1 text-[10px] cursor-pointer px-1 hover:bg-gray-50 rounded">
                                  <input
                                    type="checkbox"
                                    checked={cell.useSameInvoice}
                                    onChange={() => toggleCellUseSameInvoice(iActualIdx, k)}
                                    className="w-3 h-3 text-[#00703C] border border-gray-300 rounded focus:ring-[#00703C] cursor-pointer"
                                  />
                                  <span className="text-gray-600">Same</span>
                                </label>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    );
                  })}

                  <td className="px-3 py-3 text-right border-r border-gray-200 bg-gradient-to-r from-[#00703C]/5 to-transparent font-bold text-[#00703C]">
                    ₹{objTotals.lsRowTotals[iActualIdx].toLocaleString('en-IN')}
                  </td>

                  <td className="px-2 py-3 text-center border-r-2 border-gray-200">
                    {lsRows.length > 1 && (
                      <button
                        onClick={() => removeRow(iActualIdx)}
                        className="w-7 h-7 rounded flex items-center justify-center text-red-400 hover:bg-red-50 hover:text-red-600 mx-auto transition-all"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="sticky bottom-0 bg-gradient-to-r from-[#00703C] to-[#005a30] text-white z-10">
            <tr className="text-xs font-bold">
              <td className="px-3 py-3 text-center border-l-2 border-r border-[#005a30]">Σ</td>
              <td className="px-3 py-3 text-center border-r border-[#005a30]">
                {objTotals.iCatCount} categor{objTotals.iCatCount === 1 ? 'y' : 'ies'}
              </td>
              <td className="px-3 py-3 text-center border-r border-[#005a30]">
                {objTotals.iSubCount} sub-cat{objTotals.iSubCount === 1 ? '' : 's'}
              </td>
              {lsDateRange.map(k => (
                <td key={k} className="px-2 py-3 text-right border-r border-[#005a30]">
                  ₹{(objTotals.objByDate[k] || 0).toLocaleString('en-IN')}
                </td>
              ))}
              <td className="px-3 py-3 text-right border-r border-[#005a30] bg-white/10 text-base">
                ₹{objTotals.numGrand.toLocaleString('en-IN')}
              </td>
              <td className="px-2 py-3 border-r-2 border-[#005a30]" />
            </tr>
          </tfoot>
        </table>
      </div>
    </>
  );
}

/** Validate matrix rows. */
export function validateMatrixRows(
  lsRows: MatrixRow[],
  lsDateRange: string[],
  lsCategories: Category[],
  _strDescription: string,
): { error: string; rowIdx: number; field: string; dateKey?: string } | null {
  let bHasAny = false;
  for (let i = 0; i < lsRows.length; i++) {
    const r = lsRows[i];
    const lsFilled = lsDateRange.filter(k => getCell(r, k).amount > 0);
    const bRowHasData = !!r.category_id || lsFilled.length > 0;
    if (!bRowHasData) continue;
    if (!r.category_id) return { error: `Row ${i + 1}: Please select a category`, rowIdx: i, field: 'category' };
    const objCat = lsCategories.find(c => c.category_id === r.category_id);
    for (const k of lsFilled) {
      const cell = getCell(r, k);
      if (objCat && cell.amount > objCat.max_limit) {
        return {
          error: `Row ${i + 1}: Amount on ${k} exceeds category limit (₹${objCat.max_limit.toLocaleString()})`,
          rowIdx: i,
          field: 'amount',
          dateKey: k,
        };
      }
      if (cell.attachments.length === 0) {
        return { error: `Row ${i + 1}: Please attach an invoice for ${k}`, rowIdx: i, field: 'invoice', dateKey: k };
      }
      bHasAny = true;
    }
  }
  if (!bHasAny) {
    return { error: 'Please enter at least one expense amount', rowIdx: 0, field: 'category' };
  }
  return null;
}

/** Convert matrix → flat ReimbursementItem[] (one item per filled cell). */
export function matrixToItems(lsRows: MatrixRow[], lsDateRange: string[]): ReimbursementItem[] {
  const lsItems: ReimbursementItem[] = [];
  for (const r of lsRows) {
    if (!r.category_id) continue;
    for (const k of lsDateRange) {
      const cell = getCell(r, k);
      if (cell.amount <= 0) continue;
      lsItems.push({
        category_id: r.category_id,
        sub_category: r.sub_category || undefined,
        amount: cell.amount,
        expense_date: k,
        attachments: cell.attachments,
      });
    }
  }
  return lsItems;
}

/** Flatten all attachment ids across the matrix (for preview pane). */
export function matrixAllAttachmentIds(lsRows: MatrixRow[]): string[] {
  const ls: string[] = [];
  for (const r of lsRows) {
    for (const k of Object.keys(r.cells)) {
      for (const id of r.cells[k].attachments) ls.push(id);
    }
  }
  return ls;
}
