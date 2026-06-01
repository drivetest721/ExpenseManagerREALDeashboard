/**
 * ChainView â€” displays approval chain timeline with status, logs, and actions.
 */
import { CheckCircle, Clock, XCircle, User, Lock, HelpCircle, ThumbsUp, RotateCcw, Send, Ban, CreditCard, Check } from 'lucide-react';
import type { ChainStep, ChainLog } from '../../utils/reimbursementApi';

interface ChainViewProps {
  lsChain: ChainStep[];
  iCurrentStep: number;
  strCurrentReviewerId: string;
  lsLogs: ChainLog[];
  strStatus?: string;
}

const ACTION_STYLE: Record<string, { label: string; cls: string; ring: string; Icon: any }> = {
  SUBMIT:       { label: 'Submitted',      cls: 'bg-emerald-100 text-emerald-700', ring: 'ring-emerald-200', Icon: Send },
  APPROVE:      { label: 'Approved',       cls: 'bg-green-100 text-green-700',     ring: 'ring-green-200',   Icon: ThumbsUp },
  QUERY:        { label: 'Query',          cls: 'bg-orange-100 text-orange-700',   ring: 'ring-orange-200',  Icon: HelpCircle },
  ASK:          { label: 'Ask',            cls: 'bg-purple-100 text-purple-700',   ring: 'ring-purple-200',  Icon: Lock },
  REAPPLY:      { label: 'Reapplied',      cls: 'bg-blue-100 text-blue-700',       ring: 'ring-blue-200',    Icon: RotateCcw },
  CA_QUERY:     { label: 'CA Query',       cls: 'bg-orange-100 text-orange-700',   ring: 'ring-orange-200',  Icon: HelpCircle },
  CA_REAPPLY:   { label: 'Reapplied (CA)', cls: 'bg-blue-100 text-blue-700',       ring: 'ring-blue-200',    Icon: RotateCcw },
  PAY:          { label: 'Paid',           cls: 'bg-emerald-100 text-emerald-700', ring: 'ring-emerald-200', Icon: CreditCard },
  ACKNOWLEDGE:  { label: 'Acknowledged',   cls: 'bg-green-100 text-green-700',     ring: 'ring-green-200',   Icon: Check },
  REJECT:       { label: 'Rejected',       cls: 'bg-red-100 text-red-700',         ring: 'ring-red-200',     Icon: Ban },
};

const ROLE_LABEL: Record<string, string> = {
  owner: 'Owner',
  ca: 'CA',
  senior_manager: 'Sr. Manager',
  manager: 'Manager',
  employee: 'Employee',
};

function getInitials(strName: string): string {
  if (!strName) return '?';
  const lsParts = strName.trim().split(/\s+/);
  if (lsParts.length === 1) return lsParts[0].slice(0, 2).toUpperCase();
  return (lsParts[0][0] + lsParts[lsParts.length - 1][0]).toUpperCase();
}

export default function ChainView({
  lsChain,
  iCurrentStep,
  strCurrentReviewerId,
  lsLogs,
  strStatus,
}: ChainViewProps) {
  void strCurrentReviewerId;
  const bIsTerminal = strStatus === 'PAID' || strStatus === 'PAYMENT_ACKNOWLEDGED' || strStatus === 'CLOSED' || strStatus === 'REJECTED';
  function getStepIcon(strStatus: string, bIsCurrent: boolean) {
    if (strStatus === 'APPROVED') {
      return <CheckCircle className="w-5 h-5 text-green-600" />;
    } else if (bIsCurrent) {
      return <Clock className="w-5 h-5 text-yellow-600" />;
    } else if (strStatus === 'REJECTED') {
      return <XCircle className="w-5 h-5 text-red-600" />;
    } else {
      return <User className="w-5 h-5 text-gray-400" />;
    }
  }

  function getStepColor(strStatus: string, bIsCurrent: boolean) {
    if (strStatus === 'APPROVED') return 'border-green-600 bg-green-50';
    if (bIsCurrent) return 'border-yellow-600 bg-yellow-50';
    if (strStatus === 'REJECTED') return 'border-red-600 bg-red-50';
    return 'border-gray-300 bg-gray-50';
  }

  return (
    <div className="space-y-6">
      {/* Approval Chain */}
      <div>
        <h4 className="text-sm font-semibold text-gray-900 mb-3 cursor-default">Approval Chain</h4>
        <div className="space-y-3">
          {lsChain.map((objStep, iIdx) => {
            const bIsCurrent = !bIsTerminal && iIdx === iCurrentStep;
            return (
              <div
                key={objStep.user_id}
                className={`flex items-start gap-3 border-l-4 pl-4 py-2 rounded ${getStepColor(objStep.status, bIsCurrent)}`}
              >
                <div className="flex-shrink-0 mt-1">
                  {getStepIcon(objStep.status, bIsCurrent)}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">{objStep.name}</p>
                  <p className="text-xs text-gray-600">{objStep.email}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-gray-500">
                      Priority {objStep.priority} â€¢ {objStep.approval_type}
                    </span>
                    {objStep.status === 'APPROVED' && objStep.approved_at && (
                      <span className="text-xs text-green-700">
                        âœ“ Approved on {new Date(objStep.approved_at).toLocaleDateString()}
                      </span>
                    )}
                    {bIsCurrent && (
                      <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded text-xs font-medium">
                        Current Reviewer
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Activity Timeline */}
      {lsLogs.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-gray-900 mb-3 cursor-default">Activity Timeline</h4>
          <ol className="relative border-l-2 border-gray-200 ml-3 space-y-4 pl-6">
            {lsLogs.map((objLog) => {
              const objStyle = ACTION_STYLE[objLog.action] || { label: objLog.action, cls: 'bg-gray-100 text-gray-700', ring: 'ring-gray-200', Icon: User };
              const ObjIcon = objStyle.Icon;
              const strRoleLabel = objLog.action_by_role ? (ROLE_LABEL[objLog.action_by_role] || objLog.action_by_role) : '';
              const strName = objLog.action_by_name || 'Unknown user';
              const strDept = objLog.action_by_department || '';
              const strEmail = objLog.action_by_email || '';
              const bPrivate = objLog.visibility === 'private';
              return (
                <li key={objLog.log_id} className="relative">
                  <span className={`absolute -left-[37px] top-0 flex items-center justify-center w-8 h-8 rounded-full bg-white ring-2 ${objStyle.ring}`}>
                    <ObjIcon className="w-4 h-4 text-gray-700" />
                  </span>
                  <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm">
                    <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`px-2 py-0.5 rounded text-xs font-semibold ${objStyle.cls}`}>{objStyle.label}</span>
                        {bPrivate && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-orange-100 text-orange-700 rounded text-xs font-medium">
                            <Lock className="w-3 h-3" /> Private
                          </span>
                        )}
                      </div>
                      <time className="text-xs text-gray-500 whitespace-nowrap">
                        {new Date(objLog.created_at).toLocaleString()}
                      </time>
                    </div>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[#00703C]/10 text-[#00703C] flex items-center justify-center text-xs font-semibold">
                        {getInitials(strName)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {strName}
                          {strRoleLabel && <span className="ml-1 text-xs text-gray-500 font-normal">({strRoleLabel})</span>}
                        </p>
                        <p className="text-xs text-gray-500 truncate">
                          {strDept && <span>{strDept}</span>}
                          {strDept && strEmail && <span className="mx-1">Â·</span>}
                          {strEmail && <span>{strEmail}</span>}
                        </p>
                      </div>
                    </div>
                    {objLog.message && (
                      <blockquote className="text-sm text-gray-700 border-l-4 border-gray-200 pl-3 py-1 italic">
                        {objLog.message}
                      </blockquote>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      )}

      {lsLogs.length === 0 && (
        <p className="text-sm text-gray-600 cursor-default">No activity yet.</p>
      )}
    </div>
  );
}
