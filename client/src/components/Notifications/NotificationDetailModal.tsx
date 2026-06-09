/**
 * NotificationDetailModal — full-detail view of a single notification.
 * Matches the spec: header strip (icon+title+time+severity pill), colored
 * banner, body with greeting + details box, footer (Star / Archive / View Details).
 */
import { useState } from 'react';
import { X, Star, Archive, ExternalLink } from 'lucide-react';
import type { Notification } from '../../utils/notificationApi';
import {
  getNotifMeta, TONE_CLASSES, timeAgo, starStore, archiveStore,
} from '../../utils/notificationUi';

interface Props {
  notif: Notification;
  bStarred: boolean;
  bArchived: boolean;
  onClose: () => void;
  onStarred?: (set: Set<string>) => void;
  onArchived?: (set: Set<string>) => void;
  onViewDetails?: (notif: Notification) => void;
}

export default function NotificationDetailModal({
  notif, bStarred, bArchived, onClose, onStarred, onArchived, onViewDetails,
}: Props) {
  console.log('📢 Rendering NotificationDetailModal for:', notif);
  const meta = getNotifMeta(notif.type);
  const tone = TONE_CLASSES[meta.tone];
  const [bStar, setBStar] = useState<boolean>(bStarred);
  const [bArch, setBArch] = useState<boolean>(bArchived);

  const handleStar = () => {
    const s = starStore.toggle(notif.notification_id);
    setBStar(s.has(notif.notification_id));
    onStarred?.(s);
  };
  const handleArchive = () => {
    const s = archiveStore.toggle(notif.notification_id);
    setBArch(s.has(notif.notification_id));
    onArchived?.(s);
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-start sm:items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className={`bg-white rounded-2xl shadow-2xl border-l-4 ${tone.bar} max-w-2xl w-full my-4 sm:my-8 max-h-[92vh] flex flex-col overflow-hidden`}>

        {/* ── Header strip (light tinted) ── */}
        <div className={`flex items-center gap-3 px-5 py-4 ${tone.softBg} border-b border-gray-200`}>
          <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${tone.iconBg} ${tone.iconText}`}>
            <meta.Icon className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm sm:text-base font-bold text-gray-900 truncate">{notif.title}</h3>
            <p className="text-xs text-gray-500 mt-0.5">{timeAgo(notif.created_at)}</p>
          </div>
          {meta.severity === 'important' && (
            <span className={`px-2.5 py-1 rounded-full text-[11px] font-semibold ${tone.pill} shrink-0`}>Important</span>
          )}
          <button onClick={onClose} aria-label="Close" className="w-8 h-8 rounded-full hover:bg-white/60 flex items-center justify-center text-gray-500 hover:text-gray-700 cursor-pointer transition-colors shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ── Body ── */}
        <div className="flex-1 overflow-y-auto custom-scrollbar px-5 py-5 bg-gray-50/50">
          {/* Coloured banner */}
          <div className={`rounded-xl px-5 py-6 mb-5 ${tone.bannerBg}`}>
            <h4 className={`text-base sm:text-lg font-bold ${tone.bannerText}`}>{meta.label}</h4>
          </div>

          {/* HTML Content (if available) */}
          {notif.html_content ? (
            <div
              className="mb-4"
              dangerouslySetInnerHTML={{ __html: notif.html_content }}
            />
          ) : (
            /* Fallback to plain message */
            notif.message && (
              <p className="text-sm text-gray-700 leading-relaxed mb-4 whitespace-pre-wrap">{notif.message}</p>
            )
          )}

          {/* Details box */}
          {/* <div className={`rounded-xl border border-gray-200 ${tone.softBg} px-4 py-4 space-y-2`}>
            <DetailRow label="Type" value={meta.label} />
            <DetailRow label="Notification ID" value={notif.notification_id} mono />
            {notif.reimbursement_id && (
              <DetailRow label="Reimbursement ID" value={notif.reimbursement_id} mono />
            )}
            <DetailRow label="Status" value={notif.is_read ? 'Read' : 'Unread'} />
            <DetailRow label="Received" value={new Date(notif.created_at).toLocaleString()} />
          </div> */}
        </div>

        {/* ── Footer ── */}
        <div className="px-5 py-3 border-t border-gray-200 bg-white flex items-center justify-between gap-3">
          <div className="flex items-center gap-1">
            <button
              onClick={handleStar}
              aria-label={bStar ? 'Unstar' : 'Star'}
              className={`w-9 h-9 rounded-lg flex items-center justify-center cursor-pointer transition-colors ${bStar ? 'text-amber-500 hover:bg-amber-50' : 'text-gray-400 hover:bg-gray-100'}`}
            >
              <Star className={`w-5 h-5 ${bStar ? 'fill-current' : ''}`} />
            </button>
            <button
              onClick={handleArchive}
              aria-label={bArch ? 'Unarchive' : 'Archive'}
              className={`w-9 h-9 rounded-lg flex items-center justify-center cursor-pointer transition-colors ${bArch ? 'text-blue-600 hover:bg-blue-50' : 'text-gray-400 hover:bg-gray-100'}`}
            >
              <Archive className={`w-5 h-5 ${bArch ? 'fill-current' : ''}`} />
            </button>
          </div>
          {notif.reimbursement_id && (
            <button
              onClick={() => onViewDetails?.(notif)}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold bg-[#00703C] text-white rounded-lg hover:bg-[#005a30] cursor-pointer transition-colors"
            >
              View Details <ExternalLink className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// function DetailRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
//   return (
//     <div className="text-sm">
//       <span className="font-semibold text-gray-900">{label}: </span>
//       <span className={`text-gray-700 ${mono ? 'font-mono text-xs' : ''}`}>{value}</span>
//     </div>
//   );
// }
