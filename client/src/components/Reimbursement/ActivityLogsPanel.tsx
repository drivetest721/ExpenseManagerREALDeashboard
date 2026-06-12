/**
 * ActivityLogsPanel — Right panel for detail view showing activity timeline with tabs.
 *
 * UPDATED: Supports new 9-state workflow with backward compatibility for deprecated statuses.
 * NOTE: Status mapping is handled automatically in existing logic:
 *   - QUERY_RAISED, CA_QUERY → QUERY
 *   - PRIVATE_ASK → ASK
 *   - CA_REAPPLIED → REAPPLIED
 *   - PAYMENT_ACKNOWLEDGED, CLOSED → ACKNOWLEDGED
 *
 * Tabs:
 * - Activity Log: Shows workflow action history (LEGACY)
 * - Approval Chain: Shows approval chain timeline
 * - All Logs: Shows comprehensive logs (Edits | Activity | View) with multi-select
 *
 * Features:
 * - Activity logs show detailed action history with status badges
 * - All Logs tab supports filtering by type (edit, activity, view)
 * - Latest log at the top
 * - Email and details hidden by default, expand on click
 * - Search by name, email, message
 */
import { useState, useEffect, useMemo } from 'react';
import {
  Search,
  ChevronDown,
 
  Lock,
  Clock,
  User,
  Send,
  ThumbsUp,
  HelpCircle,
  RotateCcw,
  Ban,
  CreditCard,
  Check,
  AlertCircle,
  CheckCircle,
  XCircle,
  Pencil,
  Upload,
  Trash2,
  Save,
  MousePointer,
  Eye,
  List,
} from 'lucide-react';
import type { ChainStep, ChainLog } from '../../utils/reimbursementApi';
import type { ActivityLog } from '../../types/activityLog';
import { formatLogDate } from '../../types/activityLog';
import { getReimbursementLogsApi } from '../../utils/reimbursementApi';
import { useAuth } from '../../hooks/useAuth';

interface Props {
  lsChain: ChainStep[];
  iCurrentStep: number;
  strCurrentReviewerId: string;
  lsLogs: ChainLog[];
  strInitiatorName: string;
  strStatus?: string;
  strReimbursementId: string;
}

const ACTION_STYLE: Record<
  string,
  { label: string; cls: string; Icon: any; description: string }
> = {
  SUBMIT: { 
    label: 'Submitted', 
    cls: 'bg-blue-100 text-blue-700 border-blue-300', 
    Icon: Send,
    description: 'Submitted for approval' 
  },
  APPROVE: { 
    label: 'Approved', 
    cls: 'bg-green-100 text-green-700 border-green-300', 
    Icon: ThumbsUp,
    description: 'Approved and forwarded' 
  },
  QUERY: { 
    label: 'Query', 
    cls: 'bg-orange-100 text-orange-700 border-orange-300', 
    Icon: HelpCircle,
    description: 'Query raised - response required' 
  },
  ASK: { 
    label: 'QUERY', 
    cls: 'bg-purple-100 text-purple-700 border-purple-300', 
    Icon: Lock,
    description: 'Private clarification requested' 
  },
  REAPPLY: { 
    label: 'Reapplied', 
    cls: 'bg-blue-100 text-blue-700 border-blue-300', 
    Icon: RotateCcw,
    description: 'Responded and reapplied' 
  },
  CA_QUERY: { 
    label: 'CA Query', 
    cls: 'bg-orange-100 text-orange-700 border-orange-300', 
    Icon: AlertCircle,
    description: 'CA query raised' 
  },
  CA_REAPPLY: { 
    label: 'CA Reapplied', 
    cls: 'bg-blue-100 text-blue-700 border-blue-300', 
    Icon: RotateCcw,
    description: 'Responded to CA query' 
  },
  PAY: { 
    label: 'Paid', 
    cls: 'bg-emerald-100 text-emerald-700 border-emerald-300', 
    Icon: CreditCard,
    description: 'Payment processed' 
  },
  ACKNOWLEDGE: { 
    label: 'Acknowledged', 
    cls: 'bg-green-100 text-green-700 border-green-300', 
    Icon: Check,
    description: 'Payment acknowledged' 
  },
  REJECT: { 
    label: 'Rejected', 
    cls: 'bg-red-100 text-red-700 border-red-300', 
    Icon: Ban,
    description: 'Reimbursement rejected' 
  },
};

// Icon mapping for all log types (for "All Logs" tab)
const ALL_LOG_ICONS: Record<string, { Icon: any; color: string }> = {
  FIELD_CHANGED: { Icon: Pencil, color: 'text-blue-600' },
  ATTACHMENT_UPLOADED: { Icon: Upload, color: 'text-green-600' },
  ATTACHMENT_REMOVED: { Icon: Trash2, color: 'text-red-600' },
  DRAFT_SAVED: { Icon: Save, color: 'text-gray-600' },
  BUTTON_CLICKED: { Icon: MousePointer, color: 'text-blue-600' },
  SUBMITTED: { Icon: Send, color: 'text-blue-600' },
  APPROVED: { Icon: ThumbsUp, color: 'text-green-600' },
  QUERY_RAISED: { Icon: HelpCircle, color: 'text-orange-600' },
  PRIVATE_ASK: { Icon: Lock, color: 'text-purple-600' },
  REAPPLIED: { Icon: RotateCcw, color: 'text-blue-600' },
  REJECTED: { Icon: Ban, color: 'text-red-600' },
  PAID: { Icon: CreditCard, color: 'text-emerald-600' },
  PAYMENT_ACKNOWLEDGED: { Icon: Check, color: 'text-green-600' },
  PAGE_VIEWED: { Icon: Eye, color: 'text-gray-600' },
};
const LOG_TYPE_STYLE = {
  view: {
    border: 'border-l-[#00703C]',
    badge: 'bg-green-100 text-green-700',
    avatar: 'bg-[#00703C]',
    label: 'VIEW',
  },

  edit: {
    border: 'border-l-[#00703C]',
    badge: 'bg-blue-100 text-blue-700',
    avatar: 'bg-[#00703C]',
    label: 'EDIT',
  },

  activity: {
    border: 'border-l-[#00703C]',
    badge: 'bg-purple-100 text-purple-700',
    avatar: 'bg-[#00703C]',
    label: 'ACTIVITY',
  },
};
const getInitials = (strName?: string) => {
  if (!strName) return '?';

  return strName
    .split(' ')
    .map(x => x[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();
};

function fmtDateTime(str: string): string {
  if (!str) return '—';
  const d = new Date(str);
  // Format: dd/mm/yyyy hh:mm:ss AM/PM IST
  const day = d.getDate().toString().padStart(2, '0');
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const year = d.getFullYear();
  let hours = d.getHours();
  const minutes = d.getMinutes().toString().padStart(2, '0');
  const seconds = d.getSeconds().toString().padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  const hoursStr = hours.toString().padStart(2, '0');

  return `${day}/${month}/${year} ${hoursStr}:${minutes}:${seconds} ${ampm} IST`;
}


export default function ActivityLogsPanel({
  lsChain,
  iCurrentStep,
  strCurrentReviewerId,
  lsLogs,
  strInitiatorName,
  strStatus,
  strReimbursementId,
}: Props) {
  const { objUser } = useAuth();
  const [strSearchQuery, setStrSearchQuery] = useState('');
  const [strAllLogsSearch, setStrAllLogsSearch] = useState('');
  const [bShowPrivate, setBShowPrivate] = useState(true);
  const [setExpandedLogs, setSetExpandedLogs] = useState<Set<string>>(new Set());
  const [strActiveTab, setStrActiveTab] = useState<'activity' | 'chain' | 'all'>(lsChain.length>0 ? 'chain' : 'activity');

  // State for "All Logs" tab
  const [lsAllLogs, setLsAllLogs] = useState<ActivityLog[]>([]);
  const [bLoadingAllLogs, setBLoadingAllLogs] = useState(false);
  const [strAllLogsError, setStrAllLogsError] = useState('');
  const [bShowEdits, setBShowEdits] = useState(true);
  const [bShowActivity, setBShowActivity] = useState(true);
  const [bShowView, setBShowView] = useState(true);
  const [bDropdownOpen, setBDropdownOpen] = useState(false);

  const bIsOwner = objUser?.departments?.some((d) => d.role === 'owner') ?? false;
  const strInitiatorId = lsLogs.find(l => l.action === 'SUBMIT')?.action_by || '';
  const bIsTerminal = strStatus === 'PAID' || strStatus === 'PAYMENT_ACKNOWLEDGED' || strStatus === 'CLOSED' || strStatus === 'REJECTED';
  void setBShowPrivate;

  // Filter logs for activity tab
  const lsFilteredLogs = useMemo(() => {
    let lsFiltered = lsLogs.filter((log) => {
      const bIsPrivate = log.visibility === 'private';
      if (!bShowPrivate && bIsPrivate) {
        const bInvolved =
          log.action_by === objUser?.user_id || 
          bIsOwner ||
          strInitiatorId === objUser?.user_id;
        if (!bInvolved) return false;
      }
      return true;
    });

    if (strSearchQuery.trim()) {
      const q = strSearchQuery.toLowerCase();
      lsFiltered = lsFiltered.filter((log) =>
        log.action_by_name?.toLowerCase().includes(q) ||
        log.action_by_email?.toLowerCase().includes(q) ||
        log.message.toLowerCase().includes(q)
      );
    }

    return lsFiltered.sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }, [lsLogs, bShowPrivate, strSearchQuery, objUser, bIsOwner, strInitiatorId]);

  const handleLogHoverStart = (strLogId: string) => {
    setSetExpandedLogs((prev) => new Set(prev).add(strLogId));
  };

  const handleLogHoverEnd = (strLogId: string) => {
    setSetExpandedLogs((prev) => {
      const next = new Set(prev);
      next.delete(strLogId);
      return next;
    });
  };
  

  useEffect(() => {
    
    if (!bDropdownOpen) return;
    const handleClickOutside = () => setBDropdownOpen(false);
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [bDropdownOpen]);

  // Load all logs when "all" tab is active
  useEffect(() => {
    if (strActiveTab === 'all' && lsAllLogs.length === 0 && !bLoadingAllLogs) {
      loadAllLogs();
    }

    
  }, [strActiveTab]);
  console.log("Current Reviewer ID:", strCurrentReviewerId);
  console.log("======================")
  console.log(lsChain);
  console.log("======================")
  async function loadAllLogs() {
    setBLoadingAllLogs(true);
    setStrAllLogsError('');
    try {
      const lsLogs = await getReimbursementLogsApi(strReimbursementId);
      setLsAllLogs(lsLogs);
    } catch (objErr: any) {
      setStrAllLogsError(objErr.response?.data?.detail || 'Failed to load logs');
    } finally {
      setBLoadingAllLogs(false);
    }
  }

  // Filter all logs based on selected types
  const bShowLogTypeBadge = [bShowEdits, bShowActivity, bShowView].filter(Boolean).length >= 2;

  const bAllSelected = bShowEdits && bShowActivity && bShowView;
  const lsSelectedLabels = [
    bShowEdits ? 'Edits' : null,
    bShowActivity ? 'Activity' : null,
    bShowView ? 'View' : null,
  ].filter(Boolean);
  const strDropdownLabel = bAllSelected ? 'All' : lsSelectedLabels.join(', ') || 'None';
  const lsFilteredAllLogs = useMemo(() => {
    let lsFiltered = lsAllLogs;

    // Filter by selected types
    const lsSelectedTypes: ('edit' | 'activity' | 'view')[] = [];
    if (bShowEdits) lsSelectedTypes.push('edit');
    if (bShowActivity) lsSelectedTypes.push('activity');
    if (bShowView) lsSelectedTypes.push('view');

    if (lsSelectedTypes.length === 0) {
      return [];
    }

    lsFiltered = lsFiltered.filter(log => lsSelectedTypes.includes(log.log_type));

    // Search filter
     if (strAllLogsSearch.trim()) {
      const q = strAllLogsSearch.toLowerCase();
      lsFiltered = lsFiltered.filter(log =>
        (log.action_by_name ?? '').toLowerCase().includes(q) ||
        (log.action_by_email ?? '').toLowerCase().includes(q) ||
        (log.message ?? '').toLowerCase().includes(q) ||
        (log.field_name ?? '').toLowerCase().includes(q)
      );
    }

    // Sort by timestamp (newest first)
    return lsFiltered.sort((a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }, [lsAllLogs, bShowEdits, bShowActivity, bShowView, strAllLogsSearch, strActiveTab]);

  // ✅ UPDATED: Status color scheme matching backend 9-state system
  const STATUS_COLORS: Record<string, string> = {
    // Grey — not yet acted on
    PENDING: 'bg-gray-100 text-gray-700',
    // Blue — in motion through approval pipeline
    SUBMITTED: 'bg-blue-100 text-blue-700',
    IN_REVIEW: 'bg-blue-100 text-blue-700',
    // Yellow — query/ask raised
    QUERY: 'bg-yellow-100 text-yellow-700',
    ASK: 'bg-yellow-100 text-yellow-700',
    // Amber — reapplied
    REAPPLIED: 'bg-amber-100 text-amber-700',
    // Green — approved or paid
    APPROVED: 'bg-green-100 text-green-700',
    PAID: 'bg-emerald-100 text-emerald-700',
    ACKNOWLEDGED: 'bg-emerald-100 text-emerald-700',
    // Red — rejected
    REJECTED: 'bg-red-100 text-red-700',
  };

  // ✅ UPDATED: Get border color based on current_status
  function getStepBorderColor(strStatus: string, bIsCurrent: boolean): string {
    if (bIsCurrent) return 'border-l-4 border-yellow-600';

    switch (strStatus) {
      case 'APPROVED':
      case 'PAID':
      case 'ACKNOWLEDGED':
        return 'border-l-4 border-green-600';
      case 'QUERY':
      case 'ASK':
        return 'border-l-4 border-yellow-600';
      case 'REAPPLIED':
        return 'border-l-4 border-amber-600';
      case 'IN_REVIEW':
        return 'border-l-4 border-blue-600';
      case 'SUBMITTED':
        return 'border-l-4 border-blue-500';
      case 'REJECTED':
        return 'border-l-4 border-red-600';
      case 'PENDING':
      default:
        return 'border-l-4 border-gray-300';
    }
  }

  const getDisplayFieldName = (fieldName: string | null | undefined, action: string): string => {
    if (!fieldName) return action.replace(/_/g, ' ');
    
    // Extract just the last field name after the last dot
    // e.g., "items[2].attachments" → "attachments"
    const parts = fieldName.split('.');
    const lastPart = parts[parts.length - 1];
    return lastPart.replace(/_/g, ' ');
  };
  const getLogDescription = (log: ActivityLog) => {

  if (log.log_type === 'view') {
    return 'Page viewed';
  }

  if (log.log_type === 'edit') {
    return `${getDisplayFieldName(
      log.field_name,
      log.action
    )} was modified`;
  }

  if (log.log_type === 'activity') {
    return log.message || 'Activity performed';
  }

  return log.message || 'Operation performed';
};

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Tab Navigation - Hidden Activity, Only Chain and All Logs */}
      <div className="border-b border-gray-200 bg-gradient-to-r from-green-50 to-emerald-50">
        <div className="flex">
          {lsChain.length > 0 &&
            <button
            onClick={() => setStrActiveTab('chain')}
            className={`flex-1 px-3 py-3 text-sm font-semibold transition-all border-b-2 ${
              strActiveTab === 'chain'
                ? 'border-[#00703C] text-[#00703C] bg-white'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <User className="w-4 h-4" />
              Chain
            </div>
          </button>}
          <button
            onClick={() => setStrActiveTab('all')}
            className={`flex-1 px-3 py-3 text-sm font-semibold transition-all border-b-2 ${
              strActiveTab === 'all'
                ? 'border-[#00703C] text-[#00703C] bg-white'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <List className="w-4 h-4" />
              All Logs
            </div>
          </button>
        </div>
      </div>

      {/* Activity Log Tab */}
      {strActiveTab === 'activity' && (
        <>
          {/* Header */}
          <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
            <div className="flex items-center gap-2 mb-3">
              <Clock className="w-5 h-5 text-[#00703C]" />
              <h3 className="text-lg font-bold text-gray-900">Activity Timeline</h3>
              <span className="text-xs text-gray-600">({lsFilteredLogs.length} activities)</span>
            </div>

            {/* Search */}
            {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by name, email, field..."
                  value={strAllLogsSearch}
                  onChange={e => setStrAllLogsSearch(e.target.value)}
                  className="w-full h-10 pl-10 pr-3 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#00703C]"
                />
                {strAllLogsSearch && (
                  <button
                    onClick={() => setStrAllLogsSearch('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    ✕
                  </button>
                )}
            </div>
          </div>

          {/* Activity Timeline */}
          <div className="flex-1 overflow-auto custom-scrollbar p-4">
            {lsFilteredLogs.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-8">
                {strSearchQuery ? 'No matching activities found' : 'No activity yet'}
              </p>
            ) : (
              <div className="space-y-3">
                {lsFilteredLogs.map((log) => {
                  const bExpanded = setExpandedLogs.has(log.log_id);
                  const bIsPrivate = log.visibility === 'private';
                  const objStyle = ACTION_STYLE[log.action] || {
                    label: log.action,
                    cls: 'bg-gray-100 text-gray-700 border-gray-300',
                    Icon: User,
                    description: 'Action performed',
                  };
                  const Icon = objStyle.Icon;

                  return (
                    <div
                      key={log.log_id}
                      className={`rounded-lg border-2 transition-all hover:shadow-lg ${
                        bIsPrivate
                          ? 'bg-purple-50 border-purple-300'
                          : 'bg-white border-gray-200'
                      }`}
                    >
                      <div className="w-full p-4 text-left">
                        <div className="flex items-start gap-3">
                          {/* Icon */}
                          <div
                            className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 border-2 ${objStyle.cls}`}
                          >
                            <Icon className="w-6 h-6" />
                          </div>

                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            {/* Status Badge */}
                            <div className="mb-2">
                              <span className={`inline-block px-3 py-1.5 rounded-full text-sm font-bold ${objStyle.cls}`}>
                                {objStyle.label}
                              </span>
                              {bIsPrivate && (
                                <span className="ml-2 inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold bg-purple-200 text-purple-800 border border-purple-400">
                                  <Lock className="w-3 h-3" />
                                  Private
                                </span>
                              )}
                            </div>

                            {/* Action Description */}
                            <div className="text-sm text-gray-600 mb-2">{objStyle.description}</div>

                            {/* Actor Info */}
                            <div className="flex items-center gap-2 mb-2 flex-wrap text-sm">
                              <span className="font-semibold text-gray-900">
                                {log.action_by_name || 'Unknown'}
                              </span>
                              <span className="text-gray-400">→</span>
                              <span className="text-gray-700">{strInitiatorName}</span>
                            </div>

                            {/* Timestamp */}
                            <div className="text-xs text-gray-500 mb-2">
                              {fmtDateTime(log.created_at)}
                            </div>

                            {/* Message/Description */}
                            {log.message ? (
                              <div className="mt-2 rounded border border-gray-200 bg-gray-50 p-3 text-sm text-gray-800">
                                <div className="leading-relaxed">
                                  {bExpanded ? log.message : `${log.message.substring(0, 120)}${log.message.length > 120 ? '...' : ''}`}
                                </div>
                              </div>
                            ) : (
                              <div className="mt-2 rounded border border-gray-200 bg-gray-50 p-3 text-sm text-gray-600">
                                No description provided
                              </div>
                            )}
                          </div>

                          
                          
                        </div>
                      </div>

                      {/* Expanded Details (animated) */}
                      <div
                        className={`px-4 pb-4 space-y-2 border-t-2 border-gray-200 bg-gray-50 overflow-hidden transition-all duration-300 ease-in-out ${
                          bExpanded ? 'max-h-[420px] opacity-100 pt-3' : 'max-h-0 opacity-0 pt-0'
                        }`}
                        aria-hidden={!bExpanded}
                      >
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <span className="block text-xs font-bold text-gray-700 mb-1">Actor Email</span>
                            <span className="text-sm text-gray-800">{log.action_by_email || '—'}</span>
                          </div>
                          {log.action_by_role && (
                            <div>
                              <span className="block text-xs font-bold text-gray-700 mb-1">Role</span>
                              <span className="text-sm text-gray-800 capitalize">
                                {log.action_by_role.replace(/_/g, ' ')}
                              </span>
                            </div>
                          )}
                          {log.action_by_department && (
                            <div>
                              <span className="block text-xs font-bold text-gray-700 mb-1">Department</span>
                              <span className="text-sm text-gray-800">{log.action_by_department}</span>
                            </div>
                          )}
                          <div>
                            <span className="block text-xs font-bold text-gray-700 mb-1">Visibility</span>
                            <span className="text-sm text-gray-800 capitalize">{log.visibility}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}

      {/* Approval Chain Tab */}
      {strActiveTab === 'chain' && (
        <div className="flex-1 overflow-auto custom-scrollbar">
          <div className="p-4 space-y-4">
            {/* Approval Chain Header */}
            <div className="pb-2">
              <h4 className="text-sm font-bold text-gray-900">📋 Approval Chain</h4>
            </div>

            {/* Chain Steps with Connector Lines */}
            <div className="space-y-0">
              {lsChain.map((objStep, iIdx) => {
                // Determine if this step is the current reviewer by matching user_id with current_reviewer_id
                const bIsCurrent = !bIsTerminal && objStep.user_id === strCurrentReviewerId;
                const strStatus = objStep.current_status || 'PENDING';
                const bIsInitiator = objStep.role === 'initiator';
                const bIsLast = iIdx === lsChain.length - 1;

                return (
                  <div key={objStep.user_id + iIdx} className="relative">
                    {/* Connector Line (before this step, except for first) */}
                    {iIdx > 0 && (
                      <div className="absolute left-[17px] top-0 w-0.5 h-4 bg-gradient-to-b from-gray-300 to-gray-200 transform -translate-y-4"></div>
                    )}

                    {/* Step Card - Using color scheme instead of icons */}
                    <div
                      className={`flex gap-2.5 p-3 rounded-lg transition-all duration-300 hover:shadow-md ${
                        getStepBorderColor(strStatus, bIsCurrent)
                      } ${
                        bIsCurrent
                          ? 'bg-yellow-50 shadow-lg ring-2 ring-yellow-400 ring-opacity-50'
                          : 'bg-white'
                      }`}
                    >
                      {/* Status Badge - Color coded */}
                      <div className="flex-shrink-0 relative">
                        <div className={`px-2.5 py-1 rounded-md text-xs font-semibold ${
                          STATUS_COLORS[strStatus] || STATUS_COLORS.PENDING
                        }`}>
                          {strStatus}

                        </div>
                      </div>

                      {/* Content - Simplified */}
                      <div className="flex-1 min-w-0">
                        
                        {/* Header Row: Name, Role, Status */}
                        <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
                          {/* User Name + EMAIL with Tooltip */}
                          <div className="relative group">
                            <p className="text-sm font-semibold text-gray-900 cursor-pointer hover:text-[#00703C] transition-colors">
                              {objStep.username}
                            </p>

                            {/* USER EMAIL on Hover */}
                            <div className="absolute top-0 top-full mt-1 hidden group-hover:block z-50 bg-gray-900 text-white text-xs rounded-lg shadow-lg py-2 px-3 min-w-max max-w-xs">
                              <div className="space-y-1">
                                {/* <div className="font-semibold">{objStep.username}</div> */}
                                <div className="text-gray-300">{objStep.email}</div>
                                {/* {objStep.department && (
                                  <div className="text-gray-300">
                                    <span className="font-medium">Dept:</span> {objStep.department}
                                  </div>
                                )} */}
                              </div>
                              {/* Arrow */}
                              <div className="absolute -top-1 left-4 w-2 h-2 bg-gray-900 transform rotate-45"></div>
                            </div>
                          </div>
                          
                          {/* USER ROLE */}
                          {objStep.role && (
                            <span className="px-1.5 py-0.5 bg-gray-100 text-gray-700 rounded text-xs font-semibold uppercase">
                              {objStep.role}
                            </span>
                          )}
                        </div>

                        {/* Status/Timestamp Section - Compact */}
                        <div className="space-y-1 bg-white/50 rounded px-2 py-1.5 text-xs">
                          {bIsCurrent && (
                            <div className="flex items-center gap-1.5 bg-yellow-100 border border-yellow-400 rounded px-2 py-1.5 mb-2 animate-pulse">
                              <Clock className="w-4 h-4 text-yellow-700" />
                              <span className="text-yellow-900 font-bold text-sm"> CURRENTLY REVIEWING</span>
                              {/* {objStep.receivedAt && (
                                <span className="text-gray-700">{fmtDateTime(objStep.receivedAt)}</span>
                              )} */}
                            </div>
                          )}

                          {/* For Initiator: Show Submitted At (always) and Received At (when returning from query) */}
                          {bIsInitiator && (
                            <>
                              {/* Always show submission timestamp */}
                              {objStep.submittedAt && strStatus!== 'REAPPLIED' && strStatus !== 'IN_REVIEW' && (
                                <div className="flex items-center gap-1.5 text-blue-700 font-medium">
                                  <Send className="w-3 h-3" />
                                  <span>Submitted:</span>
                                  <span className="text-gray-700">{fmtDateTime(objStep.submittedAt)}</span>
                                </div>
                              )}
                              
                              {objStep.receivedAt && strStatus=== 'REAPPLIED' && (
                                <div className="flex items-center gap-1.5 text-blue-700 font-medium">
                                  <Send className="w-3 h-3" />
                                  <span>Received At:</span>
                                  <span className="text-gray-700">{fmtDateTime(objStep.receivedAt)}</span>
                                </div>
                              )}

                              {/* Show Received At when initiator viewed after QUERY/ASK */}
                              {objStep.receivedAt && strStatus === 'IN_REVIEW' && (
                                <div className="flex items-center gap-1.5 text-orange-700 font-medium">
                                  <Clock className="w-3 h-3" />
                                  <span>Received Query:</span>
                                  <span className="text-gray-700">{fmtDateTime(objStep.receivedAt)}</span>
                                </div>
                              )}

                              {/* Show Reapplied timestamp */}
                              {strStatus === 'REAPPLIED' && objStep.submittedAt && (
                                <div className="flex items-center gap-1.5 text-amber-700 font-medium">
                                  <RotateCcw className="w-3 h-3" />
                                  <span>Reapplied:</span>
                                  <span className="text-gray-700">{fmtDateTime(objStep.submittedAt)}</span>
                                </div>
                              )}

                              {/* Show remaining days when initiator is current reviewer */}
                              {objStep.remaining_days !== undefined && objStep.remaining_days !== null && strStatus === 'IN_REVIEW' && (
                                <div className={`flex items-center gap-1.5 font-bold ${
                                  objStep.remaining_days < 0
                                    ? 'text-red-700'
                                    : objStep.remaining_days === 0
                                    ? 'text-orange-700'
                                    : objStep.remaining_days <= 1
                                    ? 'text-yellow-700'
                                    : 'text-green-700'
                                }`}>
                                  <AlertCircle className="w-3 h-3" />
                                  <span>
                                    {objStep.remaining_days < 0
                                      ? `${Math.abs(objStep.remaining_days)} days OVERDUE`
                                      : objStep.remaining_days === 0
                                      ? 'Due TODAY'
                                      : `Due in ${objStep.remaining_days} days`
                                    }
                                  </span>
                                </div>
                              )}
                            </>
                          )}

                          {/* For Managers: Show Received At and Action Taken */}
                          {!bIsInitiator && (
                            <>
                              {/* Show Received timestamp */}
                              {objStep.receivedAt && (
                                <div className="flex items-center gap-1.5 text-blue-600">
                                  <Clock className="w-3 h-3" />
                                  <span>Received:</span>
                                  <span className="text-gray-700">{fmtDateTime(objStep.receivedAt)}</span>
                                </div>
                              )}

                              {/* Show Action timestamp when manager has acted */}
                              {objStep.submittedAt && !bIsCurrent && (
                                <div className={`flex items-center gap-1.5 font-medium ${
                                  strStatus === 'REJECTED'
                                    ? 'text-red-700'
                                    : strStatus === 'QUERY' || strStatus === 'ASK'
                                    ? 'text-yellow-700'
                                    : strStatus === 'APPROVED' || strStatus === 'PAID'
                                    ? 'text-green-700'
                                    : 'text-gray-700'
                                }`}>
                                  {strStatus === 'REJECTED' && <Ban className="w-3 h-3" />}
                                  {(strStatus === 'QUERY' || strStatus === 'ASK') && <AlertCircle className="w-3 h-3" />}
                                  {(strStatus === 'APPROVED' || strStatus === 'PAID') && <ThumbsUp className="w-3 h-3" />}
                                  <span>
                                    {strStatus === 'REJECTED' ? 'Rejected:' :
                                     strStatus === 'QUERY' ? 'Query Raised:' :
                                     strStatus === 'ASK' ? 'Ask Raised:' :
                                     strStatus === 'APPROVED' ? 'Approved:' :
                                     strStatus === 'PAID' ? 'Paid:' :
                                     'Action:'}
                                  </span>
                                  <span className="text-gray-700">{fmtDateTime(objStep.submittedAt)}</span>
                                </div>
                              )}

                              {/* Show remaining days for current reviewer */}
                              {bIsCurrent && objStep.remaining_days !== undefined && objStep.remaining_days !== null && (
                                <div className={`flex items-center gap-1.5 font-bold ${
                                  objStep.remaining_days < 0
                                    ? 'text-red-700'
                                    : objStep.remaining_days === 0
                                    ? 'text-orange-700'
                                    : objStep.remaining_days <= 1
                                    ? 'text-yellow-700'
                                    : 'text-green-700'
                                }`}>
                                  <AlertCircle className="w-3 h-3" />
                                  <span>
                                    {objStep.remaining_days < 0
                                      ? `${Math.abs(objStep.remaining_days)} days OVERDUE`
                                      : objStep.remaining_days === 0
                                      ? 'Due TODAY'
                                      : `Due in ${objStep.remaining_days} days`
                                    }
                                  </span>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Connector Line (after this step) */}
                    {!bIsLast && (
                      <div className="h-3 flex justify-center">
                        <div className="w-0.5 h-full bg-gradient-to-b from-gray-300 to-gray-200"></div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Quick Status */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mt-4">
              <div className="text-sm font-semibold text-gray-900 mb-2">Current Status</div>
              <div className="flex items-center gap-2 text-sm">
                <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
                <span className="text-gray-700">
                  {bIsTerminal
                    ? '✓ Process Complete'
                    : (() => {
                        const objCurrentReviewer = lsChain.find(step => step.user_id === strCurrentReviewerId);
                        return objCurrentReviewer
                          ? `Currently with: ${objCurrentReviewer.username} (${objCurrentReviewer.role || 'Reviewer'})`
                          : `Step ${iCurrentStep + 1} of ${lsChain.length - 1}`;
                      })()
                  }
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* All Logs Tab */}
      {strActiveTab === 'all' && (
        <>
          {/* Header with multi-select checkboxes */}
          <div className="p-4 border-b border-gray-200 ">
            <h3 className="text-lg font-bold text-gray-900 mb-3">All Logs</h3>

            {/* Multi-select checkboxes */}
            {/* <div className="flex items-center gap-4 mb-3 flex-wrap">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={bShowEdits}
                  onChange={e => setBShowEdits(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded"
                />
                <span className="text-sm font-medium text-gray-700">Edits</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={bShowActivity}
                  onChange={e => setBShowActivity(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded"
                />
                <span className="text-sm font-medium text-gray-700">Activity</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={bShowView}
                  onChange={e => setBShowView(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded"
                />
                <span className="text-sm font-medium text-gray-700">View</span>
              </label>
            </div> */}
            {/* Multi-select Dropdown */}
            <div className="relative mb-3" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={(e) => { e.stopPropagation(); setBDropdownOpen(prev => !prev); }}
                className="flex items-center gap-2 px-3 py-2 bg-white border-2 border-[#00703C] rounded-lg text-sm font-semibold text-[#00703C] hover:bg-green-50 transition-all shadow-sm min-w-[140px] justify-between"
              >
                <span>Filter: {strDropdownLabel}</span>
                <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${bDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {bDropdownOpen && (
                <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-xl z-50 min-w-[160px] overflow-hidden">
                  {/* All option */}
                  <label className="flex items-center gap-3 px-4 py-2.5 hover:bg-green-50 cursor-pointer border-b border-gray-100 transition-colors">
                    <input
                      type="checkbox"
                      checked={bAllSelected}
                      onChange={e => {
                        setBShowEdits(e.target.checked);
                        setBShowActivity(e.target.checked);
                        setBShowView(e.target.checked);
                      }}
                      className="w-4 h-4 accent-[#00703C] rounded"
                    />
                    <span className="text-sm font-bold text-gray-800">All</span>
                  </label>
                  {/* Edits */}
                  <label className="flex items-center gap-3 px-4 py-2.5 hover:bg-green-50 cursor-pointer transition-colors">
                    <input
                      type="checkbox"
                      checked={bShowEdits}
                      onChange={e => setBShowEdits(e.target.checked)}
                      className="w-4 h-4 accent-[#00703C] rounded"
                    />
                    <span className="flex items-center gap-2 text-sm text-gray-700">
                      <Pencil className="w-3.5 h-3.5 text-blue-500" /> Edits
                    </span>
                  </label>
                  {/* Activity */}
                  <label className="flex items-center gap-3 px-4 py-2.5 hover:bg-green-50 cursor-pointer transition-colors">
                    <input
                      type="checkbox"
                      checked={bShowActivity}
                      onChange={e => setBShowActivity(e.target.checked)}
                      className="w-4 h-4 accent-[#00703C] rounded"
                    />
                    <span className="flex items-center gap-2 text-sm text-gray-700">
                      <MousePointer className="w-3.5 h-3.5 text-green-500" /> Activity
                    </span>
                  </label>
                  {/* View */}
                  <label className="flex items-center gap-3 px-4 py-2.5 hover:bg-green-50 cursor-pointer transition-colors">
                    <input
                      type="checkbox"
                      checked={bShowView}
                      onChange={e => setBShowView(e.target.checked)}
                      className="w-4 h-4 accent-[#00703C] rounded"
                    />
                    <span className="flex items-center gap-2 text-sm text-gray-700">
                      <Eye className="w-3.5 h-3.5 text-gray-500" /> View
                    </span>
                  </label>
                </div>
              )}
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search logs..."
                value={strAllLogsSearch}                          
                onChange={e => setStrAllLogsSearch(e.target.value)} 
                className="w-full h-10 pl-10 pr-3 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Logs Timeline */}
          <div className="flex-1 overflow-auto custom-scrollbar p-4">
            {bLoadingAllLogs ? (
              <p className="text-sm text-gray-500 text-center py-8">Loading logs...</p>
            ) : strAllLogsError ? (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-md px-4 py-3">
                {strAllLogsError}
              </div>
            ) : lsFilteredAllLogs.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-8">
                {strAllLogsSearch  ? 'No matching logs found' : 'No logs to display'}
              </p>
            ) : (
              <div className="space-y-3">
                {lsFilteredAllLogs.map((log) => {
                 const style = LOG_TYPE_STYLE[
                    log.log_type as 'view' | 'edit' | 'activity'
                  ];

                  return (
                    <div
                      key={log.log_id}
                      className={`
                          rounded-xl
                          border-l-4
                          ${style.border}
                          bg-white
                          border
                          border-gray-200
                          hover:shadow-md
                          transition-all
                          duration-200
                        `}
                    >
                      <div className="p-4">

                        {/* Title */}

                        <div className="mb-1">
                          <h4
                            className={`
                              text-sm
                              font-bold
                              tracking-wide
                             
                            `}
                          >
                            {style.label}
                          </h4>
                        </div>

                        {/* Description */}

                        <p className="text-sm text-gray-600 mb-4">
                          {getLogDescription(log)}
                        </p>

                        {/* Edit Details */}

                        {log.log_type === 'edit' && (
                          <div className="mb-4 text-sm">
                            <div className="text-gray-500">
                              From:
                              <span className="ml-2 text-gray-700">
                                {log.old_value || '-'}
                              </span>
                            </div>

                            <div className="text-gray-500">
                              To:
                              <span className="ml-2 font-semibold text-gray-900">
                                {log.new_value || '-'}
                              </span>
                            </div>
                          </div>
                        )}

                        {/* Footer */}

                        <div className="flex items-center justify-between">

                          <div className="flex items-center gap-2">

                            {/* Avatar */}

                            <div className="relative group">

                              <div
                                className={`
                                  w-8 h-8
                                  rounded-full
                                  ${style.avatar}
                                  text-white
                                  flex
                                  items-center
                                  justify-center
                                  text-sm
                                  font-bold
                                `}
                              >
                                {getInitials(log.action_by_name)}
                              </div>

                              {/* Email Tooltip */}

                              <div
                                className="
                                  hidden
                                  group-hover:block
                                  absolute
                                  bottom-full
                                  left-0
                                  mb-2
                                  px-3
                                  py-2
                                  bg-gray-900
                                  text-white
                                  text-sm
                                  rounded-lg
                                  whitespace-nowrap
                                  z-50
                                "
                              >
                                {log.action_by_name}
                              </div>
                            </div>

                            {/* Role */}

                            {log.action_by_role && (
                              <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-700 text-sm">
                                {log.action_by_role}
                              </span>
                            )}

                            {/* Date */}

                            <span className="text-sm text-gray-500">
                              {fmtDateTime(log.created_at)}
                            </span>
                          </div>

                          {/* Badge */}

                          <span
                            className={`
                              px-3
                              py-1
                              rounded-full
                              text-sm
                              font-semibold
                              ${style.badge}
                            `}
                          >
                            {style.label}
                          </span>

                        </div>
                      </div>
                    </div>
                  );
                  
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
