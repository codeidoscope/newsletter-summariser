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
    // Construct the URL correctly
    const url = `${API_BASE_URL}/api/${endpoint}`.replace('/api/api/', '/api/');
    
    console.log(`Sending beacon to URL: ${url}`);
    
    // Add timestamp if not already present
    const dataWithTimestamp = {
      ...data,
      timestamp: data.timestamp || new Date().toISOString()
    };
    
    // Ensure data is properly formatted as a Blob with the correct MIME type
    const blob = new Blob([JSON.stringify(dataWithTimestamp)], { type: 'application/json' });
    
    // Send the beacon and capture the result
    const result = navigator.sendBeacon(url, blob);
    
    if (result) {
      console.log(`Beacon successfully queued to ${url}`);
    } else {
      console.warn(`Failed to queue beacon to ${url}. The browser may have rejected the request.`);
      
      // Improved fallback: Use fetch with keepalive
      try {
        fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(dataWithTimestamp),
          keepalive: true,
          mode: 'cors'
        }).then(() => console.log('Fallback fetch completed'))
          .catch(e => console.error('Fallback fetch promise rejected:', e));
        
        console.log(`Fallback fetch sent to ${url}`);
        return true; // Consider the fallback attempt as success
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
  console.log(`Attempting to send tracking email beacon for ${userEmail}`);
  
  // Create the URL correctly
  const url = `${API_BASE_URL}/send-tracking-data`.replace('/api/api/', '/api/');
  
  // Format the data
  const data = { 
    userEmail, 
    reason,
    timestamp: new Date().toISOString()
  };
  
  // Convert to blob - this is crucial for the Beacon API
  const blob = new Blob([JSON.stringify(data)], {type: 'application/json'});
  
  // Send the beacon directly rather than through your helper
  const result = navigator.sendBeacon(url, blob);
  
  console.log(`Beacon send attempt result: ${result}`);
  return result;
}

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

// Export the service functions
export const BeaconService = {
  sendBeacon,
  sendTrackingBeacon,
  sendTrackingEmailBeacon,
  clearTrackingDataBeacon,
  sendTrackingWithFallback
};