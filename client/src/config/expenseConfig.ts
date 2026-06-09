/**
 * Expense Configuration
 * 
 * Central configuration for expense management features.
 * Modify these values to change system-wide behavior.
 */

/**
 * EXPENSE_LOOKBACK_DAYS
 * 
 * Maximum number of days in the past that users can select for expense dates.
 * 
 * Example:
 *   - Value: 90 → Users can select dates from 90 days ago to today
 *   - Value: 30 → Users can select dates from 30 days ago to today
 *   - Value: 365 → Users can select dates from 365 days ago (1 year) to today
 * 
 * Note: Maximum date is always TODAY (cannot select future dates)
 */
export const EXPENSE_LOOKBACK_DAYS = 2;

/**
 * EXPENSE_DATE_FORMAT
 * Display format for expense dates in the application
 */
export const EXPENSE_DATE_FORMAT = 'DD/MM/YYYY';

/**
 * Helper function to get today's date at midnight (start of day)
 * @returns Date object set to today at 00:00:00
 */
export function getTodayDate(): Date {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

/**
 * Helper function to get the minimum selectable date based on EXPENSE_LOOKBACK_DAYS
 * @returns Date object set to (today - EXPENSE_LOOKBACK_DAYS) at 00:00:00
 */
export function getMinExpenseDate(): Date {
  const minDate = new Date();
  minDate.setDate(minDate.getDate() - EXPENSE_LOOKBACK_DAYS);
  minDate.setHours(0, 0, 0, 0);
  return minDate;
}

/**
 * Get a readable string showing the allowed date range for user guidance
 * @returns String like "Last 90 days"
 */
export function getExpenseDateRangeText(): string {
  return `Last ${EXPENSE_LOOKBACK_DAYS} days`;
}
