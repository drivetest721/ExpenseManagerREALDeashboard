/**
 * Activity Log Types
 * 
 * Defines types for the three log types:
 * 1. Edit - Form field changes
 * 2. Activity - Workflow actions (submit, approve, query, etc.)
 * 3. View - Page views
 */

export type LogType = 'edit' | 'activity' | 'view';

export interface ActivityLog {
  log_id: string;
  reimbursement_id: string;
  log_type: LogType;
  action: string;
  action_by: string;
  action_by_name: string;
  action_by_email: string;
  action_by_role?: string;
  action_by_department?: string;
  field_name?: string;
  old_value?: string;
  new_value?: string;
  old_status?: string;
  new_status?: string;
  message?: string;
  visibility: 'public' | 'private';
  created_at: string;
}

export interface LogDateFormat {
  day: string;     // "Wed"
  date: string;    // "13 June"
  time: string;    // "12:34:46 PM IST"
}

/**
 * Format ISO date string to display format
 */
export function formatLogDate(isoDate: string): LogDateFormat {
  const d = new Date(isoDate);
  return {
    day: d.toLocaleDateString('en-US', { weekday: 'short' }),
    date: d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
    time: d.toLocaleTimeString('en-IN', { 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit',
      hour12: true,
      timeZone: 'Asia/Kolkata'
    }) + ' IST',
  };
}
