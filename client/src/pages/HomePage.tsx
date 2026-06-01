/**
 * HomePage — Main dashboard landing page with summary cards.
 * Displays: Total Received, Pending Amount, Total Filed, Success Rate.
 * Each card is clickable and expands to show related reimbursements.
 */
import { useEffect, useState } from 'react';
import { AppHeader } from '../components/AppHeader';
import { Footer } from '../components/Footer';
import { ErrorCard } from '../components/ErrorCard';
import { InfoButton } from '../components/common/InfoButton';
import { listMyReimbursementsApi } from '../utils/reimbursementApi';
import type { ReimbursementListItem } from '../types/reimbursement';
import { Wallet, Clock, FileText, TrendingUp, ChevronDown, ChevronUp } from 'lucide-react';

// ── Types ────────────────────────────────────────────────────────────────────

interface SummaryCard {
  key: string;
  title: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  bgColor: string;
  iconColor: string;
  info: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const PAID_STATUSES = new Set(['PAID', 'PAYMENT_ACKNOWLEDGED', 'CLOSED']);
const PENDING_STATUSES = new Set(['SUBMITTED', 'IN_REVIEW', 'QUERY_RAISED', 'PRIVATE_ASK', 'REAPPLIED', 'OWNER_APPROVED', 'CA_PENDING', 'CA_QUERY', 'CA_REAPPLIED']);
const REJECTED_STATUSES = new Set(['REJECTED', 'AUTO_REJECTED']);

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-700',
  SUBMITTED: 'bg-blue-100 text-blue-700',
  IN_REVIEW: 'bg-yellow-100 text-yellow-700',
  QUERY_RAISED: 'bg-orange-100 text-orange-700',
  PRIVATE_ASK: 'bg-orange-100 text-orange-700',
  REAPPLIED: 'bg-blue-100 text-blue-700',
  OWNER_APPROVED: 'bg-green-100 text-green-700',
  CA_PENDING: 'bg-purple-100 text-purple-700',
  CA_QUERY: 'bg-orange-100 text-orange-700',
  CA_REAPPLIED: 'bg-blue-100 text-blue-700',
  PAID: 'bg-emerald-100 text-emerald-700',
  PAYMENT_ACKNOWLEDGED: 'bg-teal-100 text-teal-700',
  REJECTED: 'bg-red-100 text-red-700',
  AUTO_REJECTED: 'bg-red-200 text-red-800',
  CLOSED: 'bg-gray-200 text-gray-600',
};

function fmtDate(str?: string | null) {
  if (!str) return '—';
  const d = new Date(str);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function fmtAmt(n: number) {
  // Indian lakh notation: x,xx,xxx
  return `₹${Math.round(n).toLocaleString('en-IN')}`;
}

function statusBadge(s: string) {
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-semibold whitespace-nowrap ${STATUS_COLORS[s] ?? 'bg-gray-100 text-gray-700'}`}>
      {s === 'AUTO_REJECTED' ? '⏰ AUTO REJECTED' : s.replace(/_/g, ' ')}
    </span>
  );
}

// ── Component ────────────────────────────────────────────────────────────────

export default function HomePage() {
  const [lsAll, setLsAll] = useState<ReimbursementListItem[]>([]);
  const [bLoading, setBLoading] = useState<boolean>(true);
  const [objError, setObjError] = useState<Error | null>(null);

  // Expanded card state
  const [strExpanded, setStrExpanded] = useState<string | null>(null);

  useEffect(() => {
    let bIsMounted = true;
    setBLoading(true);
    listMyReimbursementsApi() // Fetch all reimbursements
      .then((lsData) => {
        if (bIsMounted) setLsAll(lsData);
      })
      .catch((objErr: unknown) => {
        if (bIsMounted) {
          setObjError(objErr instanceof Error ? objErr : new Error('Failed to load reimbursements'));
        }
      })
      .finally(() => {
        if (bIsMounted) setBLoading(false);
      });
    return () => {
      bIsMounted = false;
    };
  }, []);

  // Calculate summary statistics
  const lsPaid = lsAll.filter((r) => PAID_STATUSES.has(r.status));
  const lsPending = lsAll.filter((r) => PENDING_STATUSES.has(r.status));
  const lsRejected = lsAll.filter((r) => REJECTED_STATUSES.has(r.status));
  const lsFiled = lsAll.filter((r) => r.status !== 'DRAFT');

  const iTotalReceived = lsPaid.reduce((sum, r) => sum + r.total_amount, 0);
  const iPendingAmount = lsPending.reduce((sum, r) => sum + r.total_amount, 0);
  const iTotalFiled = lsFiled.length;
  const fSuccessRate = lsFiled.length > 0 ? (lsPaid.length / lsFiled.length) * 100 : 0;

  const lsCards: SummaryCard[] = [
    {
      key: 'received',
      title: 'Total Received',
      value: fmtAmt(iTotalReceived),
      icon: Wallet,
      bgColor: 'bg-green-50',
      iconColor: 'text-green-600',
      info: 'Total amount of reimbursements that have been paid and acknowledged.',
    },
    {
      key: 'pending',
      title: 'Pending Amount',
      value: fmtAmt(iPendingAmount),
      icon: Clock,
      bgColor: 'bg-yellow-50',
      iconColor: 'text-yellow-600',
      info: 'Total amount of reimbursements currently under review or pending payment.',
    },
    {
      key: 'filed',
      title: 'Total Filed',
      value: iTotalFiled.toString(),
      icon: FileText,
      bgColor: 'bg-blue-50',
      iconColor: 'text-blue-600',
      info: 'Total number of reimbursements you have submitted (excluding drafts).',
    },
    {
      key: 'success',
      title: 'Success Rate',
      value: `${fSuccessRate.toFixed(1)}%`,
      icon: TrendingUp,
      bgColor: 'bg-purple-50',
      iconColor: 'text-purple-600',
      info: 'Percentage of filed reimbursements that have been successfully paid.',
    },
  ];

  function toggleCard(strKey: string) {
    setStrExpanded((s) => (s === strKey ? null : strKey));
  }

  function renderExpandedTable(strKey: string) {
    let lsFiltered: ReimbursementListItem[] = [];
    let strEmptyMsg = '';

    if (strKey === 'received') {
      lsFiltered = lsPaid;
      strEmptyMsg = 'No payments received yet.';
    } else if (strKey === 'pending') {
      lsFiltered = lsPending;
      strEmptyMsg = 'No pending reimbursements.';
    } else if (strKey === 'filed') {
      lsFiltered = lsFiled;
      strEmptyMsg = 'No reimbursements filed yet.';
    } else if (strKey === 'success') {
      lsFiltered = lsPaid;
      strEmptyMsg = 'No successful reimbursements yet.';
    }

    if (lsFiltered.length === 0) {
      return (
        <div className="px-4 py-6 text-center text-sm text-gray-500 cursor-default">
          {strEmptyMsg}
        </div>
      );
    }

    return (
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-gray-100/80 text-xs font-bold text-gray-500 uppercase tracking-wider">
              <th className="px-4 py-3 text-center cursor-default border-l border-r border-gray-200">Category</th>
              <th className="px-4 py-3 text-center cursor-default border-r border-gray-200">Sub Category</th>
              <th className="px-4 py-3 text-center cursor-default border-r border-gray-200">Status</th>
              <th className="px-4 py-3 text-center cursor-default border-r border-gray-200">Date of Application</th>
              <th className="px-4 py-3 text-right cursor-default border-r border-gray-200">Amount</th>
            </tr>
          </thead>
          <tbody>
            {lsFiltered.map((reimb) => (
              <tr key={reimb.reimbursement_id} className="bg-white hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3 text-center text-gray-800 font-medium cursor-default border-l border-r border-gray-200">
                  {reimb.items && reimb.items.length > 0 ? reimb.items[0].category_name : '—'}
                </td>
                <td className="px-4 py-3 text-center text-gray-600 cursor-default border-r border-gray-200">
                  {reimb.items && reimb.items.length > 0 ? reimb.items[0].sub_category : '—'}
                </td>
                <td className="px-4 py-3 text-center cursor-default border-r border-gray-200">{statusBadge(reimb.status)}</td>
                <td className="px-4 py-3 text-center text-gray-600 cursor-default border-r border-gray-200">{fmtDate(reimb.created_at)}</td>
                <td className="px-4 py-3 text-right font-semibold text-gray-900 tabular-nums cursor-default border-r border-gray-200">
                  {fmtAmt(reimb.total_amount)}
                </td>
              </tr>
            ))}
            {/* Show rejected entries with reason if strKey === 'filed' or 'success' */}
            {(strKey === 'filed' || strKey === 'success') &&
              lsRejected.map((reimb) => (
                <tr key={reimb.reimbursement_id} className="bg-red-50 hover:bg-red-100 transition-colors">
                  <td className="px-4 py-3 text-center text-gray-800 font-medium cursor-default border-l border-r border-gray-200">
                    {reimb.items && reimb.items.length > 0 ? reimb.items[0].category_name : '—'}
                  </td>
                  <td className="px-4 py-3 text-center text-gray-600 cursor-default border-r border-gray-200">
                    {reimb.items && reimb.items.length > 0 ? reimb.items[0].sub_category : '—'}
                  </td>
                  <td className="px-4 py-3 text-center cursor-default border-r border-gray-200">{statusBadge(reimb.status)}</td>
                  <td className="px-4 py-3 text-center text-gray-600 cursor-default border-r border-gray-200">{fmtDate(reimb.created_at)}</td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-900 tabular-nums cursor-default border-r border-gray-200">
                    {fmtAmt(reimb.total_amount)}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <>
      <AppHeader />
      <main className="min-h-screen bg-gray-50 py-6 px-4">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Logo & Title */}
          <div className="flex items-center gap-4 cursor-default">
            <img src="/favicon.png" alt="Logo" className="w-12 h-12" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Expense Management Dashboard</h1>
              <p className="text-sm text-gray-600">Your complete reimbursement overview</p>
            </div>
          </div>

          {/* Error State */}
          {objError && <ErrorCard title="Failed to load dashboard" error={objError} />}

          {/* Loading State */}
          {bLoading && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center cursor-default">
              <p className="text-sm text-gray-500">Loading your dashboard...</p>
            </div>
          )}

          {/* Summary Cards */}
          {!bLoading && !objError && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {lsCards.map((card) => {
                const Icon = card.icon;
                const bExpanded = strExpanded === card.key;
                return (
                  <div key={card.key} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                    {/* Card Header (Clickable) */}
                    <button
                      onClick={() => toggleCard(card.key)}
                      className={`w-full px-4 py-4 ${card.bgColor} flex items-center justify-between hover:opacity-80 transition-opacity cursor-pointer`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full ${card.bgColor} flex items-center justify-center border border-gray-200`}>
                          <Icon className={`w-5 h-5 ${card.iconColor}`} />
                        </div>
                        <div className="text-left">
                          <div className="text-xs font-medium text-gray-600 flex items-center gap-1">
                            {card.title}
                            <InfoButton text={card.info} strPlacement="bottom" />
                          </div>
                          <div className="text-xl font-bold text-gray-900 tabular-nums">{card.value}</div>
                        </div>
                      </div>
                      {bExpanded ? (
                        <ChevronUp className="w-5 h-5 text-gray-400" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-gray-400" />
                      )}
                    </button>

                    {/* Expanded Table */}
                    {bExpanded && (
                      <div className="border-t border-gray-200">
                        {renderExpandedTable(card.key)}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
