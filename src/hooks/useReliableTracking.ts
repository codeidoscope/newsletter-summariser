import { useEffect, useRef } from 'react';
import { BeaconService } from '../services/beaconService';
import { sendTrackingDataAndClear } from '../services/trackingService';

interface ReliableTrackingOptions {
  userEmail: string | null;
  isActive: boolean;
  trackingInterval?: number; // How often to send tracking data in ms
}

/**
 * A hook that provides periodic and reliable tracking functionality
 */
export const useReliableTracking = ({
  userEmail,
  isActive,
  trackingInterval = 5 * 60 * 1000 // Default to 5 minutes
}: ReliableTrackingOptions) => {
  const lastTrackingSent = useRef<number>(Date.now());
  const intervalRef = useRef<number | null>(null);
  
  // Send tracking data periodically
  useEffect(() => {
    if (!isActive || !userEmail) {
      // Clear interval if user becomes inactive or logs out
      if (intervalRef.current !== null) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    // Only create interval if we have a user email and they're active
    const sendPeriodicTracking = async () => {
      const now = Date.now();
      const timeSinceLastTracking = now - lastTrackingSent.current;
      
      // Only send if we haven't sent recently
      if (timeSinceLastTracking >= trackingInterval) {
        try {
          console.log(`Sending periodic tracking data (${Math.round(timeSinceLastTracking / 1000)}s interval)`);
          await sendTrackingDataAndClear(userEmail, 'Periodic Background Tracking');
          lastTrackingSent.current = now;
        } catch (error) {
          console.error('Error sending periodic tracking:', error);
          // Use beacon as fallback
          BeaconService.sendTrackingEmailBeacon(userEmail, 'Periodic Tracking (Fallback)');
        }
      }
    };

    // Send tracking right away when hook is first activated
    sendPeriodicTracking();
    
    // Set up interval for periodic tracking
    intervalRef.current = window.setInterval(sendPeriodicTracking, 60000); // Check every minute
    
    return () => {
      if (intervalRef.current !== null) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isActive, userEmail, trackingInterval]);
  
  // Return function to manually trigger tracking
  const sendTrackingNow = async (reason: string = 'Manual Trigger') => {
    if (!userEmail) return false;
    
    try {
      await sendTrackingDataAndClear(userEmail, reason);
      lastTrackingSent.current = Date.now();
      return true;
    } catch (error) {
      console.error('Error sending manual tracking:', error);
      // Use beacon as fallback
      return BeaconService.sendTrackingEmailBeacon(userEmail, `${reason} (Fallback)`);
    }
  };
  
  return { sendTrackingNow };
};