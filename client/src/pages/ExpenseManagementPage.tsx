/**
 * ExpenseManagementPage — main hub for reimbursement management.
 * Collapsible sections: Personal Reimbursement (Draft/Pending/History).
 * Each section renders a table: Category | Sub Category | Amount | Status |
 *   Date of Application | Date of Payment | View.
 */
import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ChevronDown, ChevronRight, ChevronUp, FileText, Clock, BookOpen,
  UserCheck, RefreshCw, Users, Plus, CheckCircle2, BarChart2, Calendar, ChevronLeft,
} from 'lucide-react';
import { AppHeader } from '../components/AppHeader';
import { Footer } from '../components/Footer';
import { InfoButton } from '../components/common/InfoButton';
import { listMyReimbursementsApi, listTeamReimbursementsApi } from '../utils/reimbursementApi';
import type { ReimbursementListItem } from '../types/reimbursement';
import { useAuth } from '../hooks/useAuth';
import FormTypeSelectionModal from '../components/Reimbursement/FormTypeSelectionModal';


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
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
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
  const [bShowNewModal, setBShowNewModal] = useState<boolean>(false);

  // Per-section column sort state
  const [dictSort, setDictSort] = useState<Record<string, { col: string; dir: 'asc' | 'desc' }>>({});

  // Expense Report state
  const [strReportFrom, setStrReportFrom] = useState<string>('');
  const [strReportTo, setStrReportTo] = useState<string>('');
  const [bShowReport, setBShowReport] = useState<boolean>(false);

  // Track expanded reimbursements for detail view: { reimbursement_id -> true/false }
  const [dictExpandedReimbursements, setDictExpandedReimbursements] = useState<Record<string, boolean>>({});

  // Handle ref param from notifications (open detail in new tab)
  useEffect(() => {
    const strRefId = searchParams.get('ref');
    if (strRefId) {
      window.open(`/expense/detail/${strRefId}`, '_blank');
      // Clear the ref param without navigating
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('ref');
      navigate({ search: newParams.toString() }, { replace: true });
    }
  }, [searchParams, navigate]);

  // Show Team section only for users in reviewer roles
  const bShowTeam = !!objUser && (objUser.departments || []).some(
    (d) => ['owner', 'manager', 'senior_manager', 'ca'].includes(d.role)
  );

  useEffect(() => {
    fetchAll();
  }, [bShowTeam]);

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
      console.log('Fetched drafts:', lsResults[0]);
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

  // Sort helpers
  function getSortState(strKey: string) {
    return dictSort[strKey] ?? { col: 'date', dir: 'desc' as 'asc' | 'desc' };
  }
  function toggleSort(strKey: string, strCol: string) {
    setDictSort(prev => {
      const cur = prev[strKey] ?? { col: 'date', dir: 'desc' as 'asc' | 'desc' };
      return { ...prev, [strKey]: { col: strCol, dir: cur.col === strCol && cur.dir === 'asc' ? 'desc' : 'asc' } };
    });
  }

  const STATUS_COLORS: Record<string, string> = {
    // Grey — saved but not yet acted on
    DRAFT: 'bg-gray-100 text-gray-600 border border-gray-300',
    // Blue — in motion through the approval pipeline
    SUBMITTED: 'bg-blue-100 text-blue-700',
    IN_REVIEW: 'bg-blue-100 text-blue-700',
    // Yellow — query raised, awaiting applicant response
    QUERY_RAISED: 'bg-yellow-100 text-yellow-700',
    PRIVATE_ASK: 'bg-yellow-100 text-yellow-700',
    CA_QUERY: 'bg-yellow-100 text-yellow-700',
    // Amber / yellowish — query answered, resubmitted
    REAPPLIED: 'bg-amber-100 text-amber-700',
    CA_REAPPLIED: 'bg-amber-100 text-amber-700',
    // Green — approved or paid
    OWNER_APPROVED: 'bg-green-100 text-green-700',
    CA_PENDING: 'bg-green-100 text-green-700',
    PAID: 'bg-emerald-100 text-emerald-700',
    PAYMENT_ACKNOWLEDGED: 'bg-emerald-100 text-emerald-700',
    CLOSED: 'bg-emerald-100 text-emerald-700',
    // Red — rejected
    REJECTED: 'bg-red-100 text-red-700',
    AUTO_REJECTED: 'bg-red-200 text-red-800',
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
    } else if (s === 'PRIVATE_ASK' || s==="QUERY_RAISED") {
      strDisplay = 'QUERY';
    } else {
      strDisplay = s.replace(/_/g, ' ');
    }
    return (
      <span className={`px-2 py-0.5 rounded text-xs font-semibold whitespace-nowrap ${STATUS_COLORS[s] ?? 'bg-gray-100 text-gray-700'}`}>
        {strDisplay}
      </span>
    );
  }

  /**
   * Unified table renderer used by all 6 sections - CONSOLIDATED VIEW
   * Shows one row per reimbursement with:
   * - Sr No
   * - All items' categories separated by comma
   * - All items' sub_categories separated by comma
   * - Description of first item
   * - Date (from first item)
   * - Total Amount
   * - Expand button to show individual items
   *
   * @param lsItems        — source data
   * @param strKey         — unique key for per-section sort state
   * @param bShowInitiator — show Applicant column (team views)
   * @param bShowStatus    — show Status column (false for Drafts)
   * @param bIsHistory     — show Date of Payment column (History only)
   */
  function renderReimbTable(
    lsItems: ReimbursementListItem[],
    strKey: string,
    bShowInitiator: boolean,
    bShowStatus: boolean,
    bIsHistory: boolean,
  ) {
    if (lsItems.length === 0) return null;

    const { col: strSortCol, dir: strSortDir } = getSortState(strKey);

    // Sort reimbursements
    const lsSorted = [...lsItems].sort((a, b) => {
      let nCmp = 0;
      switch (strSortCol) {
        case 'applicant': nCmp = (a.initiator_name ?? '').localeCompare(b.initiator_name ?? ''); break;
        case 'category':  nCmp = (a.items[0]?.category_name ?? '').localeCompare(b.items[0]?.category_name ?? ''); break;
        case 'sub':       nCmp = (a.items[0]?.sub_category ?? '').localeCompare(b.items[0]?.sub_category ?? ''); break;
        case 'desc':      nCmp = (a.description ?? '').localeCompare(b.description ?? ''); break;
        case 'status':    nCmp = (a.status ?? '').localeCompare(b.status ?? ''); break;
        case 'date':      nCmp = (a.created_at ?? '').localeCompare(b.created_at ?? ''); break;
        case 'payment':   nCmp = (a.updated_at ?? '').localeCompare(b.updated_at ?? ''); break;
        case 'amount':    nCmp = a.total_amount - b.total_amount; break;
      }
      return strSortDir === 'asc' ? nCmp : -nCmp;
    });

    /** Sortable column header */
    function thSort(strLabel: string, strCol: string, strAlign: 'center' | 'right' = 'center') {
      const bActive = strSortCol === strCol;
      return (
        <th
          key={strCol}
          onClick={() => toggleSort(strKey, strCol)}
          className={`px-4 py-3 text-${strAlign} whitespace-nowrap border-r border-gray-200
            cursor-pointer select-none hover:bg-gray-200/70 transition-colors group`}
        >
          <span className="inline-flex items-center justify-center gap-1">
            {strLabel}
            <span className={`inline-flex flex-col -space-y-1.5 transition-opacity ${bActive ? 'opacity-100' : 'opacity-20 group-hover:opacity-50'}`}>
              <ChevronUp className={`w-2.5 h-2.5 ${bActive && strSortDir === 'asc' ? 'text-[#00703C]' : 'text-gray-500'}`} />
              <ChevronDown className={`w-2.5 h-2.5 ${bActive && strSortDir === 'desc' ? 'text-[#00703C]' : 'text-gray-500'}`} />
            </span>
          </span>
        </th>
      );
    }

    return (
      <div className="space-y-0">
        {lsSorted.map((reimb, iIdx) => {
          const bPaid = PAID_STATUSES.has(reimb.status);
          const bExpanded = dictExpandedReimbursements[reimb.reimbursement_id] ?? false;
          
          // Consolidate categories, sub-categories, descriptions from all items
          const lsCategories = (reimb.items ?? []).map(it => it.category_name || it.category_id || '—');
          const lsSubCategories = (reimb.items ?? []).map(it => it.sub_category || '—');
          const strCombinedCategories = [...new Set(lsCategories)].join(', ');
          const strCombinedSubCategories = [...new Set(lsSubCategories)].join(', ');
          const strFirstDesc = (reimb.items?.[0]?.description) || '';
          const strFirstDate = reimb.created_at; // Use first item's date or reimbursement date

          return (
            <div key={reimb.reimbursement_id} className="border border-gray-200 rounded-lg overflow-hidden mb-3">
              {/* Main Row - Summary */}
              <div
                onClick={() => setDictExpandedReimbursements(prev => ({ ...prev, [reimb.reimbursement_id]: !bExpanded }))}
                className="bg-white hover:bg-blue-50/50 transition-colors cursor-pointer"
              >
                <table className="w-full text-sm border-collapse">
                  <thead>
                    {iIdx === 0 && (
                      <tr className="bg-gray-100/80 text-xs font-bold text-gray-500 uppercase tracking-wider">
                        <th className="px-4 py-3 text-center whitespace-nowrap border-r border-gray-200 w-14">Sr No</th>
                        {bShowInitiator && (
                          <th className="px-4 py-3 text-center whitespace-nowrap border-r border-gray-200">Applicant</th>
                        )}
                        <th className="px-4 py-3 text-center whitespace-nowrap border-r border-gray-200">Categories</th>
                        <th className="px-4 py-3 text-center whitespace-nowrap border-r border-gray-200">Sub Categories</th>
                        <th className="px-4 py-3 text-center whitespace-nowrap border-r border-gray-200">Description</th>
                        {bShowStatus && (
                          <th className="px-4 py-3 text-center whitespace-nowrap border-r border-gray-200">Status</th>
                        )}
                        <th className="px-4 py-3 text-center whitespace-nowrap border-r border-gray-200">Date Applied</th>
                        {bIsHistory && (
                          <th className="px-4 py-3 text-center whitespace-nowrap border-r border-gray-200">Date of Payment</th>
                        )}
                        <th className="px-4 py-3 text-right whitespace-nowrap border-r border-gray-200">Amount</th>
                        <th className="px-4 py-3 text-center whitespace-nowrap w-12">Expand</th>
                      </tr>
                    )}
                  </thead>
                  <tbody>
                    <tr className={`border-t border-gray-200 ${iIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                      {/* Sr No */}
                      <td className="px-4 py-3 text-center text-gray-700 font-semibold whitespace-nowrap border-r border-gray-200">
                        {iIdx + 1}
                      </td>
                      
                      {/* Applicant (for team views) */}
                      {bShowInitiator && (
                        <td className="px-4 py-3 text-center whitespace-nowrap border-r border-gray-200">
                          <span className="text-xs font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full">
                            {reimb.initiator_name}
                          </span>
                        </td>
                      )}
                      
                      {/* Combined Categories */}
                      <td className="px-4 py-3 text-center text-gray-800 font-medium whitespace-nowrap border-r border-gray-200 max-w-xs">
                        <span className="text-xs">{strCombinedCategories}</span>
                      </td>
                      
                      {/* Combined Sub Categories */}
                      <td className="px-4 py-3 text-center text-gray-600 whitespace-nowrap border-r border-gray-200 max-w-xs">
                        <span className="text-xs">{strCombinedSubCategories}</span>
                      </td>
                      
                      {/* Description of First Item */}
                      <td className="px-4 py-3 text-center text-gray-600 border-r border-gray-200 max-w-xs" title={strFirstDesc || undefined}>
                        <span className="block truncate text-xs">
                          {strFirstDesc || <span className="text-gray-300 italic">—</span>}
                        </span>
                      </td>
                      
                      {/* Status */}
                      {bShowStatus && (
                        <td className="px-4 py-3 text-center whitespace-nowrap border-r border-gray-200">
                          {statusBadge(reimb.status)}
                        </td>
                      )}
                      
                      {/* Date Applied */}
                      <td className="px-4 py-3 text-center text-gray-600 whitespace-nowrap border-r border-gray-200">
                        {fmtDate(strFirstDate)}
                      </td>
                      
                      {/* Date of Payment (History only) */}
                      {bIsHistory && (
                        <td className="px-4 py-3 text-center whitespace-nowrap border-r border-gray-200">
                          {bPaid
                            ? <span className="inline-flex items-center gap-1 text-emerald-700 font-medium text-xs">
                                <CheckCircle2 className="w-3.5 h-3.5" /> {fmtDate(reimb.updated_at)}
                              </span>
                            : <span className="text-gray-400 italic text-xs">Pending</span>
                          }
                        </td>
                      )}
                      
                      {/* Total Amount */}
                      <td className="px-4 py-3 text-right font-semibold text-gray-900 tabular-nums whitespace-nowrap border-r border-gray-200">
                        {fmtAmt(reimb.total_amount)}
                      </td>
                      
                      {/* Expand Button */}
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setDictExpandedReimbursements(prev => ({ ...prev, [reimb.reimbursement_id]: !bExpanded }));
                          }}
                          className="inline-flex items-center justify-center w-8 h-8 rounded-full hover:bg-gray-200 transition-colors"
                          title={bExpanded ? 'Collapse' : 'Expand'}
                        >
                          {bExpanded ? <ChevronUp className="w-4 h-4 text-gray-600" /> : <ChevronDown className="w-4 h-4 text-gray-600" />}
                        </button>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Expanded Details - Show all individual items */}
              {bExpanded && (reimb.items ?? []).length > 0 && (
                <div className="border-t border-gray-200 bg-gray-50 p-4">
                  <div className="mb-3">
                    <h5 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                      <ChevronLeft className="w-4 h-4" /> Individual Items ({(reimb.items ?? []).length})
                    </h5>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs border-collapse">
                      <thead>
                        <tr className="bg-gray-200 text-gray-700 font-semibold">
                          <th className="px-3 py-2 text-center border border-gray-300">Item #</th>
                          <th className="px-3 py-2 text-center border border-gray-300">Category</th>
                          <th className="px-3 py-2 text-center border border-gray-300">Sub Category</th>
                          <th className="px-3 py-2 text-center border border-gray-300">Description</th>
                          <th className="px-3 py-2 text-center border border-gray-300">Date</th>
                          <th className="px-3 py-2 text-right border border-gray-300">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(reimb.items ?? []).map((item, itemIdx) => (
                          <tr key={itemIdx} className={itemIdx % 2 === 0 ? 'bg-white' : 'bg-gray-100'}>
                            <td className="px-3 py-2 text-center border border-gray-300 font-medium text-gray-600">
                              {itemIdx + 1}
                            </td>
                            <td className="px-3 py-2 text-center border border-gray-300">
                              {item.category_name || item.category_id || '—'}
                            </td>
                            <td className="px-3 py-2 text-center border border-gray-300">
                              {item.sub_category || '—'}
                            </td>
                            <td className="px-3 py-2 text-center border border-gray-300 max-w-xs" title={item.description || undefined}>
                              <span className="block truncate">{item.description || '—'}</span>
                            </td>
                            <td className="px-3 py-2 text-center border border-gray-300">
                              {fmtDate(item.expense_date)}
                            </td>
                            <td className="px-3 py-2 text-right border border-gray-300 font-semibold tabular-nums">
                              {fmtAmt(item.amount)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="bg-emerald-100 font-semibold text-emerald-900">
                          <td colSpan={5} className="px-3 py-2 text-right border border-gray-300">
                            Total:
                          </td>
                          <td className="px-3 py-2 text-right border border-gray-300 tabular-nums">
                            {fmtAmt(reimb.total_amount)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                  <div className="mt-3 flex justify-center">
                    <button
                      onClick={() => navigate(`/expense/detail/${reimb.reimbursement_id}`)}
                      className="px-4 py-2 bg-[#00703C] text-white text-xs font-semibold rounded-lg hover:bg-[#005a30] transition-colors"
                    >
                      Open Full Details
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
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
    strSectionKey: string,        // unique key for sort state
    bShowInitiator = false,
    bShowStatus = true,           // false for Draft (all rows are DRAFT)
    bIsHistory = false,           // true → show Date of Payment column
  ) {
    const objTone = DICT_TONES[objMeta.strTone];
    const { IconHead } = objMeta;
    return (
      <div className={`border border-gray-200 border-l-4 ${objTone.strBar} rounded-2xl mb-3 bg-white shadow-sm overflow-hidden`}>
        <div
          role="button"
          tabIndex={0}
          onClick={fnToggle}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fnToggle(); } }}
          className="w-full flex items-center justify-between px-4 sm:px-5 py-4 cursor-pointer hover:bg-gray-50 transition-colors text-left"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className={`flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center ${objTone.strIconBg} ${objTone.strIconText}`}>
              <IconHead className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h4 className="text-base font-bold text-gray-900 truncate">{objMeta.strTitle}</h4>
                <InfoButton text={objMeta.strInfo} strPlacement="bottom" asDiv />
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
        </div>

        {bExpanded && (
          <div className="border-t border-gray-100 bg-gray-50/60">
            {lsItems.length === 0 ? (
              <div className="px-4 py-6 text-center">
                <p className="text-sm text-gray-500 cursor-default">{strEmptyMsg}</p>
              </div>
            ) : (
              <div className="max-h-[520px] overflow-auto custom-scrollbar">
                {renderReimbTable(lsItems, strSectionKey, bShowInitiator, bShowStatus, bIsHistory)}
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
        <div className="max-w-[1400px] mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-xl sm:text-2xl font-bold text-gray-900 cursor-default">Expense Management</h2>
                <InfoButton
                  text="Create, submit and track your reimbursement requests. Use the collapsible sections below to review drafts, pending items and history."
                  strPlacement="right"
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
          {/* {bIsAdmin && iSLAOverdue > 0 && (
            <div className="flex items-center gap-3 bg-red-50 border border-red-300 rounded-lg px-4 py-3 mb-4">
              <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0" />
              <p className="text-sm text-red-700 font-medium">
                <span className="font-bold">{iSLAOverdue}</span> reimbursement{iSLAOverdue > 1 ? 's are' : ' is'} past their SLA deadline and will be auto-rejected on the next scheduler run.
                <a href="/settings" className="ml-2 underline text-red-700 hover:text-red-900">View in Settings → SLA</a>
              </p>
            </div>
          )} */}

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
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => setBPersonalExpanded(!bPersonalExpanded)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setBPersonalExpanded(!bPersonalExpanded); } }}
                  className="w-full flex items-center justify-between px-5 py-4 bg-gradient-to-r from-blue-100 to-blue-50 hover:from-blue-200 hover:to-blue-100 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center">
                      <FileText className="w-5 h-5 text-white" />
                    </div>
                    <div className="text-left">
                      <div className = " grid grid-cols-[auto_1fr] gap-2">
                        <h3 className="text-lg font-bold text-gray-900 pr-4">Personal Reimbursement</h3>
                      <InfoButton
                      text="Your own reimbursements grouped by status: drafts you can edit, items awaiting approval, and completed records."
                      strPlacement="bottom"
                      asDiv
                    />
                      </div>
                      
                      <p className="text-xs text-gray-600">Your own reimbursements - drafts, pending, and history</p>
                    </div>
                    
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
                </div>

                {bPersonalExpanded && (
                  <div className="p-4 bg-white">
                    {renderCollapsibleSection(
                      { strTitle: 'Draft', strSubtitle: 'Saved but not yet submitted', strInfo: 'Drafts are private to you. Edit, delete, or submit them when ready.', IconHead: FileText, strTone: 'gray' },
                      lsDrafts.length,
                      bDraftExpanded,
                      () => setBDraftExpanded(!bDraftExpanded),
                      lsDrafts,
                      'No drafts yet. Click "New Reimbursement" to create one.',
                      'draft',        // strSectionKey
                      false,          // bShowInitiator
                      false,          // bShowStatus — all are DRAFT, column not needed
                      false,          // bIsHistory
                    )}

                    {renderCollapsibleSection(
                      { strTitle: 'Pending', strSubtitle: 'Awaiting approval from reviewers', strInfo: 'These submissions are moving through your approval chain.', IconHead: Clock, strTone: 'amber' },
                      lsPending.length,
                      bPendingExpanded,
                      () => setBPendingExpanded(!bPendingExpanded),
                      lsPending,
                      'No pending reimbursements.',
                      'pending',      // strSectionKey
                      false,          // bShowInitiator
                      true,           // bShowStatus
                      false,          // bIsHistory
                    )}

                    {renderCollapsibleSection(
                      { strTitle: 'History', strSubtitle: 'Completed, rejected, or closed records', strInfo: 'A record of your finalized reimbursements for reference.', IconHead: BookOpen, strTone: 'slate' },
                      lsHistory.length,
                      bHistoryExpanded,
                      () => setBHistoryExpanded(!bHistoryExpanded),
                      lsHistory,
                      'No completed reimbursements yet.',
                      'history',      // strSectionKey
                      false,          // bShowInitiator
                      true,           // bShowStatus
                      true,           // bIsHistory — show Date of Payment
                    )}
                  </div>
                )}
              </div>

              {/* Team Reimbursement Section — Collapsible with Green Background */}
              {bShowTeam && (
                <div className="mb-6 bg-green-50 rounded-xl border-2 border-green-200 overflow-hidden shadow-sm">
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => setBTeamExpanded(!bTeamExpanded)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setBTeamExpanded(!bTeamExpanded); } }}
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
                        asDiv
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
                  </div>

                  {bTeamExpanded && (
                    <div className="p-4 bg-white">
                      {renderCollapsibleSection(
                        { strTitle: 'Pending My Approval', strSubtitle: 'Awaiting your action', strInfo: 'Submissions currently parked at your stage of the approval chain.', IconHead: UserCheck, strTone: 'indigo' },
                        lsTeamPendingApprovals.length,
                        bTeamPAExpanded,
                        () => setBTeamPAExpanded(!bTeamPAExpanded),
                        lsTeamPendingApprovals,
                        'Nothing waiting on you right now.',
                        'team-approval',  // strSectionKey
                        true,             // bShowInitiator
                        true,             // bShowStatus
                        false,            // bIsHistory
                      )}

                      {renderCollapsibleSection(
                        { strTitle: 'Pending Completion', strSubtitle: 'With other reviewers', strInfo: 'Items you can see but cannot act on — they are with someone else in the chain.', IconHead: RefreshCw, strTone: 'cyan' },
                        lsTeamPendingCompletion.length,
                        bTeamPCExpanded,
                        () => setBTeamPCExpanded(!bTeamPCExpanded),
                        lsTeamPendingCompletion,
                        'No items currently with other reviewers.',
                        'team-pending',   // strSectionKey
                        true,             // bShowInitiator
                        true,             // bShowStatus
                        false,            // bIsHistory
                      )}

                      {renderCollapsibleSection(
                        { strTitle: 'Team History', strSubtitle: 'Reimbursements created by your team members', strInfo: 'Finalized reimbursements submitted by people who report to you.', IconHead: BookOpen, strTone: 'teal' },
                        lsTeamHistory.length,
                        bTeamHistExpanded,
                        () => setBTeamHistExpanded(!bTeamHistExpanded),
                        lsTeamHistory,
                        'No completed team reimbursements yet.',
                        'team-history',   // strSectionKey
                        true,             // bShowInitiator
                        true,             // bShowStatus
                        true,             // bIsHistory — show Date of Payment
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* ── Expense Report ────────────────────────────────────── */}
              
              {/* <div className="mt-6">
                
                <div className="border border-gray-200 border-l-4 border-l-[#00703C] rounded-2xl bg-white shadow-sm overflow-hidden">
                  <div className="px-4 sm:px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center bg-emerald-100 text-[#00703C]">
                        <BarChart2 className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-base font-bold text-gray-900">Expense Summary</h4>
                        <p className="text-xs text-gray-500 mt-0.5">Category × date breakdown with totals</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 cursor-pointer">
                        <Calendar className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                        <label className="text-xs text-gray-500 whitespace-nowrap">From</label>
                        <input
                          type="date"
                          value={strReportFrom}
                          onChange={(e) => { setStrReportFrom(e.target.value); setBShowReport(false); }}
                          className="text-xs bg-transparent outline-none text-gray-800 cursor-pointer"
                        />
                      </div>
                      <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 cursor-pointer">
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

                  {bShowReport && (
                    <div className="border-t border-gray-100 p-4 sm:p-5">
                      <p className="text-xs text-gray-400 mb-3 cursor-default">
                        Showing expense items from <span className="font-semibold text-gray-600">{strReportFrom}</span> to <span className="font-semibold text-gray-600">{strReportTo}</span>
                      </p>
                      {renderExpenseReport()}
                    </div>
                  )}
                </div>
              </div> */}

            </>
          )}
        </div>
      </main>
      <Footer />

      {/* Modals */}
      {bShowNewModal && (
        <FormTypeSelectionModal
          bIsOpen={bShowNewModal}
          onClose={() => setBShowNewModal(false)}
        />
      )}
    </>
  );
}
