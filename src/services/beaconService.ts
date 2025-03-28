/**
 * BeaconService.ts
 * 
 * This service utilizes the Navigator.sendBeacon API to reliably send tracking data
 * when a user is leaving the page (during tab/browser close or navigation away).
 * 
 * The sendBeacon API is specifically designed for this use case and is more reliable
 * than XMLHttpRequest or fetch during page unloading.
 */

import { buildApiUrl } from '../utils/urlHelper';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5175';

export const sendBeacon = (endpoint: string, data: any): boolean => {
  if (!navigator.sendBeacon) {
    console.warn('sendBeacon is not supported in this browser. Tracking data may not be sent reliably on page close.');
    return false;
  }
  
  try {
    const url = buildApiUrl(endpoint, API_BASE_URL);
    
    console.log(`Sending beacon to URL: ${url}`);
    
    const dataWithTimestamp = {
      ...data,
      timestamp: data.timestamp || new Date().toISOString()
    };
    
    const blob = new Blob([JSON.stringify(dataWithTimestamp)], { type: 'application/json' });
    
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

export const sendTrackingBeacon = (userEmail: string, reason: string): boolean => {
  console.log(`Attempting to send tracking beacon for ${userEmail} with reason: ${reason}`);
  
  return sendBeacon('track/page_close', { 
    userEmail, 
    reason,
    timestamp: new Date().toISOString(),
    viewport: {
      width: window.innerWidth,
      height: window.innerHeight
    }
  });
};

export const sendTrackingEmailBeacon = (userEmail: string, reason: string): boolean => {
  console.log(`Attempting to send tracking email beacon for ${userEmail}`);
  
  const url = buildApiUrl('send-tracking-data');
  
  const data = { 
    userEmail, 
    reason,
    timestamp: new Date().toISOString()
  };
  
  const blob = new Blob([JSON.stringify(data)], {type: 'application/json'});
  
  const result = navigator.sendBeacon(url, blob);
  
  console.log(`Beacon send attempt result: ${result}`);
  return result;
}

export const clearTrackingDataBeacon = (): boolean => {
  console.log('Attempting to clear tracking data via beacon');
  
  return sendBeacon('clear-tracking-data', {
    timestamp: new Date().toISOString()
  });
};

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