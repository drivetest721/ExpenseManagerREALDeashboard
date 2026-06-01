/**
 * ActivityLogsPanel — Right panel for detail view showing activity timeline.
 *
 * Features:
 * - Activity logs show detailed action history with status badges
 * - Latest log at the top
 * - Email and details hidden by default, expand on click
 * - Search by name, email, message
 * - Toggle to show/hide private messages
 */
import { useState, useMemo } from 'react';
import {
  Search,
  ChevronDown,
  ChevronRight,
  Lock,
  Unlock,
  CheckCircle,
  Clock,
  User,
  XCircle,
  Send,
  ThumbsUp,
  HelpCircle,
  RotateCcw,
  Ban,
  CreditCard,
  Check,
  AlertCircle,
} from 'lucide-react';
import type { ChainStep, ChainLog } from '../../utils/reimbursementApi';
import { useAuth } from '../../hooks/useAuth';

interface Props {
  lsChain: ChainStep[];
  iCurrentStep: number;
  lsLogs: ChainLog[];
  strInitiatorName: string;
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
    label: 'Query Raised', 
    cls: 'bg-orange-100 text-orange-700 border-orange-300', 
    Icon: HelpCircle,
    description: 'Query raised - response required' 
  },
  ASK: { 
    label: 'Private Ask', 
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

function fmtDateTime(str: string): string {
  if (!str) return '—';
  const d = new Date(str);
  return d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export default function ActivityLogsPanel({
  lsChain,
  iCurrentStep,
  lsLogs,
  strInitiatorName,
}: Props) {
  const { objUser } = useAuth();
  const [strSearchQuery, setStrSearchQuery] = useState('');
  const [bShowPrivate, setBShowPrivate] = useState(true);
  const [setExpandedLogs, setSetExpandedLogs] = useState<Set<string>>(new Set());

  const bIsOwner = objUser?.departments?.some((d) => d.role === 'owner') ?? false;
  const strInitiatorId = lsLogs.find(l => l.action === 'SUBMIT')?.action_by || '';

  // Filter logs
  const lsFilteredLogs = useMemo(() => {
    let lsFiltered = lsLogs.filter((log) => {
      const bIsPrivate = log.visibility === 'private';
      // Filter: if private toggle is off and log is private, skip it unless user is owner/initiator/involved
      if (!bShowPrivate && bIsPrivate) {
        const bInvolved =
          log.action_by === objUser?.user_id || 
          bIsOwner ||
          strInitiatorId === objUser?.user_id;
        if (!bInvolved) return false;
      }
      return true;
    });

    // Apply search filter
    if (strSearchQuery.trim()) {
      const q = strSearchQuery.toLowerCase();
      lsFiltered = lsFiltered.filter((log) =>
        log.action_by_name?.toLowerCase().includes(q) ||
        log.action_by_email?.toLowerCase().includes(q) ||
        log.message.toLowerCase().includes(q)
      );
    }

    // Sort by timestamp descending (latest first)
    return lsFiltered.sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }, [lsLogs, bShowPrivate, strSearchQuery, objUser, bIsOwner, strInitiatorId]);

  const toggleExpand = (strLogId: string) => {
    setSetExpandedLogs((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(strLogId)) {
        newSet.delete(strLogId);
      } else {
        newSet.add(strLogId);
      }
      return newSet;
    });
  };

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
        <div className="flex items-center gap-2 mb-3">
          <Clock className="w-5 h-5 text-[#00703C]" />
          <h3 className="text-lg font-bold text-gray-900">Activity Timeline</h3>
          <span className="text-xs text-gray-600">({lsFilteredLogs.length} activities)</span>
        </div>

        {/* Search */}
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search activity logs..."
            value={strSearchQuery}
            onChange={(e) => setStrSearchQuery(e.target.value)}
            className="w-full h-10 pl-10 pr-3 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Toggle Private */}
        <button
          onClick={() => setBShowPrivate(!bShowPrivate)}
          className={`flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-full transition-colors ${
            bShowPrivate
              ? 'bg-purple-100 text-purple-700 hover:bg-purple-200'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          {bShowPrivate ? (
            <Unlock className="w-3.5 h-3.5" />
          ) : (
            <Lock className="w-3.5 h-3.5" />
          )}
          {bShowPrivate ? 'Hide Private Messages' : 'Show Private Messages'}
        </button>
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
                  <button
                    onClick={() => toggleExpand(log.log_id)}
                    className="w-full p-4 text-left"
                  >
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
                        {log.message && (
                          <div className="mt-2 p-2 bg-gray-100 rounded text-sm text-gray-800 border-l-4 border-[#00703C]">
                            {bExpanded ? log.message : log.message.substring(0, 100) + (log.message.length > 100 ? '...' : '')}
                          </div>
                        )}
                      </div>

                      {/* Expand Icon */}
                      <div className="flex-shrink-0">
                        {bExpanded ? (
                          <ChevronDown className="w-5 h-5 text-gray-400" />
                        ) : (
                          <ChevronRight className="w-5 h-5 text-gray-400" />
                        )}
                      </div>
                    </div>
                  </button>

                  {/* Expanded Details */}
                  {bExpanded && (
                    <div className="px-4 pb-4 space-y-2 border-t-2 border-gray-200 pt-3 bg-gray-50">
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
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
