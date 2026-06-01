/**
 * notificationUi.ts — Shared UI helpers for Notifications (icon, tone, severity).
 * Also stores per-user starred/archived state in localStorage (backend has no fields).
 */
import {
  AlertTriangle, CheckCircle2, Info, Bell, MessageSquare, Send,
  HelpCircle, IndianRupee,
} from 'lucide-react';
import type { ComponentType } from 'react';

export type NotifSeverity = 'important' | 'normal';
export type NotifTone = 'red' | 'amber' | 'green' | 'blue' | 'gray';

export interface NotifMeta {
  tone: NotifTone;
  severity: NotifSeverity;
  Icon: ComponentType<{ className?: string }>;
  label: string;
}

const META: Record<string, NotifMeta> = {
  REJECTED:          { tone: 'red',   severity: 'important', Icon: AlertTriangle, label: 'Rejected' },
  QUERY_RAISED:      { tone: 'red',   severity: 'important', Icon: HelpCircle,    label: 'Query Raised' },
  CA_QUERY:          { tone: 'red',   severity: 'important', Icon: HelpCircle,    label: 'CA Query' },
  PAID:              { tone: 'green', severity: 'important', Icon: IndianRupee,   label: 'Payment Sent' },
  ACKNOWLEDGED:      { tone: 'green', severity: 'normal',    Icon: CheckCircle2,  label: 'Acknowledged' },
  APPROVAL_PROGRESS: { tone: 'green', severity: 'normal',    Icon: CheckCircle2,  label: 'Approved' },
  APPROVAL_PENDING:  { tone: 'amber', severity: 'important', Icon: Bell,          label: 'Approval Pending' },
  REAPPLIED:         { tone: 'blue',  severity: 'normal',    Icon: Send,          label: 'Re-applied' },
  CA_REAPPLIED:      { tone: 'blue',  severity: 'normal',    Icon: Send,          label: 'CA Re-applied' },
  PRIVATE_ASK:       { tone: 'blue',  severity: 'normal',    Icon: MessageSquare, label: 'Private Ask' },
};

const FALLBACK: NotifMeta = { tone: 'gray', severity: 'normal', Icon: Info, label: 'Info' };

export function getNotifMeta(strType: string): NotifMeta {
  return META[strType] ?? FALLBACK;
}

/** Tailwind classes for a tone — solid bg + text + soft-tinted bg + border. */
export const TONE_CLASSES: Record<NotifTone, {
  bar: string; bannerBg: string; bannerText: string; iconBg: string; iconText: string; softBg: string; pill: string;
}> = {
  red:   { bar: 'border-l-red-500',   bannerBg: 'bg-red-600',   bannerText: 'text-white', iconBg: 'bg-red-100',   iconText: 'text-red-700',   softBg: 'bg-red-50',   pill: 'bg-red-100 text-red-700' },
  amber: { bar: 'border-l-amber-500', bannerBg: 'bg-amber-500', bannerText: 'text-white', iconBg: 'bg-amber-100', iconText: 'text-amber-700', softBg: 'bg-amber-50', pill: 'bg-amber-100 text-amber-700' },
  green: { bar: 'border-l-green-500', bannerBg: 'bg-green-600', bannerText: 'text-white', iconBg: 'bg-green-100', iconText: 'text-green-700', softBg: 'bg-green-50', pill: 'bg-green-100 text-green-700' },
  blue:  { bar: 'border-l-blue-500',  bannerBg: 'bg-blue-600',  bannerText: 'text-white', iconBg: 'bg-blue-100',  iconText: 'text-blue-700',  softBg: 'bg-blue-50',  pill: 'bg-blue-100 text-blue-700' },
  gray:  { bar: 'border-l-gray-400',  bannerBg: 'bg-gray-600',  bannerText: 'text-white', iconBg: 'bg-gray-100',  iconText: 'text-gray-700',  softBg: 'bg-gray-50',  pill: 'bg-gray-100 text-gray-700' },
};

/** Relative-time formatter used everywhere (10h ago, 3d ago, …). */
export function timeAgo(strIso: string): string {
  const numMs = Date.now() - new Date(strIso).getTime();
  const numS = Math.max(0, Math.floor(numMs / 1000));
  if (numS < 60)        return `${numS}s ago`;
  const numM = Math.floor(numS / 60);
  if (numM < 60)        return `${numM}m ago`;
  const numH = Math.floor(numM / 60);
  if (numH < 24)        return `${numH}h ago`;
  const numD = Math.floor(numH / 24);
  if (numD < 30)        return `${numD}d ago`;
  return new Date(strIso).toLocaleDateString();
}

// ── Local star / archive store ─────────────────────────────────────────────────
const STAR_KEY = 'em_notif_starred_v1';
const ARCHIVE_KEY = 'em_notif_archived_v1';

function readSet(strKey: string): Set<string> {
  try {
    const raw = localStorage.getItem(strKey);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch { return new Set(); }
}

function writeSet(strKey: string, set: Set<string>): void {
  try { localStorage.setItem(strKey, JSON.stringify(Array.from(set))); } catch { /* ignore */ }
}

export const starStore = {
  load: () => readSet(STAR_KEY),
  toggle: (strId: string): Set<string> => {
    const s = readSet(STAR_KEY);
    if (s.has(strId)) s.delete(strId); else s.add(strId);
    writeSet(STAR_KEY, s);
    return s;
  },
};

export const archiveStore = {
  load: () => readSet(ARCHIVE_KEY),
  toggle: (strId: string): Set<string> => {
    const s = readSet(ARCHIVE_KEY);
    if (s.has(strId)) s.delete(strId); else s.add(strId);
    writeSet(ARCHIVE_KEY, s);
    return s;
  },
};
