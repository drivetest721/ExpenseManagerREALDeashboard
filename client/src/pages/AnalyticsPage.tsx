/**
 * AnalyticsPage — Owner/CA dashboard: KPI tiles, status donut, monthly trend,
 * category & department spend, top spenders.
 */
import { useEffect, useState } from 'react';
import { TrendingUp, Wallet, Clock, CheckCircle2, BarChart3, Trophy, RefreshCw } from 'lucide-react';
import { AppHeader } from '../components/AppHeader';
import { Footer } from '../components/Footer';
import { InfoButton } from '../components/common/InfoButton';
import BarChart from '../components/Analytics/BarChart';
import DonutChart from '../components/Analytics/DonutChart';
import LineChart from '../components/Analytics/LineChart';
import {
  getAnalyticsSummaryApi,
  getAnalyticsByStatusApi,
  getAnalyticsByCategoryApi,
  getAnalyticsByDepartmentApi,
  getAnalyticsMonthlyTrendApi,
  getAnalyticsTopSpendersApi,
} from '../utils/analyticsApi';
import type {
  AnalyticsSummary,
  StatusBucket,
  CategoryBucket,
  DepartmentBucket,
  MonthlyTrendPoint,
  TopSpender,
} from '../types/analytics';

const STATUS_COLORS: Record<string, string> = {
  DRAFT: '#9ca3af',
  SUBMITTED: '#3b82f6',
  IN_REVIEW: '#6366f1',
  QUERY_RAISED: '#f59e0b',
  PRIVATE_ASK: '#a855f7',
  REAPPLIED: '#0ea5e9',
  OWNER_APPROVED: '#10b981',
  CA_PENDING: '#14b8a6',
  CA_QUERY: '#f97316',
  CA_REAPPLIED: '#06b6d4',
  PAID: '#00703C',
  PAYMENT_ACKNOWLEDGED: '#059669',
  REJECTED: '#ef4444',
  AUTO_REJECTED: '#dc2626',
  CLOSED: '#6b7280',
};

const fnCurrency = (n: number) =>
  '₹' + Math.round(n).toLocaleString('en-IN');

export default function AnalyticsPage() {
  const [objSummary, setObjSummary] = useState<AnalyticsSummary | null>(null);
  const [lsStatus, setLsStatus] = useState<StatusBucket[]>([]);
  const [lsCategory, setLsCategory] = useState<CategoryBucket[]>([]);
  const [lsDept, setLsDept] = useState<DepartmentBucket[]>([]);
  const [lsTrend, setLsTrend] = useState<MonthlyTrendPoint[]>([]);
  const [lsTopSpenders, setLsTopSpenders] = useState<TopSpender[]>([]);
  const [bIsLoading, setBIsLoading] = useState<boolean>(true);
  const [strError, setStrError] = useState<string>('');
  const [nReloadKey, setNReloadKey] = useState<number>(0);

  useEffect(() => {
    let bCancelled = false;
    async function loadAll() {
      setBIsLoading(true);
      setStrError('');
      try {
        const [oSum, lsS, lsC, lsD, lsT, lsTop] = await Promise.all([
          getAnalyticsSummaryApi(),
          getAnalyticsByStatusApi(),
          getAnalyticsByCategoryApi(),
          getAnalyticsByDepartmentApi(),
          getAnalyticsMonthlyTrendApi(6),
          getAnalyticsTopSpendersApi(5),
        ]);
        if (bCancelled) return;
        setObjSummary(oSum);
        setLsStatus(lsS);
        setLsCategory(lsC);
        setLsDept(lsD);
        setLsTrend(lsT);
        setLsTopSpenders(lsTop);
      } catch (objErr: any) {
        if (!bCancelled) setStrError(objErr?.response?.data?.detail || 'Failed to load analytics');
      } finally {
        if (!bCancelled) setBIsLoading(false);
      }
    }
    loadAll();
    return () => { bCancelled = true; };
  }, [nReloadKey]);

  const lsKpis = [
    { strLabel: 'Total Spend', strValue: objSummary ? fnCurrency(objSummary.amounts.total) : '₹0', strSub: 'submitted + approved', icon: Wallet, strBorder: 'border-l-[#00703C]', strIconBg: 'bg-green-100 text-green-700' },
    { strLabel: 'Pending', strValue: objSummary ? fnCurrency(objSummary.amounts.pending) : '₹0', strSub: `${objSummary?.totals.pending ?? 0} in queue`, icon: Clock, strBorder: 'border-l-amber-500', strIconBg: 'bg-amber-100 text-amber-700' },
    { strLabel: 'Paid Out', strValue: objSummary ? fnCurrency(objSummary.amounts.paid) : '₹0', strSub: `${objSummary?.totals.paid ?? 0} closed`, icon: CheckCircle2, strBorder: 'border-l-blue-500', strIconBg: 'bg-blue-100 text-blue-700' },
    { strLabel: 'Reimbursements', strValue: objSummary ? objSummary.totals.count.toLocaleString() : '0', strSub: 'all-time', icon: BarChart3, strBorder: 'border-l-purple-500', strIconBg: 'bg-purple-100 text-purple-700' },
  ];

  return (
    <>
      <AppHeader />
      <main className="min-h-screen bg-gray-50 pb-10">
        {/* Hero header */}
        <div className="bg-gradient-to-br from-[#00703C] via-[#005a30] to-[#003d20] text-white shadow-lg">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp className="w-5 h-5 text-white/80" />
                  <span className="text-xs uppercase tracking-widest text-white/70 cursor-default">Owner / CA Dashboard</span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-semibold cursor-default">Analytics Overview</h1>
                <p className="text-sm text-white/80 mt-1 cursor-default">Real-time spend, approval pipeline and team productivity metrics.</p>
              </div>
              <button onClick={() => setNReloadKey(k => k + 1)} disabled={bIsLoading}
                className="inline-flex items-center justify-center gap-1.5 px-4 h-10 text-sm font-medium bg-white/10 hover:bg-white/20 backdrop-blur-sm text-white rounded-md border border-white/20 cursor-pointer transition-colors disabled:opacity-50 shrink-0">
                <RefreshCw className={`w-4 h-4 ${bIsLoading ? 'animate-spin' : ''}`} /> Refresh
              </button>
            </div>

            {/* Featured KPI inside hero */}
            <div className="mt-6">
              <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 px-5 py-4 inline-flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                  <Wallet className="w-5 h-5 text-white" />
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide text-white/70 cursor-default">Total Spend</div>
                  <div className="text-2xl sm:text-3xl font-semibold tabular-nums cursor-default">
                    {objSummary ? fnCurrency(objSummary.amounts.total) : '₹0'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-6xl mx-auto px-4 sm:px-6 -mt-6">
          {strError && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 mb-4 cursor-default shadow-sm">{strError}</div>
          )}
          {bIsLoading && !objSummary && (
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 text-center text-sm text-gray-500 cursor-default">Loading analytics…</div>
          )}

          {!strError && objSummary && (
            <div className="space-y-6">
              {/* KPI grid: 2x2 on mobile, 4-col on desktop */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                {lsKpis.map((k) => {
                  const Icon = k.icon;
                  return (
                    <div key={k.strLabel}
                      className={`bg-white rounded-xl border border-gray-200 border-l-4 ${k.strBorder} p-4 shadow-sm hover:shadow-md transition-shadow`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-xs uppercase tracking-wide text-gray-500 cursor-default">{k.strLabel}</div>
                          <div className="mt-1 text-xl sm:text-2xl font-semibold text-gray-900 tabular-nums cursor-default truncate">{k.strValue}</div>
                          <div className="mt-1 text-xs text-gray-500 cursor-default">{k.strSub}</div>
                        </div>
                        <div className={`w-9 h-9 rounded-lg ${k.strIconBg} flex items-center justify-center shrink-0`}>
                          <Icon className="w-4 h-4" />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Status donut + monthly trend */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5 shadow-sm">
                  <div className="flex items-center gap-1.5 mb-4">
                    <h3 className="text-sm font-semibold text-gray-900 cursor-default">By Status</h3>
                    <InfoButton text="Distribution of all reimbursements across workflow states." strPlacement="right" />
                  </div>
                  <DonutChart
                    lsSlices={lsStatus.map((s) => ({
                      label: String(s.status),
                      value: s.count,
                      color: STATUS_COLORS[String(s.status)] || '#94a3b8',
                    }))}
                    strCenterLabel="Reimbursements"
                    strCenterValue={String(objSummary?.totals.count ?? 0)}
                  />
                </div>

                <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5 shadow-sm lg:col-span-2">
                  <div className="flex items-center gap-1.5 mb-4">
                    <h3 className="text-sm font-semibold text-gray-900 cursor-default">Monthly Spend</h3>
                    <span className="text-xs text-gray-400 cursor-default">· last 6 months</span>
                    <InfoButton text="Sum of approved and paid spend grouped by submission month." strPlacement="right" />
                  </div>
                  <LineChart
                    lsPoints={lsTrend.map((t) => ({ label: t.label, value: t.amount }))}
                    fnFormat={fnCurrency}
                  />
                </div>
              </div>

              {/* Category + Department */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5 shadow-sm">
                  <div className="flex items-center gap-1.5 mb-4">
                    <h3 className="text-sm font-semibold text-gray-900 cursor-default">Spend by Category</h3>
                    <InfoButton text="Top reimbursement categories by total approved spend." strPlacement="right" />
                  </div>
                  <BarChart
                    lsItems={lsCategory.slice(0, 8).map((c) => ({
                      label: c.name,
                      value: c.amount,
                      sub: `· ${c.count}`,
                    }))}
                    fnFormat={fnCurrency}
                  />
                </div>

                <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5 shadow-sm">
                  <div className="flex items-center gap-1.5 mb-4">
                    <h3 className="text-sm font-semibold text-gray-900 cursor-default">Spend by Department</h3>
                    <InfoButton text="Spend totals attributed to the initiator's primary department." strPlacement="right" />
                  </div>
                  <BarChart
                    lsItems={lsDept.slice(0, 8).map((d) => ({
                      label: d.name,
                      value: d.amount,
                      sub: `· ${d.count}`,
                    }))}
                    strColor="#3b82f6"
                    fnFormat={fnCurrency}
                  />
                </div>
              </div>

              {/* Top spenders as cards */}
              <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5 shadow-sm">
                <div className="flex items-center gap-1.5 mb-4">
                  <Trophy className="w-4 h-4 text-amber-500" />
                  <h3 className="text-sm font-semibold text-gray-900 cursor-default">Top Spenders</h3>
                  <span className="text-xs text-gray-400 cursor-default">· approved &amp; paid</span>
                  <InfoButton text="Initiators ranked by total approved + paid reimbursement value." strPlacement="right" />
                </div>
                {lsTopSpenders.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-6 cursor-default">No approved reimbursements yet.</p>
                ) : (
                  <div className="space-y-2">
                    {lsTopSpenders.map((u, i) => {
                      const lsRankTone = ['bg-amber-100 text-amber-700 border-amber-300',
                                          'bg-gray-100 text-gray-700 border-gray-300',
                                          'bg-orange-100 text-orange-700 border-orange-300'];
                      const strRank = lsRankTone[i] ?? 'bg-blue-50 text-blue-700 border-blue-200';
                      const strInitials = u.name.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase();
                      return (
                        <div key={u.user_id}
                          className="flex items-center gap-3 px-3 py-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold text-xs border ${strRank}`}>
                            #{i + 1}
                          </div>
                          <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-semibold text-xs">
                            {strInitials || '—'}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-gray-900 truncate cursor-default">{u.name}</div>
                            <div className="text-xs text-gray-500 cursor-default">{u.count} approved reimbursement{u.count !== 1 ? 's' : ''}</div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="font-semibold text-gray-900 tabular-nums cursor-default">{fnCurrency(u.amount)}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
