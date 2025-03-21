/**
 * BeaconService.ts
 * 
 * This service utilizes the Navigator.sendBeacon API to reliably send tracking data
 * when a user is leaving the page (during tab/browser close or navigation away).
 * 
 * The sendBeacon API is specifically designed for this use case and is more reliable
 * than XMLHttpRequest or fetch during page unloading.
 */

// Base URL for API requests
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5175/api';

/**
 * Uses the Navigator.sendBeacon API to send data on page unload.
 * This method is designed to reliably send data even when the page is closing.
 * 
 * @param endpoint The API endpoint to send data to
 * @param data The data to send
 * @returns boolean True if the beacon was successfully queued, false otherwise
 */
export const sendBeacon = (endpoint: string, data: any): boolean => {
  // Check if sendBeacon is supported in this browser
  if (!navigator.sendBeacon) {
    console.warn('sendBeacon is not supported in this browser. Tracking data may not be sent reliably on page close.');
    return false;
  }
  
  try {
    // Construct the URL correctly to avoid /api/api/ doubling
    // If API_BASE_URL already includes /api, don't add it again
    let url: string;
    
    if (API_BASE_URL.endsWith('/api')) {
      // API_BASE_URL already has /api suffix, so just add the endpoint
      url = `${API_BASE_URL}/${endpoint}`;
    } else {
      // API_BASE_URL doesn't have /api suffix, so add it
      url = `${API_BASE_URL}/api/${endpoint}`;
    }
    
    console.log(`Sending beacon to URL: ${url}`);
    
    // Add timestamp if not already present
    const dataWithTimestamp = {
      ...data,
      timestamp: data.timestamp || new Date().toISOString()
    };
    
    // Ensure data is properly formatted as a Blob with the correct MIME type
    // This is important for the server to properly parse the request
    const blob = new Blob([JSON.stringify(dataWithTimestamp)], { type: 'application/json' });
    
    // Send the beacon and capture the result
    const result = navigator.sendBeacon(url, blob);
    
    // Log whether the beacon was successfully queued
    if (result) {
      console.log(`Beacon successfully queued to ${url}`);
    } else {
      console.warn(`Failed to queue beacon to ${url}. The browser may have rejected the request.`);
      
      // Fallback to fetch with keepalive if sendBeacon fails
      try {
        fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(dataWithTimestamp),
          keepalive: true,
          mode: 'cors'
          // Important: Do NOT include credentials: 'include' here as it can cause CORS issues
        });
        console.log(`Fallback fetch sent to ${url}`);
      } catch (fetchError) {
        console.error('Fallback fetch failed:', fetchError);
      }
    }
    
    return result;
  } catch (error) {
    console.error('Error sending beacon:', error);
    return false;
  }
};

/**
 * Send tracking data via beacon when the page is closing
 * 
 * @param userEmail The user's email for identification
 * @param reason The reason for sending tracking data
 * @returns boolean True if the beacon was successfully queued
 */
export const sendTrackingBeacon = (userEmail: string, reason: string): boolean => {
  console.log(`Attempting to send tracking beacon for ${userEmail} with reason: ${reason}`);
  
  return sendBeacon('track/page_close', { 
    userEmail, 
    reason,
    timestamp: new Date().toISOString(),
    path: window.location.pathname,
    userAgent: navigator.userAgent,
    viewport: {
      width: window.innerWidth,
      height: window.innerHeight
    }
  });
};

/**
 * Send tracking data and request email via beacon API
 * 
 * @param userEmail The user's email for identification
 * @param reason The reason for sending tracking data via email
 * @returns boolean True if the beacon was successfully queued
 */
export const sendTrackingEmailBeacon = (userEmail: string, reason: string): boolean => {
  console.log(`Attempting to send tracking email beacon for ${userEmail} with reason: ${reason}`);
  
  return sendBeacon('send-tracking-data', { 
    userEmail, 
    reason,
    timestamp: new Date().toISOString(),
    path: window.location.pathname,
    userAgent: navigator.userAgent
  });
};

/**
 * Send request to clear tracking data via beacon API
 * This is useful after successful email sending
 * 
 * @returns boolean True if the beacon was successfully queued
 */
export const clearTrackingDataBeacon = (): boolean => {
  console.log('Attempting to clear tracking data via beacon');
  
  return sendBeacon('clear-tracking-data', {
    timestamp: new Date().toISOString()
  });
};

/**
 * Helper function to use both regular tracking and beacon API
 * This provides redundancy for critical tracking events
 * 
 * @param userEmail The user's email for identification
 * @param reason The reason for sending tracking data
 * @returns boolean True if any beacon was successfully queued
 */
export const sendTrackingWithFallback = (userEmail: string, reason: string): boolean => {
  // First try to send the tracking data email request
  const emailBeaconResult = sendTrackingEmailBeacon(userEmail, reason);
  
  // Also track the page close event as regular tracking
  const trackingBeaconResult = sendTrackingBeacon(userEmail, reason);
  
  // Return true if either beacon was successfully queued
  return emailBeaconResult || trackingBeaconResult;
};

// At the end of BeaconService.ts
export const BeaconService = {
  sendBeacon,
  sendTrackingBeacon,
  sendTrackingEmailBeacon,
  clearTrackingDataBeacon,
  sendTrackingWithFallback
};