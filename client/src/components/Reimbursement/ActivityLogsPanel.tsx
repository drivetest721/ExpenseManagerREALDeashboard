/**
 * ActivityLogsPanel — Right panel for detail view showing activity timeline with tabs.
 *
 * Tabs:
 * - Activity Log: Shows detailed action history with status badges, search, etc.
 * - Approval Chain: Shows approval chain timeline with current reviewer, statuses, etc.
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
} from 'lucide-react';
import type { ChainStep, ChainLog } from '../../utils/reimbursementApi';
import { useAuth } from '../../hooks/useAuth';

interface Props {
  lsChain: ChainStep[];
  iCurrentStep: number;
  lsLogs: ChainLog[];
  strInitiatorName: string;
  strStatus?: string;
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

function fmtDateTime(str: string): string {
  if (!str) return '—';
  const d = new Date(str);
  return d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
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
  strStatus,
}: Props) {
  const { objUser } = useAuth();
  const [strSearchQuery, setStrSearchQuery] = useState('');
  const [bShowPrivate, setBShowPrivate] = useState(true);
  const [setExpandedLogs, setSetExpandedLogs] = useState<Set<string>>(new Set());
  const [strActiveTab, setStrActiveTab] = useState<'activity' | 'chain'>('activity');

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

  // Helper functions for Approval Chain
  function getStepIcon(stepStatus: string, bIsCurrent: boolean) {
    if (stepStatus === 'APPROVED') {
      return <CheckCircle className="w-5 h-5 text-green-600" />;
    } else if (bIsCurrent) {
      return <Clock className="w-5 h-5 text-yellow-600" />;
    } else if (stepStatus === 'REJECTED') {
      return <XCircle className="w-5 h-5 text-red-600" />;
    } else {
      return <User className="w-5 h-5 text-gray-400" />;
    }
  }

  function getStepColor(stepStatus: string, bIsCurrent: boolean) {
    if (stepStatus === 'APPROVED') return 'border-green-600 bg-green-50';
    if (bIsCurrent) return 'border-yellow-600 bg-yellow-50';
    if (stepStatus === 'REJECTED') return 'border-red-600 bg-red-50';
    return 'border-gray-300 bg-gray-50';
  }

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Tab Navigation */}
      <div className="border-b border-gray-200 bg-gradient-to-r from-green-50 to-emerald-50">
        <div className="flex">
          <button
            onClick={() => setStrActiveTab('activity')}
            className={`flex-1 px-4 py-3 text-sm font-semibold transition-all border-b-2 ${
              strActiveTab === 'activity'
                ? 'border-[#00703C] text-[#00703C] bg-white'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <Clock className="w-4 h-4" />
              Activity Log
            </div>
          </button>
          <button
            onClick={() => setStrActiveTab('chain')}
            className={`flex-1 px-4 py-3 text-sm font-semibold transition-all border-b-2 ${
              strActiveTab === 'chain'
                ? 'border-[#00703C] text-[#00703C] bg-white'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <User className="w-4 h-4" />
              Approval Chain
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
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search activity logs..."
                value={strSearchQuery}
                onChange={(e) => setStrSearchQuery(e.target.value)}
                className="w-full h-10 pl-10 pr-3 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
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
                            {log.message ? (
                              <div className="mt-2 rounded border border-gray-200 bg-gray-50 p-3 text-sm text-gray-800">
                                <div className="leading-relaxed">
                                  {bExpanded ? log.message : `${log.message.substring(0, 120)}${log.message.length > 120 ? '...' : ''}`}
                                </div>
                                {log.message.length > 120 && (
                                  <button
                                    type="button"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      toggleExpand(log.log_id);
                                    }}
                                    className="mt-2 text-sm font-semibold text-blue-700 hover:text-blue-900"
                                  >
                                    {bExpanded ? 'Read less' : 'Read more'}
                                  </button>
                                )}
                              </div>
                            ) : (
                              <div className="mt-2 rounded border border-gray-200 bg-gray-50 p-3 text-sm text-gray-600">
                                No description provided
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
        </>
      )}

      {/* Approval Chain Tab */}
      {strActiveTab === 'chain' && (
        <div className="flex-1 overflow-auto custom-scrollbar">
          <div className="p-4 space-y-6">
            {/* Approval Chain */}
            <div>
              <h4 className="text-sm font-semibold text-gray-900 mb-3 cursor-default">Approval Chain</h4>
              <div className="space-y-3">
                {lsChain.map((objStep, iIdx) => {
                  const bIsCurrent = !bIsTerminal && iIdx === iCurrentStep;
                  return (
                    <div
                      key={objStep.user_id}
                      className={`flex items-start gap-3 border-l-4 pl-4 py-2 rounded transition-all ${getStepColor(objStep.status, bIsCurrent)}`}
                    >
                      <div className="flex-shrink-0 mt-1">
                        {getStepIcon(objStep.status, bIsCurrent)}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">{objStep.name}</p>
                        <p className="text-xs text-gray-600">{objStep.email}</p>
                        <div className="flex items-center gap-2 mt-1 flex-wrap text-sm">
                          <span className="text-xs text-gray-500">
                            Priority {objStep.priority} • {objStep.approval_type}
                          </span>
                          {objStep.status === 'APPROVED' && objStep.approved_at && (
                            <span className="text-xs text-green-700 font-medium">
                              ✓ Approved on {new Date(objStep.approved_at).toLocaleDateString()}
                            </span>
                          )}
                          {bIsCurrent && (
                            <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded text-xs font-medium">
                              Awaiting Review
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Chain Summary */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-gray-900 mb-2 cursor-default">Status Summary</h4>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Total Steps:</span>
                  <span className="font-semibold text-gray-900">{lsChain.length}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Completed:</span>
                  <span className="font-semibold text-green-700">
                    {lsChain.filter(s => s.status === 'APPROVED').length}
                  </span>
                </div>
                {!bIsTerminal && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Current Step:</span>
                    <span className="font-semibold text-yellow-700">{iCurrentStep + 1}</span>
                  </div>
                )}
                {bIsTerminal && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Status:</span>
                    <span className="font-semibold text-green-700">Completed</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
