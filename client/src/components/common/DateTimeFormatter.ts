/**
 * DateTimeFormatter — Utility functions for formatting dates and times.
 * 
 * Provides helpers for standardized date/time display across the application.
 */

/**
 * Format a date string or Date object to: "12 June 2026 12:34:45 PM Monday"
 * 
 * @param strDateOrDate - ISO string, timestamp, or Date object
 * @returns Formatted string: "DD Month YYYY HH:MM:SS AM/PM DayName"
 */
export function fmtDateTimeFull(strDateOrDate: string | number | Date): string {
  try {
    const objDate = typeof strDateOrDate === 'string' || typeof strDateOrDate === 'number'
      ? new Date(strDateOrDate)
      : strDateOrDate;

    if (isNaN(objDate.getTime())) {
      return 'Invalid Date';
    }

    // Month names
    const lsMonths = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];

    // Day names
    const lsDays = [
      'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'
    ];

    const iDay = objDate.getDate();
    const strMonth = lsMonths[objDate.getMonth()];
    const iYear = objDate.getFullYear();
    let iHours = objDate.getHours();
    const iMinutes = objDate.getMinutes();
    const iSeconds = objDate.getSeconds();
    const strAMPM = iHours >= 12 ? 'PM' : 'AM';

    // Convert to 12-hour format
    iHours = iHours % 12;
    iHours = iHours ? iHours : 12; // 0 becomes 12

    // Pad with leading zeros
    const strHours = String(iHours).padStart(2, '0');
    const strMins = String(iMinutes).padStart(2, '0');
    const strSecs = String(iSeconds).padStart(2, '0');
    const strDayName = lsDays[objDate.getDay()];

    return `${iDay} ${strMonth} ${iYear} ${strHours}:${strMins}:${strSecs} ${strAMPM} ${strDayName}`;
  } catch (err) {
    return 'Invalid Date';
  }
}

/**
 * Format a date string or Date object to: "12 June 2026"
 * 
 * @param strDateOrDate - ISO string, timestamp, or Date object
 * @returns Formatted string: "DD Month YYYY"
 */
export function fmtDateOnly(strDateOrDate: string | number | Date): string {
  try {
    const objDate = typeof strDateOrDate === 'string' || typeof strDateOrDate === 'number'
      ? new Date(strDateOrDate)
      : strDateOrDate;

    if (isNaN(objDate.getTime())) {
      return 'Invalid Date';
    }

    const lsMonths = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];

    const iDay = objDate.getDate();
    const strMonth = lsMonths[objDate.getMonth()];
    const iYear = objDate.getFullYear();

    return `${iDay} ${strMonth} ${iYear}`;
  } catch (err) {
    return 'Invalid Date';
  }
}

/**
 * Format a date string or Date object to: "12:34:45 PM"
 * 
 * @param strDateOrDate - ISO string, timestamp, or Date object
 * @returns Formatted string: "HH:MM:SS AM/PM"
 */
export function fmtTimeOnly(strDateOrDate: string | number | Date): string {
  try {
    const objDate = typeof strDateOrDate === 'string' || typeof strDateOrDate === 'number'
      ? new Date(strDateOrDate)
      : strDateOrDate;

    if (isNaN(objDate.getTime())) {
      return 'Invalid Date';
    }

    let iHours = objDate.getHours();
    const iMinutes = objDate.getMinutes();
    const iSeconds = objDate.getSeconds();
    const strAMPM = iHours >= 12 ? 'PM' : 'AM';

    // Convert to 12-hour format
    iHours = iHours % 12;
    iHours = iHours ? iHours : 12; // 0 becomes 12

    const strHours = String(iHours).padStart(2, '0');
    const strMins = String(iMinutes).padStart(2, '0');
    const strSecs = String(iSeconds).padStart(2, '0');

    return `${strHours}:${strMins}:${strSecs} ${strAMPM}`;
  } catch (err) {
    return 'Invalid Date';
  }
}
