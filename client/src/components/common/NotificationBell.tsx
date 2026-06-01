/**
 * NotificationBell — header bell icon with unread badge and dropdown list.
 * Polls /api/notifications/unread-count every 30s while mounted.
 */
import { useEffect, useRef, useState } from 'react';
import { Bell, Star, RefreshCw, CheckCheck, Volume2, VolumeX, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  listNotificationsApi,
  markReadApi,
  type Notification,
} from '../../utils/notificationApi';
import { getNotifMeta, TONE_CLASSES, timeAgo, starStore } from '../../utils/notificationUi';

const BELL_SOUND_KEY = 'em_notif_sound_v1';

export function NotificationBell() {
  const [bOpen, setOpen] = useState(false);
  const [lsNotifs, setNotifs] = useState<Notification[]>([]);
  const [iUnread, setUnread] = useState(0);
  const [bLoading, setLoading] = useState(false);
  const [setStarred, setSetStarred] = useState<Set<string>>(() => starStore.load());
  const [bSound, setBSound] = useState<boolean>(() => localStorage.getItem(BELL_SOUND_KEY) !== 'off');
  const refDropdown = useRef<HTMLDivElement | null>(null);

  const loadList = async () => {
    setLoading(true);
    try {
      const objResp = await listNotificationsApi(5, false);
      setNotifs(objResp.notifications);
      setUnread(objResp.unread_count);
    } catch {
      // silent; bell is non-critical
    } finally {
      setLoading(false);
    }
  };

  // Initial load + poll every 30s
  useEffect(() => {
    loadList();
    const objTimer = setInterval(loadList, 30000);
    return () => clearInterval(objTimer);
  }, []);

  // Close on outside click
  useEffect(() => {
    const fnClick = (objEvt: MouseEvent) => {
      if (refDropdown.current && !refDropdown.current.contains(objEvt.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', fnClick);
    return () => document.removeEventListener('mousedown', fnClick);
  }, []);

  const handleToggle = () => {
    setOpen((b) => !b);
    if (!bOpen) loadList();
  };

  const handleMarkAll = async () => {
    try {
      await markReadApi([], true);
      await loadList();
    } catch {
      // ignore
    }
  };

  const handleMarkOne = async (strId: string) => {
    try {
      await markReadApi([strId], false);
      setNotifs((ls) => ls.map((n) => (n.notification_id === strId ? { ...n, is_read: true } : n)));
      setUnread((iCount) => Math.max(0, iCount - 1));
    } catch {
      // ignore
    }
  };

  const handleStar = (strId: string, evt: React.MouseEvent) => {
    evt.stopPropagation();
    setSetStarred(starStore.toggle(strId));
  };

  const toggleSound = (evt: React.MouseEvent) => {
    evt.stopPropagation();
    const next = !bSound;
    setBSound(next);
    localStorage.setItem(BELL_SOUND_KEY, next ? 'on' : 'off');
  };

  return (
    <div ref={refDropdown} className="relative">
      <button
        type="button"
        onClick={handleToggle}
        className="relative p-2 rounded-full hover:bg-gray-100 text-gray-700 cursor-pointer transition-colors"
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5" />
        {iUnread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[20px] h-[20px] px-1 rounded-full bg-red-600 text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-white">
            {iUnread > 99 ? '99+' : iUnread}
          </span>
        )}
      </button>

      {bOpen && (
        <div className="absolute right-0 mt-2 w-[22rem] bg-white border border-gray-200 rounded-2xl shadow-2xl z-50 flex flex-col overflow-hidden">
          {/* ── Header ── */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <span className="font-bold text-gray-900 text-sm">Inbox</span>
            <div className="flex items-center gap-1">
              <button onClick={toggleSound} aria-label="Sound" title={bSound ? 'Sound on' : 'Sound off'} className="w-7 h-7 rounded-md hover:bg-gray-100 flex items-center justify-center text-gray-500 cursor-pointer">
                {bSound ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              </button>
              <button onClick={loadList} disabled={bLoading} aria-label="Refresh" className="w-7 h-7 rounded-md hover:bg-gray-100 flex items-center justify-center text-gray-500 cursor-pointer disabled:opacity-50">
                <RefreshCw className={`w-4 h-4 ${bLoading ? 'animate-spin' : ''}`} />
              </button>
              <button onClick={handleMarkAll} disabled={iUnread === 0} className="ml-1 inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold text-[#00703C] hover:bg-[#00703C]/5 rounded-md cursor-pointer disabled:text-gray-400 disabled:cursor-not-allowed">
                <CheckCheck className="w-3.5 h-3.5" /> Mark all read
              </button>
            </div>
          </div>

          {/* ── List ── */}
          <div className="overflow-y-auto flex-1 custom-scrollbar max-h-[24rem]">
            {bLoading && lsNotifs.length === 0 && <div className="px-4 py-6 text-center text-sm text-gray-500">Loading…</div>}
            {!bLoading && lsNotifs.length === 0 && <div className="px-4 py-6 text-center text-sm text-gray-500">No notifications</div>}
            {lsNotifs.map((n) => {
              const meta = getNotifMeta(n.type);
              const tone = TONE_CLASSES[meta.tone];
              const bStar = setStarred.has(n.notification_id);
              return (
                <button
                  key={n.notification_id}
                  type="button"
                  onClick={() => !n.is_read && handleMarkOne(n.notification_id)}
                  className={`w-full flex items-center gap-2 px-3 py-2.5 border-b border-gray-50 hover:bg-gray-50 cursor-pointer transition-colors ${n.is_read ? '' : 'bg-gray-50/40'}`}
                >
                  <span onClick={(e) => handleStar(n.notification_id, e)} role="button" aria-label="Star" className={`w-6 h-6 rounded-md flex items-center justify-center cursor-pointer transition-colors ${bStar ? 'text-amber-500' : 'text-gray-300 hover:text-amber-500'}`}>
                    <Star className={`w-3.5 h-3.5 ${bStar ? 'fill-current' : ''}`} />
                  </span>
                  {!n.is_read
                    ? <span className={`w-2 h-2 rounded-full ${meta.severity === 'important' ? 'bg-red-500' : 'bg-blue-500'} shrink-0`} />
                    : <span className="w-2 h-2 shrink-0" />}
                  <span className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 ${tone.iconBg} ${tone.iconText}`}>
                    <meta.Icon className="w-3.5 h-3.5" />
                  </span>
                  <span className={`flex-1 min-w-0 text-left text-xs truncate ${n.is_read ? 'font-medium text-gray-700' : 'font-bold text-gray-900'}`}>{n.title}</span>
                  <span className="text-[10px] text-gray-400 shrink-0">• {timeAgo(n.created_at)}</span>
                  {!n.is_read && <span className="w-1.5 h-1.5 rounded-full bg-blue-600 shrink-0" />}
                  <ChevronRight className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                </button>
              );
            })}
          </div>

          {/* ── Footer link ── */}
          <Link to="/inbox" onClick={() => setOpen(false)} className="block text-center py-2.5 text-sm font-semibold text-[#00703C] hover:bg-[#00703C]/5 border-t border-gray-100 cursor-pointer transition-colors">
            View Inbox <ChevronRight className="inline w-4 h-4 -mt-0.5" />
          </Link>
        </div>
      )}
    </div>
  );
}

export default NotificationBell;
