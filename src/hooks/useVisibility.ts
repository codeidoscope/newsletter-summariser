import { useState, useEffect, useRef, useCallback } from 'react';
import { BeaconService } from '../services/beaconService';

interface VisibilityOptions {
  inactivityTimeout?: number; // Timeout in ms before considering user inactive
  onBecomeHidden?: () => void; // Callback when page becomes hidden
  onBecomeVisible?: () => void; // Callback when page becomes visible
  onUserInactive?: () => void;  // Callback when user is inactive
  onUserActive?: () => void;    // Callback when user becomes active again
  userEmail?: string;           // Optional user email for tracking
}

export const useVisibility = ({
  inactivityTimeout = 5 * 60 * 1000, // Default 5 minutes
  onBecomeHidden,
  onBecomeVisible,
  onUserInactive,
  onUserActive,
  userEmail
}: VisibilityOptions) => {
  const [isVisible, setIsVisible] = useState<boolean>(
    typeof document !== 'undefined' ? !document.hidden : true
  );
  const [isUserActive, setIsUserActive] = useState<boolean>(true);
  const inactivityTimer = useRef<number | null>(null);
  const lastActivityTime = useRef<number>(Date.now());
  
  // Clear the inactivity timer safely
  const clearInactivityTimer = useCallback(() => {
    if (inactivityTimer.current) {
      window.clearTimeout(inactivityTimer.current);
      inactivityTimer.current = null;
    }
  }, []);
  
  // Handle visibility change
  useEffect(() => {
    const handleVisibilityChange = () => {
      const visible = !document.hidden;
      setIsVisible(visible);
      
      if (visible) {
        lastActivityTime.current = Date.now();
        
        // If user became active again
        if (!isUserActive) {
          setIsUserActive(true);
          onUserActive?.();
        }
        
        if (onBecomeVisible) {
          try {
            onBecomeVisible();
          } catch (error) {
            console.error('Error in onBecomeVisible callback:', error);
          }
        }
      } else {
        // When page becomes hidden, track it
        if (onBecomeHidden) {
          try {
            onBecomeHidden();
          } catch (error) {
            console.error('Error in onBecomeHidden callback:', error);
            
            // If callback fails and we have user email, use beacon API as fallback
            if (userEmail) {
              BeaconService.sendTrackingBeacon(userEmail, 'Tab Hidden (Fallback)');
            }
          }
        } else if (userEmail) {
          // If no callback provided but we have the email, send tracking directly
          BeaconService.sendTrackingBeacon(userEmail, 'Tab Hidden');
        }
      }
    };
    
    // Set initial state
    if (typeof document !== 'undefined') {
      setIsVisible(!document.hidden);
    }
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isUserActive, onBecomeHidden, onBecomeVisible, onUserActive, userEmail]);
  
  // Handle user activity
  useEffect(() => {
    const resetInactivityTimer = () => {
      // Update last activity time
      lastActivityTime.current = Date.now();
      
      // Clear any existing timer
      clearInactivityTimer();
      
      // If user was previously inactive, mark as active
      if (!isUserActive) {
        setIsUserActive(true);
        if (onUserActive) {
          try {
            onUserActive();
          } catch (error) {
            console.error('Error in onUserActive callback:', error);
          }
        }
      }
      
      // Set new inactivity timer
      inactivityTimer.current = window.setTimeout(() => {
        setIsUserActive(false);
        
        if (onUserInactive) {
          try {
            onUserInactive();
          } catch (error) {
            console.error('Error in onUserInactive callback:', error);
            
            // If callback fails and we have user email, use beacon API as fallback
            if (userEmail) {
              BeaconService.sendTrackingBeacon(userEmail, 'User Inactive (Fallback)');
            }
          }
        } else if (userEmail) {
          // If no callback provided but we have the email, send tracking directly
          BeaconService.sendTrackingBeacon(userEmail, 'User Inactive');
        }
      }, inactivityTimeout);
    };
    
    // User interactions that reset the inactivity timer
    const events = [
      'mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart',
      'click', 'keydown', 'wheel'
    ];
    
    // Initialize the timer
    resetInactivityTimer();
    
    // Add event listeners
    events.forEach(event => {
      document.addEventListener(event, resetInactivityTimer, { passive: true });
    });
    
    return () => {
      // Clean up event listeners
      events.forEach(event => {
        document.removeEventListener(event, resetInactivityTimer);
      });
      
      // Clear the timer
      clearInactivityTimer();
    };
  }, [inactivityTimeout, isUserActive, onUserActive, onUserInactive, clearInactivityTimer, userEmail]);
  
  // NEW: Enhanced beforeunload handling for better tracking on tab/browser close
  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (userEmail) {
        console.log('beforeunload event triggered, sending tracking data');
        
        // When tab/browser is closed, use Beacon API directly (most reliable for page close)
        const beaconSent = BeaconService.sendTrackingWithFallback(
          userEmail, 
          'Page Close (beforeunload)'
        );
        
        console.log(`Tracking beacon for tab close sent: ${beaconSent ? 'successfully' : 'failed'}`);
        
        // Standard approach to show confirmation dialog if needed
        // Note: Most modern browsers ignore custom messages
        event.preventDefault();
        event.returnValue = '';
      }
    };
    
    // Add the event listener for beforeunload
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [userEmail]); // Only re-attach when userEmail changes
  
  // Calculate inactivity duration in seconds
  const getInactivityDuration = useCallback(() => {
    return Math.floor((Date.now() - lastActivityTime.current) / 1000);
  }, []);
  
  return { 
    isVisible, 
    isUserActive,
    getInactivityDuration,
    lastActivityTime: lastActivityTime.current
  };
};