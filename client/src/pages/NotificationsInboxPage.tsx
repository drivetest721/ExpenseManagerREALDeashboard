/**
 * NotificationsInboxPage — full-page inbox view of all notifications.
 * Tabs: All / Unread / Read / Starred / Important / Others / Archived.
 * Header tools: speaker (sound toggle), refresh, filter, mark-all-read.
 * Search by title/message/reimbursement code. Group-by-Reimbursement toggle.
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell, RefreshCw, CheckCheck, Search, Layers,
  Star, AlertTriangle, Archive as ArchiveIcon, ChevronDown, ChevronRight,
} from 'lucide-react';
import { AppHeader } from '../components/AppHeader';
import { Footer } from '../components/Footer';
import { listNotificationsApi, markReadApi, type Notification } from '../utils/notificationApi';
import {
  getNotifMeta, TONE_CLASSES, timeAgo, starStore, archiveStore,
} from '../utils/notificationUi';
import NotificationDetailModal from '../components/Notifications/NotificationDetailModal';

type TabKey = 'all' | 'unread' | 'read' | 'starred' | 'important' | 'others' | 'archived';

export default function NotificationsInboxPage() {
  const navigate = useNavigate();
  const [lsAll, setLsAll] = useState<Notification[]>([]);
  const [bLoading, setBLoading] = useState<boolean>(true);
  const [strActiveTab, setStrActiveTab] = useState<TabKey>('all');
  const [strQuery, setStrQuery] = useState<string>('');
  const [bGroup, setBGroup] = useState<boolean>(false);
  const [setStarred, setSetStarred] = useState<Set<string>>(() => starStore.load());
  const [setArchived, setSetArchived] = useState<Set<string>>(() => archiveStore.load());
  const [setChecked, setSetChecked] = useState<Set<string>>(new Set());
  const [setCollapsed, setSetCollapsed] = useState<Set<string>>(new Set());
  const [objOpen, setObjOpen] = useState<Notification | null>(null);
  const [setTypeFilter] = useState<Set<string>>(new Set());

  const fetchAll = async () => {
    setBLoading(true);
    try {
      const objResp = await listNotificationsApi(200, false);
      setLsAll(objResp.notifications);
    } finally { setBLoading(false); }
  };
  useEffect(() => { fetchAll(); }, []);

  function toggleCheck(strId: string) {
    setSetChecked(prev => {
      const s = new Set(prev);
      if (s.has(strId)) s.delete(strId); else s.add(strId);
      return s;
    });
  }
  function toggleStar(strId: string) { setSetStarred(starStore.toggle(strId)); }
  function toggleCollapsed(strKey: string) {
    setSetCollapsed(prev => {
      const s = new Set(prev);
      if (s.has(strKey)) s.delete(strKey); else s.add(strKey);
      return s;
    });
  }

  const lsByTab = useMemo(() => {
    let ls = lsAll.filter(n => !setArchived.has(n.notification_id));
    if (strActiveTab === 'unread')        ls = ls.filter(n => !n.is_read);
    else if (strActiveTab === 'read')     ls = ls.filter(n =>  n.is_read);
    else if (strActiveTab === 'starred')  ls = ls.filter(n => setStarred.has(n.notification_id));
    else if (strActiveTab === 'important') ls = ls.filter(n => getNotifMeta(n.type).severity === 'important');
    else if (strActiveTab === 'others')   ls = ls.filter(n => getNotifMeta(n.type).severity !== 'important');
    else if (strActiveTab === 'archived') ls = lsAll.filter(n => setArchived.has(n.notification_id));
    const q = strQuery.trim().toLowerCase();
    if (q) ls = ls.filter(n => n.title.toLowerCase().includes(q) || (n.message || '').toLowerCase().includes(q) || (n.reimbursement_id || '').toLowerCase().includes(q));
    if (setTypeFilter.size > 0) ls = ls.filter(n => setTypeFilter.has(n.type));
    return ls;
  }, [lsAll, strActiveTab, strQuery, setStarred, setArchived, setTypeFilter]);

  const iUnread = lsAll.filter(n => !n.is_read && !setArchived.has(n.notification_id)).length;
  const iImportant = lsAll.filter(n => getNotifMeta(n.type).severity === 'important' && !setArchived.has(n.notification_id)).length;
  const iOthers = lsAll.filter(n => getNotifMeta(n.type).severity !== 'important' && !setArchived.has(n.notification_id)).length;
  const iArchived = setArchived.size;
  const iRead = lsAll.filter(n => n.is_read && !setArchived.has(n.notification_id)).length;
  const iStarred = lsAll.filter(n => setStarred.has(n.notification_id) && !setArchived.has(n.notification_id)).length;

  const TABS: { key: TabKey; label: string; count?: number; Icon?: React.ComponentType<{ className?: string }> }[] = [
    { key: 'all',       label: 'All' },
    { key: 'unread',    label: 'Unread',    count: iUnread },
    { key: 'read',      label: 'Read',      count: iRead },
    { key: 'starred',   label: 'Starred',   count: iStarred, Icon: Star },
    { key: 'important', label: 'Important', count: iImportant, Icon: AlertTriangle },
    { key: 'others',    label: 'Others',    count: iOthers },
    { key: 'archived',  label: 'Archived',  count: iArchived, Icon: ArchiveIcon },
  ];

  async function handleMarkAll() {
    await markReadApi([], true);
    await fetchAll();
  }
  async function openOne(n: Notification) {
    if (!n.is_read) {
      try { await markReadApi([n.notification_id], false); } catch { /* ignore */ }
      setLsAll(ls => ls.map(x => x.notification_id === n.notification_id ? { ...x, is_read: true } : x));
    }
    setObjOpen({ ...n, is_read: true });
    console.log('📖 Opened notification:', n);
  }

  const grouped = useMemo(() => {
    if (!bGroup) return null;
    const m = new Map<string, Notification[]>();
    for (const n of lsByTab) {
      const k = n.reimbursement_id || 'No reference';
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(n);
    }
    return Array.from(m.entries());
  }, [bGroup, lsByTab]);

  return (
    <>
      <AppHeader />
      <main className="min-h-screen bg-gray-50 py-6 px-4">
        <div className="max-w-6xl mx-auto bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">

          {/* ── Page header ── */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-5 sm:px-6 py-4 border-b border-gray-200">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-[#00703C]/10 text-[#00703C] flex items-center justify-center shrink-0"><Bell className="w-5 h-5" /></div>
              <div className="min-w-0">
                <h2 className="text-lg sm:text-xl font-bold text-gray-900 cursor-default">Inbox</h2>
                <p className="text-xs text-gray-500 cursor-default">{iUnread} unread</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {/* <button onClick={toggleSound} aria-label="Sound" title={bSound ? 'Sound on' : 'Sound off'} className="w-9 h-9 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-500 cursor-pointer">
                {bSound ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
              </button> */}
              <button onClick={fetchAll} disabled={bLoading} aria-label="Refresh" title="Refresh" className="w-9 h-9 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-500 cursor-pointer disabled:opacity-50">
                <RefreshCw className={`w-5 h-5 ${bLoading ? 'animate-spin' : ''}`} />
              </button>
              {/* <div className="relative" ref={refFilter}>
                <button onClick={() => setBFilterOpen(b => !b)} aria-label="Filter" title="Filter by type" className={`w-9 h-9 rounded-lg flex items-center justify-center cursor-pointer transition-colors ${setTypeFilter.size > 0 || bFilterOpen ? 'bg-[#00703C]/10 text-[#00703C]' : 'hover:bg-gray-100 text-gray-500'}`}>
                  <Filter className="w-5 h-5" />
                  {setTypeFilter.size > 0 && <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#00703C] text-white text-[10px] flex items-center justify-center font-bold">{setTypeFilter.size}</span>}
                </button>
                {bFilterOpen && (
                  <div className="absolute right-0 top-10 z-30 bg-white border border-gray-200 rounded-xl shadow-lg w-56 p-2">
                    <div className="flex items-center justify-between px-2 py-1 mb-1">
                      <span className="text-xs font-semibold text-gray-700">Filter by Type</span>
                      {setTypeFilter.size > 0 && <button onClick={() => setSetTypeFilter(new Set())} className="text-xs text-red-500 hover:text-red-700 cursor-pointer">Clear</button>}
                    </div>
                    {['REJECTED','QUERY_RAISED','CA_QUERY','PAID','ACKNOWLEDGED','APPROVAL_PROGRESS','APPROVAL_PENDING','REAPPLIED','CA_REAPPLIED','PRIVATE_ASK'].map(t => {
                      const bOn = setTypeFilter.has(t);
                      return (
                        <label key={t} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50 cursor-pointer">
                          <input type="checkbox" checked={bOn} onChange={() => setSetTypeFilter(prev => { const s = new Set(prev); bOn ? s.delete(t) : s.add(t); return s; })} className="cursor-pointer" />
                          <span className="text-sm text-gray-700">{t.replace(/_/g, ' ')}</span>
                        </label>
                      );
                    })}
                    <button onClick={() => setBFilterOpen(false)} className="w-full mt-1 py-1.5 text-xs font-medium text-[#00703C] hover:bg-[#00703C]/5 rounded-lg cursor-pointer">Done</button>
                  </div>
                )}
              </div> */}
              <button onClick={handleMarkAll} disabled={iUnread === 0} className="ml-1 inline-flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-[#00703C] hover:bg-[#00703C]/5 rounded-lg cursor-pointer disabled:text-gray-400 disabled:cursor-not-allowed">
                <CheckCheck className="w-4 h-4" /> Mark all as read
              </button>
            </div>
          </div>

          {/* ── Tabs ── */}
          <div className="px-2 sm:px-4 border-b border-gray-200 overflow-x-auto no-scrollbar">
            <nav className="flex gap-1 min-w-max">
              {TABS.map(t => {
                const bActive = strActiveTab === t.key;
                return (
                  <button key={t.key} onClick={() => setStrActiveTab(t.key)} className={`flex items-center gap-1.5 px-3 sm:px-4 py-3 text-sm font-medium border-b-2 cursor-pointer whitespace-nowrap transition-colors ${bActive ? 'border-[#00703C] text-[#00703C]' : 'border-transparent text-gray-600 hover:text-gray-900'}`}>
                    {t.Icon && <t.Icon className="w-4 h-4" />}
                    {t.label}
                    {typeof t.count === 'number' && t.count > 0 && (
                      <span className={`ml-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${bActive ? 'bg-[#00703C]/10 text-[#00703C]' : 'bg-red-100 text-red-700'}`}>{t.count}</span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* ── Search + Group ── */}
          <div className="px-4 sm:px-6 py-4 flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              <input value={strQuery} onChange={e => setStrQuery(e.target.value)} placeholder="Search by title, message, reimbursement reference…" className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:border-[#00703C] transition-colors" />
            </div>
            <button onClick={() => setBGroup(b => !b)} className={`inline-flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-medium border rounded-lg cursor-pointer transition-colors ${bGroup ? 'border-[#00703C] bg-[#00703C]/5 text-[#00703C]' : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'}`}>
              <Layers className="w-4 h-4" /> Group by Reimbursement
            </button>
          </div>

          {/* ── Count strip ── */}
          <div className="px-4 sm:px-6 py-2 flex items-center gap-3 border-t border-gray-100 text-xs text-gray-500 bg-gray-50/50">
            <input type="checkbox" className="cursor-pointer" checked={lsByTab.length > 0 && lsByTab.every(n => setChecked.has(n.notification_id))} onChange={e => setSetChecked(e.target.checked ? new Set(lsByTab.map(n => n.notification_id)) : new Set())} />
            <span className="cursor-default">{lsByTab.length} notification{lsByTab.length !== 1 ? 's' : ''}</span>
          </div>

          {/* ── List ── */}
          <div className="max-h-[calc(100vh-380px)] overflow-y-auto custom-scrollbar">
            {bLoading && lsByTab.length === 0 && <p className="px-6 py-10 text-center text-sm text-gray-500">Loading notifications…</p>}
            {!bLoading && lsByTab.length === 0 && <p className="px-6 py-10 text-center text-sm text-gray-500">No notifications in this view.</p>}

            {!bGroup && lsByTab.map(n => (
              <InboxRow key={n.notification_id} n={n} bChecked={setChecked.has(n.notification_id)} bStar={setStarred.has(n.notification_id)} onToggle={() => toggleCheck(n.notification_id)} onStar={() => toggleStar(n.notification_id)} onOpen={() => openOne(n)} />
            ))}
            {bGroup && grouped && grouped.map(([strKey, ls]) => {
              const bNoRef = strKey === 'No reference';
              const strLabel = bNoRef ? 'No reimbursement reference' : `RB-${strKey.slice(-5).toUpperCase()}`;
              const bOpen = !setCollapsed.has(strKey);
              const iGroupUnread = ls.filter(n => !n.is_read).length;
              return (
                <div key={strKey}>
                  <button
                    type="button"
                    onClick={() => toggleCollapsed(strKey)}
                    className="w-full flex items-center gap-2 px-4 sm:px-6 py-2.5 bg-gray-100/70 hover:bg-gray-200/60 text-left cursor-pointer transition-colors border-b border-gray-200 sticky top-0"
                  >
                    {bOpen ? <ChevronDown className="w-4 h-4 text-gray-500" /> : <ChevronRight className="w-4 h-4 text-gray-500" />}
                    <span className={`text-xs font-bold ${bNoRef ? 'text-gray-600' : 'text-[#00703C]'}`}>{strLabel}</span>
                    <span className="text-xs text-gray-500">· {ls.length} notification{ls.length !== 1 ? 's' : ''}</span>
                    {iGroupUnread > 0 && (
                      <span className="ml-auto px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-100 text-blue-700">{iGroupUnread} unread</span>
                    )}
                  </button>
                  {bOpen && ls.map(n => (
                    <InboxRow key={n.notification_id} n={n} bChecked={setChecked.has(n.notification_id)} bStar={setStarred.has(n.notification_id)} onToggle={() => toggleCheck(n.notification_id)} onStar={() => toggleStar(n.notification_id)} onOpen={() => openOne(n)} />
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      </main>
      <Footer />

      {objOpen && (
        <NotificationDetailModal
          notif={objOpen}
          bStarred={setStarred.has(objOpen.notification_id)}
          bArchived={setArchived.has(objOpen.notification_id)}
          onClose={() => setObjOpen(null)}
          onStarred={setSetStarred}
          onArchived={setSetArchived}
          onViewDetails={(n) => {
            setObjOpen(null);
            navigate(`/expense?ref=${n.reimbursement_id}`);
          }}
        />
      )}
    </>
  );
}

function InboxRow({ n, bChecked, bStar, onToggle, onStar, onOpen }: {
  n: Notification; bChecked: boolean; bStar: boolean;
  onToggle: () => void; onStar: () => void; onOpen: () => void;
}) {
  const meta = getNotifMeta(n.type);
  const tone = TONE_CLASSES[meta.tone];
  const strRefShort = n.reimbursement_id ? `RB-${n.reimbursement_id.slice(-5).toUpperCase()}` : '';
  return (
    <div className={`group flex items-center gap-3 px-4 sm:px-6 py-3 border-b border-gray-100 border-l-4 ${meta.severity === 'important' ? tone.bar : 'border-l-transparent'} ${n.is_read ? 'bg-white' : tone.softBg} hover:bg-gray-50 transition-colors`}>
      <input type="checkbox" checked={bChecked} onChange={onToggle} onClick={e => e.stopPropagation()} className="cursor-pointer" />
      {!n.is_read && <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0" />}
      {n.is_read && <span className="w-2 h-2 shrink-0" />}
      <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${tone.iconBg} ${tone.iconText}`}>
        <meta.Icon className="w-3.5 h-3.5" />
      </div>
      <button onClick={onOpen} className="flex-1 min-w-0 text-left cursor-pointer">
        <p className={`text-sm truncate ${n.is_read ? 'font-medium text-gray-800' : 'font-bold text-gray-900'}`}>{n.title}</p>
      </button>
      {strRefShort && <span className="hidden sm:inline text-xs font-semibold text-[#00703C] shrink-0">{strRefShort}</span>}
      <span className="text-xs text-gray-400 shrink-0 hidden sm:inline">{timeAgo(n.created_at)}</span>
      <button onClick={onStar} aria-label="Star" className={`w-7 h-7 rounded-md flex items-center justify-center cursor-pointer transition-colors ${bStar ? 'text-amber-500' : 'text-gray-300 hover:text-amber-500'}`}>
        <Star className={`w-4 h-4 ${bStar ? 'fill-current' : ''}`} />
      </button>
    </div>
  );
}
