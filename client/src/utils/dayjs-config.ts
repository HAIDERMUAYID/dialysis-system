import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

// Extend dayjs with plugins
dayjs.extend(utc);
dayjs.extend(timezone);

// Baghdad timezone
const BAGHDAD_TIMEZONE = 'Asia/Baghdad';

/**
 * Convert date to Baghdad time (UTC+3)
 * @param date - Date string or Date object
 * @returns dayjs object adjusted to Baghdad time
 */
const toBaghdadTime = (date: string | Date | null | undefined) => {
  if (!date) return null;
  
  try {
    // If date is already a string in ISO format, parse it
    let d = dayjs(date);
    
    // Convert to Baghdad timezone
    // If the date is in UTC, convert it to Baghdad time
    // If the date is already in local time, we need to treat it as UTC first
    if (typeof date === 'string' && date.includes('Z')) {
      // ISO string with Z (UTC)
      d = dayjs.utc(date);
    } else if (typeof date === 'string' && date.includes('+')) {
      // ISO string with timezone offset
      d = dayjs(date);
    } else {
      // Assume it's UTC and convert
      d = dayjs.utc(date);
    }
    
    // Convert to Baghdad timezone (UTC+3)
    return d.tz(BAGHDAD_TIMEZONE);
  } catch (error) {
    console.warn('Date conversion error:', error, 'Date:', date);
    // Fallback: try to parse as local time and add offset
    try {
      const d = dayjs(date);
      // Baghdad is UTC+3, so we add 3 hours to UTC
      return d.utc().add(3, 'hour');
    } catch (e) {
      return dayjs(date);
    }
  }
};

/**
 * Format date in Baghdad timezone with 12-hour format
 * @param date - Date string or Date object
 * @param format - Format string (default: 'YYYY-MM-DD hh:mm A')
 * @returns Formatted date string
 */
export const formatBaghdadTime = (date: string | Date | null | undefined, format: string = 'YYYY-MM-DD hh:mm A'): string => {
  if (!date) return '-';
  
  try {
    const baghdadTime = toBaghdadTime(date);
    if (!baghdadTime || !baghdadTime.isValid()) return '-';
    return baghdadTime.format(format);
  } catch (error) {
    console.warn('Date formatting error:', error);
    return '-';
  }
};

/**
 * Format date only (without time) in Baghdad timezone
 * @param date - Date string or Date object
 * @returns Formatted date string (YYYY-MM-DD)
 */
export const formatBaghdadDate = (date: string | Date | null | undefined): string => {
  if (!date) return '-';
  
  try {
    const baghdadTime = toBaghdadTime(date);
    if (!baghdadTime || !baghdadTime.isValid()) return '-';
    return baghdadTime.format('YYYY-MM-DD');
  } catch (error) {
    console.warn('Date formatting error:', error);
    return '-';
  }
};

/**
 * Format time only in 12-hour format with Baghdad timezone
 * @param date - Date string or Date object
 * @returns Formatted time string (hh:mm A)
 */
export const formatBaghdadTimeOnly = (date: string | Date | null | undefined): string => {
  if (!date) return '-';
  
  try {
    const baghdadTime = toBaghdadTime(date);
    if (!baghdadTime || !baghdadTime.isValid()) return '-';
    return baghdadTime.format('hh:mm A');
  } catch (error) {
    console.warn('Date formatting error:', error);
    return '-';
  }
};

/**
 * Format date in Arabic format (DD/MM/YYYY) with 12-hour time
 * @param date - Date string or Date object
 * @returns Formatted date string (DD/MM/YYYY hh:mm A)
 */
export const formatBaghdadDateTimeArabic = (date: string | Date | null | undefined): string => {
  if (!date) return '-';
  
  try {
    const baghdadTime = toBaghdadTime(date);
    if (!baghdadTime || !baghdadTime.isValid()) return '-';
    return baghdadTime.format('DD/MM/YYYY hh:mm A');
  } catch (error) {
    console.warn('Date formatting error:', error);
    return '-';
  }
};

/**
 * Get current time in Baghdad timezone
 * @returns dayjs object in Baghdad timezone
 */
export const getBaghdadTime = () => {
  return dayjs().tz(BAGHDAD_TIMEZONE);
};

/**
 * Parse date string and convert to Baghdad timezone
 * @param date - Date string or Date object
 * @returns dayjs object in Baghdad timezone
 */
export const parseBaghdadTime = (date: string | Date) => {
  return toBaghdadTime(date) || dayjs(date);
};

export default dayjs;
