/**
 * SettingsPage — Admin/Owner configuration hub.
 * Tabs: Users, Departments, Categories, SLA, Holidays.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { Play, RefreshCw, AlertTriangle, CheckCircle, Clock, Users, Building2, Tag, Activity, CalendarDays, Plus } from 'lucide-react';
import { AppHeader } from '../components/AppHeader';
import { Footer } from '../components/Footer';
import { InfoButton } from '../components/common/InfoButton';
import { listSLAEventsApi, runSLACheckApi } from '../utils/slaApi';
import type { SLAEvent } from '../utils/slaApi';
import UsersPanel from '../components/Settings/UsersPanel';
import DepartmentsPanel from '../components/Settings/DepartmentsPanel';
import CategoriesPanel from '../components/Settings/CategoriesPanel';
import HolidaysPanel from '../components/Settings/HolidaysPanel';

type SettingsTab = 'users' | 'departments' | 'categories' | 'sla' | 'holidays';

const TAB_INFO: Record<SettingsTab, { icon: typeof Users; title: string; info: string }> = {
  users:       { icon: Users,        title: 'Users & Permissions', info: 'Create, edit, deactivate users. Assign departments, roles and reporting managers (approval chain).' },
  departments: { icon: Building2,    title: 'Departments',         info: 'Manage company departments. Each user belongs to one or more departments; the primary one drives the approval chain.' },
  categories:  { icon: Tag,          title: 'Reimbursement Categories', info: 'Define spendable categories with per-item limits, required invoices and assignee eligibility.' },
  sla:         { icon: Activity,     title: 'SLA Monitor',         info: 'Live view of approval & query SLAs. Run the hourly check manually and inspect overdue items.' },
  holidays:    { icon: CalendarDays, title: 'Holidays',            info: 'Company holidays excluded from SLA business-day calculations.' },
};

export default function SettingsPage() {
  const [strActiveTab, setStrActiveTab] = useState<SettingsTab>('users');

  // SLA tab state
  const [lsSLAEvents, setLsSLAEvents] = useState<SLAEvent[]>([]);
  const [bSLALoading, setBSLALoading] = useState(false);
  const [bSLARunning, setBSLARunning] = useState(false);
  const [strSLAResult, setStrSLAResult] = useState('');
  const [bShowResolved, setBShowResolved] = useState(false);

  const fetchSLAEvents = useCallback(async () => {
    setBSLALoading(true);
    try {
      const objResp = await listSLAEventsApi({ resolved: bShowResolved ? undefined : false, limit: 100 });
      setLsSLAEvents(objResp.items);
    } catch {
      setLsSLAEvents([]);
    } finally {
      setBSLALoading(false);
    }
  }, [bShowResolved]);

  useEffect(() => {
    if (strActiveTab === 'sla') fetchSLAEvents();
  }, [strActiveTab, fetchSLAEvents]);

  async function handleRunSLA() {
    setBSLARunning(true);
    setStrSLAResult('');
    try {
      const objRes = await runSLACheckApi();
      setStrSLAResult(
        `✅ Done — Reminders sent: ${objRes.reminders_sent}, Auto-rejected: ${objRes.auto_rejected}, Errors: ${objRes.errors}`
      );
      await fetchSLAEvents();
    } catch {
      setStrSLAResult('❌ SLA check failed. See server logs.');
    } finally {
      setBSLARunning(false);
    }
  }

  function formatDue(strIso: string) {
    const dt = new Date(strIso);
    const bOverdue = dt < new Date();
    return { label: dt.toLocaleString(), bOverdue };
  }

  const lsTabs: SettingsTab[] = ['users', 'departments', 'categories', 'sla', 'holidays'];
  const objActive = TAB_INFO[strActiveTab];
  const IconActive = objActive.icon;
  const createCategoryHandlerRef = useRef<(() => void) | undefined>(undefined);

  return (
    <>
      <AppHeader />
      <main className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-4">
          {/* Page heading */}
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xl sm:text-2xl font-semibold text-gray-900 cursor-default">Settings</h2>
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-purple-100 text-purple-800 border border-purple-300 cursor-default">
              Admin
            </span>
          </div>

          {/* Tabs */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <nav className="flex gap-1 border-b border-gray-200 overflow-x-auto no-scrollbar px-2">
              {lsTabs.map((id) => {
                const o = TAB_INFO[id];
                const Icon = o.icon;
                const bActive = strActiveTab === id;
                return (
                  <button
                    key={id}
                    onClick={() => setStrActiveTab(id)}
                    className={`shrink-0 px-3 sm:px-4 py-3 border-b-2 transition-colors text-sm font-medium cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                      bActive
                        ? 'border-[#00703C] text-[#00703C]'
                        : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {o.title.split(' &')[0]}
                  </button>
                );
              })}
            </nav>

            {/* Active section header (icon + title + info) */}
            <div className="px-4 sm:px-6 py-4 border-b border-gray-200 flex items-center justify-between gap-3 bg-gray-50">
              <div className="flex items-center gap-3 min-w-0">
                <div className="p-2 rounded-lg bg-[#00703C]/10 text-[#00703C] shrink-0">
                  <IconActive className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-base sm:text-lg font-semibold text-gray-900 truncate cursor-default">{objActive.title}</h3>
                  <p className="text-xs text-gray-500 hidden sm:block cursor-default">{objActive.info}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {strActiveTab === 'categories' && (
                  <button
                    type="button"
                    onClick={() => createCategoryHandlerRef.current?.()}
                    className="inline-flex items-center gap-2 rounded-lg bg-[#00703C] px-4 py-2 text-sm font-semibold text-white hover:bg-[#005a30] transition-all duration-200 shadow-sm"
                  >
                    <Plus className="w-4 h-4" /> New Category
                  </button>
                )}
                <InfoButton text={objActive.info} strSize="md" strPlacement="left" />
              </div>
            </div>

            {/* Tab content — fixed-height scroll area so the page stops growing as data grows */}
            <div className="p-4 sm:p-6 max-h-[calc(100vh-260px)] overflow-y-auto custom-scrollbar">
              {strActiveTab === 'users' && <UsersPanel />}
              {strActiveTab === 'departments' && <DepartmentsPanel />}
              {strActiveTab === 'categories' && <CategoriesPanel registerCreateHandler={(handler) => { createCategoryHandlerRef.current = handler; }} />}

              {strActiveTab === 'sla' && (
              <div>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">SLA Monitor</h3>
                  <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                    <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
                      <input type="checkbox" checked={bShowResolved} onChange={(e) => setBShowResolved(e.target.checked)} className="rounded" />
                      Show resolved
                    </label>
                    <button onClick={fetchSLAEvents} disabled={bSLALoading}
                      className="flex items-center gap-1 px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 cursor-pointer">
                      <RefreshCw className={`w-4 h-4 ${bSLALoading ? 'animate-spin' : ''}`} /> Refresh
                    </button>
                    <button onClick={handleRunSLA} disabled={bSLARunning}
                      className="flex items-center gap-1 px-3 py-1.5 text-sm bg-[#00703C] text-white rounded hover:bg-[#005a30] disabled:opacity-50 cursor-pointer">
                      <Play className="w-4 h-4" /> {bSLARunning ? 'Running…' : 'Run SLA Check'}
                    </button>
                  </div>
                </div>

                {strSLAResult && (
                  <div className="mb-4 px-4 py-2 rounded bg-green-50 border border-green-200 text-sm text-green-800">
                    {strSLAResult}
                  </div>
                )}

                <div className="mb-3 grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                  <div className="bg-blue-50 border border-blue-200 rounded p-3 text-center">
                    <p className="text-2xl font-bold text-blue-700">{lsSLAEvents.filter(e => !e.is_resolved).length}</p>
                    <p className="text-blue-600 mt-1">Open Events</p>
                  </div>
                  <div className="bg-red-50 border border-red-200 rounded p-3 text-center">
                    <p className="text-2xl font-bold text-red-700">{lsSLAEvents.filter(e => !e.is_resolved && new Date(e.due_at) < new Date()).length}</p>
                    <p className="text-red-600 mt-1">Overdue</p>
                  </div>
                  <div className="bg-yellow-50 border border-yellow-200 rounded p-3 text-center">
                    <p className="text-2xl font-bold text-yellow-700">{lsSLAEvents.filter(e => !e.is_resolved && !e.reminder_sent && new Date(e.due_at) > new Date()).length}</p>
                    <p className="text-yellow-600 mt-1">No Reminder Yet</p>
                  </div>
                </div>

                {bSLALoading ? (
                  <p className="text-sm text-gray-500 py-4 text-center">Loading SLA events…</p>
                ) : lsSLAEvents.length === 0 ? (
                  <p className="text-sm text-gray-500 py-4 text-center">No SLA events found.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm border border-gray-200 rounded">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-3 py-2 text-center text-gray-600 font-medium border-l border-r border-gray-200">Code</th>
                          <th className="px-3 py-2 text-center text-gray-600 font-medium border-r border-gray-200">Initiator</th>
                          <th className="px-3 py-2 text-center text-gray-600 font-medium border-r border-gray-200">Type</th>
                          <th className="px-3 py-2 text-center text-gray-600 font-medium border-r border-gray-200">Due At</th>
                          <th className="px-3 py-2 text-center text-gray-600 font-medium border-r border-gray-200">Status</th>
                          <th className="px-3 py-2 text-center text-gray-600 font-medium border-r border-gray-200">Reminder</th>
                        </tr>
                      </thead>
                      <tbody>
                        {lsSLAEvents.map((objEvt) => {
                          const { label, bOverdue } = formatDue(objEvt.due_at);
                          return (
                            <tr key={objEvt.event_id} className={bOverdue && !objEvt.is_resolved ? 'bg-red-50' : ''}>
                              <td className="px-3 py-2 text-center font-mono text-xs border-l border-r border-gray-200">{objEvt.reimbursement_code || objEvt.reimbursement_id.slice(-8)}</td>
                              <td className="px-3 py-2 text-center border-r border-gray-200">{objEvt.initiator_name || '—'}</td>
                              <td className="px-3 py-2 text-center border-r border-gray-200">
                                <span className={`px-2 py-0.5 rounded text-xs font-medium ${objEvt.event_type === 'REVIEW_PENDING' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'}`}>
                                  {objEvt.event_type.replace('_', ' ')}
                                </span>
                              </td>
                              <td className={`px-3 py-2 text-center text-xs border-r border-gray-200 ${bOverdue && !objEvt.is_resolved ? 'text-red-700 font-semibold' : 'text-gray-600'}`}>
                                {bOverdue && !objEvt.is_resolved && <AlertTriangle className="w-3 h-3 inline mr-1 text-red-600" />}
                                {label}
                              </td>
                              <td className="px-3 py-2 text-center border-r border-gray-200">
                                {objEvt.is_resolved
                                  ? <span className="flex items-center gap-1 text-green-700 text-xs"><CheckCircle className="w-3 h-3" />{objEvt.resolve_reason || 'resolved'}</span>
                                  : <span className="flex items-center gap-1 text-yellow-700 text-xs"><Clock className="w-3 h-3" />open</span>}
                              </td>
                              <td className="px-3 py-2 text-center text-xs text-gray-600 border-r border-gray-200">{objEvt.reminder_sent ? '✅ sent' : '—'}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

              {strActiveTab === 'holidays' && <HolidaysPanel />}
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
