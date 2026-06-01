/**
 * ExpenseManagementPage — main hub for reimbursement management.
 * Collapsible sections: Personal Reimbursement (Draft/Pending/History).
 * Each section renders a table: Category | Sub Category | Amount | Status |
 *   Date of Application | Date of Payment | View.
 */
import { useState, useEffect } from 'react';
import {
  ChevronDown, ChevronRight, ChevronLeft, AlertTriangle, FileText, Clock, BookOpen,
  UserCheck, RefreshCw, Users, Plus, CheckCircle2, BarChart2, Calendar,
  Activity,
} from 'lucide-react';
import { AppHeader } from '../components/AppHeader';
import { Footer } from '../components/Footer';
import { InfoButton } from '../components/common/InfoButton';
import { listMyReimbursementsApi, listTeamReimbursementsApi, getReimbursementChainApi } from '../utils/reimbursementApi';
import type { ChainViewResponse } from '../utils/reimbursementApi';
import type { ReimbursementListItem } from '../types/reimbursement';
import ChainView from '../components/Reimbursement/ChainView';
import { useAuth } from '../hooks/useAuth';
import ReimbursementDetailModal from '../components/Reimbursement/ReimbursementDetailModal';
import FormTypeSelectionModal from '../components/Reimbursement/FormTypeSelectionModal';
import { getSLAOverdueCountApi } from '../utils/slaApi';

type SectionTone = 'gray' | 'amber' | 'slate' | 'indigo' | 'cyan' | 'teal';

interface SectionMeta {
  strTitle: string;
  strSubtitle: string;
  strInfo: string;
  IconHead: React.ComponentType<{ className?: string }>;
  strTone: SectionTone;
}

const DICT_TONES: Record<SectionTone, { strBar: string; strIconBg: string; strIconText: string; strBadge: string }> = {
  gray:   { strBar: 'border-l-gray-300',   strIconBg: 'bg-gray-100',   strIconText: 'text-gray-700',   strBadge: 'bg-gray-100 text-gray-700' },
  amber:  { strBar: 'border-l-amber-400',  strIconBg: 'bg-amber-100',  strIconText: 'text-amber-700',  strBadge: 'bg-amber-100 text-amber-700' },
  slate:  { strBar: 'border-l-slate-400',  strIconBg: 'bg-slate-100',  strIconText: 'text-slate-700',  strBadge: 'bg-slate-100 text-slate-700' },
  indigo: { strBar: 'border-l-indigo-400', strIconBg: 'bg-indigo-100', strIconText: 'text-indigo-700', strBadge: 'bg-indigo-100 text-indigo-700' },
  cyan:   { strBar: 'border-l-cyan-400',   strIconBg: 'bg-cyan-100',   strIconText: 'text-cyan-700',   strBadge: 'bg-cyan-100 text-cyan-700' },
  teal:   { strBar: 'border-l-teal-400',   strIconBg: 'bg-teal-100',   strIconText: 'text-teal-700',   strBadge: 'bg-teal-100 text-teal-700' },
};

export default function ExpenseManagementPage() {
  const { objUser } = useAuth();
  const [lsDrafts, setLsDrafts] = useState<ReimbursementListItem[]>([]);
  const [lsPending, setLsPending] = useState<ReimbursementListItem[]>([]);
  const [lsHistory, setLsHistory] = useState<ReimbursementListItem[]>([]);
  const [lsTeamPendingApprovals, setLsTeamPendingApprovals] = useState<ReimbursementListItem[]>([]);
  const [lsTeamPendingCompletion, setLsTeamPendingCompletion] = useState<ReimbursementListItem[]>([]);
  const [lsTeamHistory, setLsTeamHistory] = useState<ReimbursementListItem[]>([]);
  const [bIsLoading, setBIsLoading] = useState<boolean>(true);
  const [strError, setStrError] = useState<string>('');

  // Collapsible state for main sections (closed by default)
  const [bPersonalExpanded, setBPersonalExpanded] = useState<boolean>(false);
  const [bTeamExpanded, setBTeamExpanded] = useState<boolean>(false);

  // Collapsible state for sub-sections (closed by default as per design)
  const [bDraftExpanded, setBDraftExpanded] = useState<boolean>(false);
  const [bPendingExpanded, setBPendingExpanded] = useState<boolean>(false);
  const [bHistoryExpanded, setBHistoryExpanded] = useState<boolean>(false);
  const [bTeamPAExpanded, setBTeamPAExpanded] = useState<boolean>(false);
  const [bTeamPCExpanded, setBTeamPCExpanded] = useState<boolean>(false);
  const [bTeamHistExpanded, setBTeamHistExpanded] = useState<boolean>(false);

  // Modal state
  const [strSelectedId, setStrSelectedId] = useState<string | null>(null);
  const [bShowNewModal, setBShowNewModal] = useState<boolean>(false);

  // Expense Report state
  const [strReportFrom, setStrReportFrom] = useState<string>('');
  const [strReportTo, setStrReportTo] = useState<string>('');
  const [bShowReport, setBShowReport] = useState<boolean>(false);

  // Activity panel state (right-side, outside modal)
  const [objPanelChain, setObjPanelChain] = useState<ChainViewResponse | null>(null);
  const [bPanelLoading, setBPanelLoading] = useState<boolean>(false);
  const [bPanelCollapsed, setBPanelCollapsed] = useState<boolean>(false);

  // Fetch chain for the activity panel whenever a reimbursement is selected
  useEffect(() => {
    if (!strSelectedId) { setObjPanelChain(null); return; }
    setBPanelCollapsed(false);
    setBPanelLoading(true);
    getReimbursementChainApi(strSelectedId)
      .then(setObjPanelChain)
      .catch(() => setObjPanelChain(null))
      .finally(() => setBPanelLoading(false));
  }, [strSelectedId]);

  // SLA overdue count (admins/owners)
  const [iSLAOverdue, setISLAOverdue] = useState<number>(0);
  const bIsAdmin = !!objUser && (objUser.departments || []).some(
    (d) => ['owner', 'ca'].includes(d.role)
  );

  // Show Team section only for users in reviewer roles
  const bShowTeam = !!objUser && (objUser.departments || []).some(
    (d) => ['owner', 'manager', 'senior_manager', 'ca'].includes(d.role)
  );

  useEffect(() => {
    fetchAll();
    if (bIsAdmin) {
      getSLAOverdueCountApi().then(setISLAOverdue).catch(() => setISLAOverdue(0));
    }
  }, [bShowTeam, bIsAdmin]);

  async function fetchAll() {
    setBIsLoading(true);
    setStrError('');
    try {
      const lsPromises: Promise<any>[] = [
        listMyReimbursementsApi('draft'),
        listMyReimbursementsApi('pending'),
        listMyReimbursementsApi('history'),
      ];
      if (bShowTeam) {
        lsPromises.push(
          listTeamReimbursementsApi('pending-approvals'),
          listTeamReimbursementsApi('pending-completion'),
          listTeamReimbursementsApi('history'),
        );
      }
      const lsResults = await Promise.all(lsPromises);
      setLsDrafts(lsResults[0]);
      setLsPending(lsResults[1]);
      setLsHistory(lsResults[2]);
      if (bShowTeam) {
        setLsTeamPendingApprovals(lsResults[3]);
        setLsTeamPendingCompletion(lsResults[4]);
        setLsTeamHistory(lsResults[5]);
      }
    } catch (objErr: any) {
      setStrError(objErr.response?.data?.detail || 'Failed to load reimbursements');
    } finally {
      setBIsLoading(false);
    }
  }

  // ── helpers ─────────────────────────────────────────────────────────────────
  const STATUS_COLORS: Record<string, string> = {
    DRAFT: 'bg-gray-100 text-gray-700', SUBMITTED: 'bg-blue-100 text-blue-700',
    IN_REVIEW: 'bg-yellow-100 text-yellow-700', QUERY_RAISED: 'bg-orange-100 text-orange-700',
    PRIVATE_ASK: 'bg-orange-100 text-orange-700', REAPPLIED: 'bg-blue-100 text-blue-700',
    OWNER_APPROVED: 'bg-green-100 text-green-700', CA_PENDING: 'bg-purple-100 text-purple-700',
    CA_QUERY: 'bg-orange-100 text-orange-700', CA_REAPPLIED: 'bg-blue-100 text-blue-700',
    PAID: 'bg-emerald-100 text-emerald-700', PAYMENT_ACKNOWLEDGED: 'bg-teal-100 text-teal-700',
    REJECTED: 'bg-red-100 text-red-700', AUTO_REJECTED: 'bg-red-200 text-red-800',
    CLOSED: 'bg-gray-200 text-gray-600',
  };
  const PAID_STATUSES = new Set(['PAID', 'PAYMENT_ACKNOWLEDGED', 'CLOSED']);

  function fmtDate(str?: string | null) {
    if (!str) return '—';
    // Format as dd/mm/yyyy
    const d = new Date(str);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }
  function fmtAmt(n: number) {
    // Indian lakh notation, integer only
    return `₹${Math.round(n).toLocaleString('en-IN')}`;
  }
  function statusBadge(s: string) {
    // Replace CLOSED with final outcome
    let strDisplay = s;
    if (s === 'CLOSED' || s === 'PAYMENT_ACKNOWLEDGED' || s === 'PAID') {
      strDisplay = 'PAYMENT RECEIVED';
    } else if (s === 'AUTO_REJECTED') {
      strDisplay = '⏰ AUTO REJECTED';
    } else {
      strDisplay = s.replace(/_/g, ' ');
    }
    return (
      <span className={`px-2 py-0.5 rounded text-xs font-semibold whitespace-nowrap ${STATUS_COLORS[s] ?? 'bg-gray-100 text-gray-700'}`}>
        {strDisplay}
      </span>
    );
  }

  /** Render table for DRAFT section (no Status, no Date of Payment columns) */
  function renderDraftTable(lsItems: ReimbursementListItem[]) {
    if (lsItems.length === 0) return null;

    // Flatten: each reimbursement expands into its items (or 1 fallback row if empty)
    type FlatRow = { reimb: ReimbursementListItem; itemIdx: number; isFirst: boolean };
    const lsRows: FlatRow[] = [];
    for (const reimb of lsItems) {
      const count = (reimb.items ?? []).length;
      if (count === 0) {
        lsRows.push({ reimb, itemIdx: -1, isFirst: true });
      } else {
        reimb.items.forEach((_, i) => lsRows.push({ reimb, itemIdx: i, isFirst: i === 0 }));
      }
    }

    return (
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-gray-100/80 text-xs font-bold text-gray-500 uppercase tracking-wider">
              <th className="px-4 py-3 text-center whitespace-nowrap cursor-default border-l border-r border-gray-200">Category</th>
              <th className="px-4 py-3 text-center whitespace-nowrap cursor-default border-r border-gray-200">Sub Category</th>
              <th className="px-4 py-3 text-center whitespace-nowrap cursor-default border-r border-gray-200">Date of Application</th>
              <th className="px-4 py-3 text-right whitespace-nowrap cursor-default border-r border-gray-200">Amount</th>
              <th className="px-4 py-3 text-center whitespace-nowrap cursor-default border-r border-gray-200"></th>
            </tr>
          </thead>
          <tbody>
            {lsRows.map(({ reimb, itemIdx, isFirst }) => {
              const item = itemIdx >= 0 ? reimb.items[itemIdx] : null;
              return (
                <tr key={`${reimb.reimbursement_id}-${itemIdx}`} className="bg-white hover:bg-gray-50/60 transition-colors">
                  <td className="px-4 py-3 text-center text-gray-800 font-medium whitespace-nowrap cursor-default border-l border-r border-gray-200">
                    {item?.category_name ?? <span className="text-gray-400 italic">—</span>}
                  </td>
                  <td className="px-4 py-3 text-center text-gray-600 whitespace-nowrap cursor-default border-r border-gray-200">
                    {item?.sub_category ?? <span className="text-gray-400 italic">—</span>}
                  </td>
                  <td className="px-4 py-3 text-center text-gray-600 whitespace-nowrap cursor-default border-r border-gray-200">
                    {isFirst ? fmtDate(reimb.created_at) : null}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-900 tabular-nums whitespace-nowrap cursor-default border-r border-gray-200">
                    {fmtAmt(item ? item.amount : reimb.total_amount)}
                  </td>
                  <td className="px-4 py-3 text-center whitespace-nowrap border-r border-gray-200">
                    {isFirst ? (
                      <button
                        onClick={() => setStrSelectedId(reimb.reimbursement_id)}
                        className="text-xs px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 font-semibold cursor-pointer transition-colors"
                      >
                        View
                      </button>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  /** Render a full <table> for a section. Each item within each reimbursement is one row. */
  function renderTable(lsItems: ReimbursementListItem[], bShowInitiator = false) {
    if (lsItems.length === 0) return null;

    // Flatten: each reimbursement expands into its items (or 1 fallback row if empty)
    type FlatRow = { reimb: ReimbursementListItem; itemIdx: number; isFirst: boolean };
    const lsRows: FlatRow[] = [];
    for (const reimb of lsItems) {
      const count = (reimb.items ?? []).length;
      if (count === 0) {
        lsRows.push({ reimb, itemIdx: -1, isFirst: true });
      } else {
        reimb.items.forEach((_, i) => lsRows.push({ reimb, itemIdx: i, isFirst: i === 0 }));
      }
    }

    return (
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-gray-100/80 text-xs font-bold text-gray-500 uppercase tracking-wider">
              {bShowInitiator && <th className="px-4 py-3 text-center whitespace-nowrap cursor-default border-l border-r border-gray-200">Applicant</th>}
              <th className={`px-4 py-3 text-center whitespace-nowrap cursor-default border-r border-gray-200 ${!bShowInitiator ? 'border-l' : ''}`}>Category</th>
              <th className="px-4 py-3 text-center whitespace-nowrap cursor-default border-r border-gray-200">Sub Category</th>
              <th className="px-4 py-3 text-center whitespace-nowrap cursor-default border-r border-gray-200">Status</th>
              <th className="px-4 py-3 text-center whitespace-nowrap cursor-default border-r border-gray-200">Date of Application</th>
              <th className="px-4 py-3 text-center whitespace-nowrap cursor-default border-r border-gray-200">Date of Payment</th>
              <th className="px-4 py-3 text-right whitespace-nowrap cursor-default border-r border-gray-200">Amount</th>
              <th className="px-4 py-3 text-center whitespace-nowrap cursor-default border-r border-gray-200"></th>
            </tr>
          </thead>
          <tbody>
            {lsRows.map(({ reimb, itemIdx, isFirst }) => {
              const item = itemIdx >= 0 ? reimb.items[itemIdx] : null;
              const bPaid = PAID_STATUSES.has(reimb.status);
              return (
                <tr key={`${reimb.reimbursement_id}-${itemIdx}`} className="bg-white hover:bg-gray-50/60 transition-colors">
                  {bShowInitiator && (
                    <td className="px-4 py-3 text-center whitespace-nowrap cursor-default border-l border-r border-gray-200">
                      {isFirst ? (
                        <span className="text-xs font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full">{reimb.initiator_name}</span>
                      ) : null}
                    </td>
                  )}
                  <td className={`px-4 py-3 text-center text-gray-800 font-medium whitespace-nowrap cursor-default border-r border-gray-200 ${!bShowInitiator ? 'border-l' : ''}`}>
                    {item?.category_name ?? <span className="text-gray-400 italic">—</span>}
                  </td>
                  <td className="px-4 py-3 text-center text-gray-600 whitespace-nowrap cursor-default border-r border-gray-200">
                    {item?.sub_category ?? <span className="text-gray-400 italic">—</span>}
                  </td>
                  <td className="px-4 py-3 text-center whitespace-nowrap cursor-default border-r border-gray-200">
                    {isFirst ? statusBadge(reimb.status) : null}
                  </td>
                  <td className="px-4 py-3 text-center text-gray-600 whitespace-nowrap cursor-default border-r border-gray-200">
                    {isFirst ? fmtDate(reimb.created_at) : null}
                  </td>
                  <td className="px-4 py-3 text-center whitespace-nowrap cursor-default border-r border-gray-200">
                    {isFirst ? (
                      bPaid ? (
                        <span className="inline-flex items-center gap-1 text-emerald-700 font-medium text-xs">
                          <CheckCircle2 className="w-3.5 h-3.5" />{fmtDate(reimb.updated_at)}
                        </span>
                      ) : <span className="text-gray-400 italic text-xs">Pending</span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-900 tabular-nums whitespace-nowrap cursor-default border-r border-gray-200">
                    {fmtAmt(item ? item.amount : reimb.total_amount)}
                  </td>
                  <td className="px-4 py-3 text-center whitespace-nowrap border-r border-gray-200">
                    {isFirst ? (
                      <button
                        onClick={() => setStrSelectedId(reimb.reimbursement_id)}
                        className="text-xs px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 font-semibold cursor-pointer transition-colors"
                      >
                        View
                      </button>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  function renderCollapsibleSection(
    objMeta: SectionMeta,
    iCount: number,
    bExpanded: boolean,
    fnToggle: () => void,
    lsItems: ReimbursementListItem[],
    strEmptyMsg: string,
    bShowInitiator = false,
    bIsDraft = false,
  ) {
    const objTone = DICT_TONES[objMeta.strTone];
    const { IconHead } = objMeta;
    return (
      <div className={`border border-gray-200 border-l-4 ${objTone.strBar} rounded-2xl mb-3 bg-white shadow-sm overflow-hidden`}>
        <button
          type="button"
          onClick={fnToggle}
          className="w-full flex items-center justify-between px-4 sm:px-5 py-4 cursor-pointer hover:bg-gray-50 transition-colors text-left"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className={`flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center ${objTone.strIconBg} ${objTone.strIconText}`}>
              <IconHead className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h4 className="text-base font-bold text-gray-900 truncate">{objMeta.strTitle}</h4>
                <InfoButton text={objMeta.strInfo} strPlacement="bottom" />
              </div>
              <p className="text-xs text-gray-500 mt-0.5 truncate">{objMeta.strSubtitle}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0 ml-2">
            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold tabular-nums ${objTone.strBadge}`}>
              {iCount}
            </span>
            {bExpanded
              ? <ChevronDown className="w-5 h-5 text-gray-500" />
              : <ChevronRight className="w-5 h-5 text-gray-500" />}
          </div>
        </button>

        {bExpanded && (
          <div className="border-t border-gray-100 bg-gray-50/60">
            {lsItems.length === 0 ? (
              <div className="px-4 py-6 text-center">
                <p className="text-sm text-gray-500 cursor-default">{strEmptyMsg}</p>
              </div>
            ) : (
              <div className="max-h-[480px] overflow-auto custom-scrollbar">
                {bIsDraft ? renderDraftTable(lsItems) : renderTable(lsItems, bShowInitiator)}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  /** Build expense report: category × date matrix with row/column totals. */
  function renderExpenseReport() {
    // Combine all buckets, dedup by id
    const dictSeen: Record<string, boolean> = {};
    const lsAll: ReimbursementListItem[] = [];
    for (const r of [
      ...lsDrafts, ...lsPending, ...lsHistory,
      ...lsTeamPendingApprovals, ...lsTeamPendingCompletion, ...lsTeamHistory,
    ]) {
      if (!dictSeen[r.reimbursement_id]) {
        dictSeen[r.reimbursement_id] = true;
        lsAll.push(r);
      }
    }

    // Matrix: category → date → amount
    interface MatrixRow { strCategory: string; dictDateAmt: Record<string, number> }
    const dictMatrix: Record<string, MatrixRow> = {};
    const setDates = new Set<string>();

    for (const r of lsAll) {
      for (const it of r.items ?? []) {
        const strDate = it.expense_date ?? '';
        if (!strDate) continue;
        if (strReportFrom && strDate < strReportFrom) continue;
        if (strReportTo && strDate > strReportTo) continue;
        const strKey = it.category_name || it.category_id || 'Other';
        if (!dictMatrix[strKey]) dictMatrix[strKey] = { strCategory: strKey, dictDateAmt: {} };
        dictMatrix[strKey].dictDateAmt[strDate] = (dictMatrix[strKey].dictDateAmt[strDate] || 0) + it.amount;
        setDates.add(strDate);
      }
    }

    const lsDates = Array.from(setDates).sort();
    const lsRows = Object.values(dictMatrix).sort((a, b) => a.strCategory.localeCompare(b.strCategory));

    if (lsDates.length === 0) {
      return (
        <p className="text-gray-400 text-sm italic py-4 text-center">
          No expense items found for the selected date range.
        </p>
      );
    }

    // Compute column totals and grand total
    const dictColTotals: Record<string, number> = {};
    let fGrandTotal = 0;
    for (const d of lsDates) dictColTotals[d] = 0;
    for (const row of lsRows) {
      for (const d of lsDates) {
        const f = row.dictDateAmt[d] || 0;
        dictColTotals[d] += f;
        fGrandTotal += f;
      }
    }

    return (
      <div className="overflow-x-auto custom-scrollbar">
        <table className="text-xs border-collapse min-w-full">
          <thead>
            <tr>
              <th className="border-l border-r border-gray-300 bg-[#00703C] text-white px-3 py-2.5 text-left font-bold whitespace-nowrap sticky left-0 z-10">
                Category
              </th>
              {lsDates.map((d) => (
                <th
                  key={d}
                  className="border-r border-gray-300 bg-[#00703C] text-white px-2 py-2.5 text-center font-bold whitespace-nowrap"
                >
                  {new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })}
                </th>
              ))}
              <th className="border-r border-gray-300 bg-emerald-800 text-white px-3 py-2.5 text-right font-bold whitespace-nowrap">
                Row Total
              </th>
            </tr>
          </thead>
          <tbody>
            {lsRows.map((row, iIdx) => {
              const fRowTotal = lsDates.reduce((s, d) => s + (row.dictDateAmt[d] || 0), 0);
              return (
                <tr key={row.strCategory} className={iIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="border-l border-r border-gray-200 px-3 py-2 font-medium text-gray-800 whitespace-nowrap sticky left-0 bg-inherit z-10">
                    {row.strCategory}
                  </td>
                  {lsDates.map((d) => (
                    <td key={d} className="border-r border-gray-200 px-2 py-2 text-right tabular-nums text-gray-700 whitespace-nowrap">
                      {row.dictDateAmt[d] ? fmtAmt(row.dictDateAmt[d]) : <span className="text-gray-300">—</span>}
                    </td>
                  ))}
                  <td className="border-r border-gray-300 px-3 py-2 text-right font-bold text-emerald-800 bg-emerald-50 tabular-nums whitespace-nowrap">
                    {fmtAmt(fRowTotal)}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="bg-gray-100">
              <td className="border-l border-r border-gray-300 px-3 py-2.5 font-bold text-gray-800 sticky left-0 bg-gray-100 z-10 whitespace-nowrap">
                Daily Total
              </td>
              {lsDates.map((d) => (
                <td key={d} className="border-r border-gray-300 px-2 py-2.5 text-right font-bold tabular-nums text-gray-900 whitespace-nowrap">
                  {fmtAmt(dictColTotals[d])}
                </td>
              ))}
              <td className="border-r border-gray-300 px-3 py-2.5 text-right font-bold text-white bg-[#00703C] tabular-nums whitespace-nowrap">
                {fmtAmt(fGrandTotal)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    );
  }

  return (
    <>
      <AppHeader />
      <main className="min-h-screen bg-gray-50 py-6 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-xl sm:text-2xl font-bold text-gray-900 cursor-default">Expense Management</h2>
                <InfoButton
                  text="Create, submit and track your reimbursement requests. Use the collapsible sections below to review drafts, pending items and history."
                  strPlacement="bottom"
                  strSize="md"
                />
              </div>
              <p className="text-sm text-gray-500 mt-1 cursor-default">Review your reimbursements and team approvals at a glance.</p>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                onClick={() => fetchAll()}
                disabled={bIsLoading}
                title="Refresh"
                className="flex-shrink-0 h-10 w-10 inline-flex items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 hover:text-gray-900 disabled:opacity-50 cursor-pointer transition-colors"
              >
                <RefreshCw className={`w-4 h-4 ${bIsLoading ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={() => setBShowNewModal(true)}
                className="flex-1 sm:flex-none h-10 px-4 inline-flex items-center justify-center gap-2 bg-[#00703C] text-white rounded-xl hover:bg-[#005a30] transition-colors text-sm font-semibold shadow-sm cursor-pointer"
              >
                <Plus className="w-4 h-4" /> New Reimbursement
              </button>
            </div>
          </div>

          {/* SLA Overdue Banner — Admins / Owners only */}
          {bIsAdmin && iSLAOverdue > 0 && (
            <div className="flex items-center gap-3 bg-red-50 border border-red-300 rounded-lg px-4 py-3 mb-4">
              <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0" />
              <p className="text-sm text-red-700 font-medium">
                <span className="font-bold">{iSLAOverdue}</span> reimbursement{iSLAOverdue > 1 ? 's are' : ' is'} past their SLA deadline and will be auto-rejected on the next scheduler run.
                <a href="/settings" className="ml-2 underline text-red-700 hover:text-red-900">View in Settings → SLA</a>
              </p>
            </div>
          )}

          {strError && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded p-3 mb-4 cursor-default">
              {strError}
            </div>
          )}

          {bIsLoading && (
            <div className="flex items-center justify-center py-12">
              <p className="text-gray-600 cursor-default">Loading reimbursements...</p>
            </div>
          )}

          {!bIsLoading && (
            <>
              {/* Personal Reimbursement Section — Collapsible with Blue Background */}
              <div className="mb-6 bg-blue-50 rounded-xl border-2 border-blue-200 overflow-hidden shadow-sm">
                <button
                  onClick={() => setBPersonalExpanded(!bPersonalExpanded)}
                  className="w-full flex items-center justify-between px-5 py-4 bg-gradient-to-r from-blue-100 to-blue-50 hover:from-blue-200 hover:to-blue-100 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center">
                      <FileText className="w-5 h-5 text-white" />
                    </div>
                    <div className="text-left">
                      <h3 className="text-lg font-bold text-gray-900">Personal Reimbursement</h3>
                      <p className="text-xs text-gray-600">Your own reimbursements - drafts, pending, and history</p>
                    </div>
                    <InfoButton
                      text="Your own reimbursements grouped by status: drafts you can edit, items awaiting approval, and completed records."
                      strPlacement="bottom"
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-600 text-white">
                      {lsDrafts.length + lsPending.length + lsHistory.length}
                    </span>
                    {bPersonalExpanded ? (
                      <ChevronDown className="w-6 h-6 text-gray-700" />
                    ) : (
                      <ChevronRight className="w-6 h-6 text-gray-700" />
                    )}
                  </div>
                </button>

                {bPersonalExpanded && (
                  <div className="p-4 bg-white">
                    {renderCollapsibleSection(
                      { strTitle: 'Draft', strSubtitle: 'Saved but not yet submitted', strInfo: 'Drafts are private to you. Edit, delete, or submit them when ready.', IconHead: FileText, strTone: 'gray' },
                      lsDrafts.length,
                      bDraftExpanded,
                      () => setBDraftExpanded(!bDraftExpanded),
                      lsDrafts,
                      'No drafts yet. Click "New Reimbursement" to create one.',
                      false,
                      true, // bIsDraft = true
                    )}

                    {renderCollapsibleSection(
                      { strTitle: 'Pending', strSubtitle: 'Awaiting approval from reviewers', strInfo: 'These submissions are moving through your approval chain.', IconHead: Clock, strTone: 'amber' },
                      lsPending.length,
                      bPendingExpanded,
                      () => setBPendingExpanded(!bPendingExpanded),
                      lsPending,
                      'No pending reimbursements.'
                    )}

                    {renderCollapsibleSection(
                      { strTitle: 'History', strSubtitle: 'Completed, rejected, or closed records', strInfo: 'A record of your finalized reimbursements for reference.', IconHead: BookOpen, strTone: 'slate' },
                      lsHistory.length,
                      bHistoryExpanded,
                      () => setBHistoryExpanded(!bHistoryExpanded),
                      lsHistory,
                      'No completed reimbursements yet.'
                    )}
                  </div>
                )}
              </div>

              {/* Team Reimbursement Section — Collapsible with Green Background */}
              {bShowTeam && (
                <div className="mb-6 bg-green-50 rounded-xl border-2 border-green-200 overflow-hidden shadow-sm">
                  <button
                    onClick={() => setBTeamExpanded(!bTeamExpanded)}
                    className="w-full flex items-center justify-between px-5 py-4 bg-gradient-to-r from-green-100 to-green-50 hover:from-green-200 hover:to-green-100 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-green-600 flex items-center justify-center">
                        <Users className="w-5 h-5 text-white" />
                      </div>
                      <div className="text-left">
                        <h3 className="text-lg font-bold text-gray-900">Team Reimbursement</h3>
                        <p className="text-xs text-gray-600">Your team's reimbursements - approvals and history</p>
                      </div>
                      <InfoButton
                        text="Reimbursements from your team: items needing your approval, items with other reviewers, and team history."
                        strPlacement="bottom"
                      />
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="px-3 py-1 rounded-full text-xs font-semibold bg-green-600 text-white">
                        {lsTeamPendingApprovals.length + lsTeamPendingCompletion.length + lsTeamHistory.length}
                      </span>
                      {bTeamExpanded ? (
                        <ChevronDown className="w-6 h-6 text-gray-700" />
                      ) : (
                        <ChevronRight className="w-6 h-6 text-gray-700" />
                      )}
                    </div>
                  </button>

                  {bTeamExpanded && (
                    <div className="p-4 bg-white">
                      {renderCollapsibleSection(
                        { strTitle: 'Pending My Approval', strSubtitle: 'Awaiting your action', strInfo: 'Submissions currently parked at your stage of the approval chain.', IconHead: UserCheck, strTone: 'indigo' },
                        lsTeamPendingApprovals.length,
                        bTeamPAExpanded,
                        () => setBTeamPAExpanded(!bTeamPAExpanded),
                        lsTeamPendingApprovals,
                        'Nothing waiting on you right now.',
                        true,
                      )}

                      {renderCollapsibleSection(
                        { strTitle: 'Pending Completion', strSubtitle: 'With other reviewers', strInfo: 'Items you can see but cannot act on — they are with someone else in the chain.', IconHead: RefreshCw, strTone: 'cyan' },
                        lsTeamPendingCompletion.length,
                        bTeamPCExpanded,
                        () => setBTeamPCExpanded(!bTeamPCExpanded),
                        lsTeamPendingCompletion,
                        'No items currently with other reviewers.',
                        true,
                      )}

                      {renderCollapsibleSection(
                        { strTitle: 'Team History', strSubtitle: 'Reimbursements created by your team members', strInfo: 'Finalized reimbursements submitted by people who report to you.', IconHead: BookOpen, strTone: 'teal' },
                        lsTeamHistory.length,
                        bTeamHistExpanded,
                        () => setBTeamHistExpanded(!bTeamHistExpanded),
                        lsTeamHistory,
                        'No completed team reimbursements yet.',
                        true,
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* ── Expense Report ────────────────────────────────────── */}
              <div className="mt-6">
                <div className="border border-gray-200 border-l-4 border-l-[#00703C] rounded-2xl bg-white shadow-sm overflow-hidden">
                  {/* Header */}
                  <div className="px-4 sm:px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center bg-emerald-100 text-[#00703C]">
                        <BarChart2 className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-base font-bold text-gray-900">Expense Report</h4>
                        <p className="text-xs text-gray-500 mt-0.5">Category × date breakdown with totals</p>
                      </div>
                    </div>
                    {/* Date range controls */}
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5">
                        <Calendar className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                        <label className="text-xs text-gray-500 whitespace-nowrap">From</label>
                        <input
                          type="date"
                          value={strReportFrom}
                          onChange={(e) => { setStrReportFrom(e.target.value); setBShowReport(false); }}
                          className="text-xs bg-transparent outline-none text-gray-800 cursor-pointer"
                        />
                      </div>
                      <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5">
                        <Calendar className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                        <label className="text-xs text-gray-500 whitespace-nowrap">To</label>
                        <input
                          type="date"
                          value={strReportTo}
                          min={strReportFrom || undefined}
                          onChange={(e) => { setStrReportTo(e.target.value); setBShowReport(false); }}
                          className="text-xs bg-transparent outline-none text-gray-800 cursor-pointer"
                        />
                      </div>
                      <button
                        onClick={() => { if (strReportFrom && strReportTo) setBShowReport(true); }}
                        disabled={!strReportFrom || !strReportTo}
                        className="h-8 px-4 rounded-lg bg-[#00703C] text-white text-xs font-semibold hover:bg-[#005a30] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors whitespace-nowrap"
                      >
                        Generate
                      </button>
                      {bShowReport && (
                        <button
                          onClick={() => setBShowReport(false)}
                          className="h-8 px-3 rounded-lg bg-gray-100 text-gray-600 text-xs font-medium hover:bg-gray-200 cursor-pointer transition-colors"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Report table */}
                  {bShowReport && (
                    <div className="border-t border-gray-100 p-4 sm:p-5">
                      <p className="text-xs text-gray-400 mb-3 cursor-default">
                        Showing expense items from <span className="font-semibold text-gray-600">{strReportFrom}</span> to <span className="font-semibold text-gray-600">{strReportTo}</span>
                      </p>
                      {renderExpenseReport()}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </main>
      <Footer />

      {/* Modals */}
      {strSelectedId && (
        <ReimbursementDetailModal
          strReimbursementId={strSelectedId}
          onClose={() => { setStrSelectedId(null); fetchAll(); }}
          onDeleted={() => { setStrSelectedId(null); fetchAll(); }}
          onChainUpdate={setObjPanelChain}
        />
      )}

      {bShowNewModal && (
        <FormTypeSelectionModal
          bIsOpen={bShowNewModal}
          onClose={() => setBShowNewModal(false)}
        />
      )}

      {/* ── Activity & Chain panel — fixed right side, outside the modal ── */}
      {strSelectedId && (
        <div
          className={`fixed top-0 right-0 h-screen bg-white border-l border-gray-200 shadow-2xl z-[60] flex flex-col transition-[width] duration-200 ease-in-out ${
            bPanelCollapsed ? 'w-10' : 'w-80 lg:w-96'
          }`}
        >
          {/* Collapse / expand tab on the left edge */}
          <button
            onClick={() => setBPanelCollapsed(!bPanelCollapsed)}
            title={bPanelCollapsed ? 'Expand activity panel' : 'Collapse activity panel'}
            className="absolute -left-8 top-1/2 -translate-y-1/2 w-8 h-16 bg-white border border-r-0 border-gray-200 rounded-l-lg flex items-center justify-center shadow-md cursor-pointer hover:bg-gray-50 transition-colors"
          >
            {bPanelCollapsed
              ? <ChevronLeft className="w-4 h-4 text-gray-500" />
              : <ChevronRight className="w-4 h-4 text-gray-500" />}
          </button>

          {/* Collapsed label */}
          {bPanelCollapsed && (
            <div className="flex-1 flex items-center justify-center overflow-hidden">
              <span
                className="text-xs text-gray-400 font-medium whitespace-nowrap select-none"
                style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
              >
                Activity &amp; Chain
              </span>
            </div>
          )}

          {/* Expanded content */}
          {!bPanelCollapsed && (
            <>
              {/* Panel header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 flex-shrink-0 bg-white">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-[#00703C]" />
                  <h3 className="text-sm font-bold text-gray-900">Activity &amp; Chain</h3>
                </div>
                <button
                  onClick={() => setBPanelCollapsed(true)}
                  className="text-gray-400 hover:text-gray-600 cursor-pointer transition-colors"
                  title="Collapse panel"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              {/* Panel body */}
              <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                {bPanelLoading && (
                  <p className="text-sm text-gray-400 text-center py-10">Loading…</p>
                )}
                {!bPanelLoading && objPanelChain && (
                  <ChainView
                    lsChain={objPanelChain.approval_chain}
                    iCurrentStep={objPanelChain.current_step}
                    strCurrentReviewerId={objPanelChain.current_reviewer_id}
                    lsLogs={objPanelChain.logs}
                  />
                )}
                {!bPanelLoading && !objPanelChain && (
                  <p className="text-sm text-gray-400 text-center py-10">No chain data.</p>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
