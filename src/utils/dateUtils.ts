
/**
 * Parses a localized date string into a Date object
 * Works with date strings in various formats that come from the Gmail API
 */
export const parseEmailDate = (dateString: string): Date => {
    // First, try standard parsing
    const parsedDate = new Date(dateString);
    
    // Check if the parsing worked correctly
    if (!isNaN(parsedDate.getTime())) {
      return parsedDate;
    }
    
    // If standard parsing failed, try to extract parts from string with a more flexible approach
    // This handles localized formats like "MM/DD/YYYY, HH:MM" or "DD/MM/YYYY, HH:MM"
    
    // Try to extract date components using regular expressions
    const dateTimePattern = /(\d{1,4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,4}).*?(\d{1,2}):(\d{1,2})/;
    const match = dateString.match(dateTimePattern);
    
    if (match) {
      // Extract matched groups
      const [_, part1, part2, part3, hours, minutes] = match;
      
      // Determine which format we have (MM/DD/YYYY or DD/MM/YYYY or YYYY/MM/DD)
      let year, month, day;
      
      // If first part is 4 digits, assume YYYY/MM/DD
      if (part1.length === 4) {
        year = parseInt(part1);
        month = parseInt(part2) - 1; // JavaScript months are 0-based
        day = parseInt(part3);
      } 
      // Otherwise, try to deduce based on local conventions and values
      else {
        // Check if part3 is clearly a year (4 digits)
        if (part3.length === 4) {
          year = parseInt(part3);
          
          // Now decide if part1 is month or day
          // In US format, month comes first
          // In most other countries, day comes first
          // For simplicity, assume day is 31 or less
          if (parseInt(part1) > 12 && parseInt(part1) <= 31) {
            day = parseInt(part1);
            month = parseInt(part2) - 1; // JavaScript months are 0-based
          } else {
            month = parseInt(part1) - 1; // JavaScript months are 0-based
            day = parseInt(part2);
          }
        } else {
          // If part3 isn't a 4-digit year, make a best guess
          // This is a fallback and may not be accurate
          const currentYear = new Date().getFullYear();
          year = parseInt(part3) < 100 ? 2000 + parseInt(part3) : parseInt(part3);
          month = parseInt(part1) - 1;
          day = parseInt(part2);
        }
      }
      
      const hoursNum = parseInt(hours);
      const minutesNum = parseInt(minutes);
      
      return new Date(year, month, day, hoursNum, minutesNum);
    }
    
    // If all else fails, return original parsed date
    return parsedDate;
  };
  
  /**
   * Checks if a date is today
   */
  export const isToday = (date: Date): boolean => {
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };
  
  /**
   * Checks if a date is within the current week (last 7 days)
   */
  export const isThisWeek = (date: Date): boolean => {
    const now = new Date();
    const oneWeekAgo = new Date(now);
    oneWeekAgo.setDate(now.getDate() - 7);
    
    return date >= oneWeekAgo && date <= now;
  };