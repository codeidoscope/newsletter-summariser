import { 
  parse,
  parseISO, 
  isValid, 
  isToday as isTodayFns, 
  subDays, 
  isAfter,
  format
} from 'date-fns';

/**
 * Parses a localized date string into a Date object
 * Uses date-fns for robust date parsing
 */
export const parseEmailDate = (dateString: string): Date => {
  // First try standard Date parsing
  const parsedDate = new Date(dateString);

  // If valid, return it
  if (isValid(parsedDate)) {
    return parsedDate;
  }

  // Try parsing as ISO format
  try {
    const isoDate = parseISO(dateString);
    if (isValid(isoDate)) {
      return isoDate;
    }
  } catch (error) {
    // Continue to other parsing methods
  }

  // Try various date formats that might appear in emails
  const formatAttempts = [
    'MM/dd/yyyy, HH:mm', // US format with time
    'dd/MM/yyyy, HH:mm', // EU format with time
    'yyyy/MM/dd, HH:mm', // ISO-like with time
    'MM/dd/yyyy HH:mm',  // Without comma
    'dd/MM/yyyy HH:mm',  // Without comma
    'yyyy-MM-dd HH:mm',  // Dash format
    'MM-dd-yyyy HH:mm',  // Dash format US
    'dd-MM-yyyy HH:mm',  // Dash format EU
    'MMM d, yyyy, HH:mm', // Month name format
    'MMMM d, yyyy, HH:mm', // Full month name
    'E, MMM d, yyyy, HH:mm', // With day of week
    'E, d MMM yyyy HH:mm:ss Z', // RFC format
  ];

  for (const formatString of formatAttempts) {
    try {
      const date = parse(dateString, formatString, new Date());
      if (isValid(date)) {
        return date;
      }
    } catch (error) {
      // Try next format
      continue;
    }
  }

  // If all parsing attempts fail, log warning and return original parsing result
  console.warn(`Unable to parse date string: ${dateString}`);
  return parsedDate;
};

/**
 * Formats a date for display
 */
export const formatDate = (date: Date): string => {
  return format(date, 'MMM d, yyyy h:mm a');
};

/**
 * Checks if a date is today
 */
export const isToday = (date: Date): boolean => {
  return isTodayFns(date);
};

/**
 * Checks if a date is within the current week (last 7 days)
 */
export const isThisWeek = (date: Date): boolean => {
  const today = new Date();
  const oneWeekAgo = subDays(today, 7);

  return isAfter(date, oneWeekAgo);
};

/**
 * Gets a relative time string (e.g., "2 hours ago", "Yesterday")
 */
export const getRelativeTimeString = (date: Date): string => {
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) {
    return 'Just now';
  }

  if (diffInSeconds < 3600) {
    const minutes = Math.floor(diffInSeconds / 60);
    return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'} ago`;
  }

  if (diffInSeconds < 86400) {
    const hours = Math.floor(diffInSeconds / 3600);
    return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
  }

  if (isTodayFns(date)) {
    return 'Today';
  }

  if (diffInSeconds < 604800) {
    if (diffInSeconds < 172800) {
      return 'Yesterday';
    }
    const days = Math.floor(diffInSeconds / 86400);
    return `${days} days ago`;
  }

  return format(date, 'MMM d, yyyy');
};