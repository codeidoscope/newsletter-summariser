const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5175/api';

/**
 * Uses the Navigator.sendBeacon API to send data on page unload.
 * This method is designed to reliably send data even when the page is closing.
 */
export const sendBeacon = (endpoint: string, data: any): boolean => {
  if (!navigator.sendBeacon) {
    console.warn('sendBeacon is not supported in this browser');
    return false;
  }
  
  try {
    const url = `${API_BASE_URL}/${endpoint}`;
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    return navigator.sendBeacon(url, blob);
  } catch (error) {
    console.error('Error sending beacon:', error);
    return false;
  }
};

/**
 * Send tracking data via beacon when the page is closing
 */
export const sendTrackingBeacon = (userEmail: string, reason: string): boolean => {
  return sendBeacon('send-tracking-data', { userEmail, reason });
};