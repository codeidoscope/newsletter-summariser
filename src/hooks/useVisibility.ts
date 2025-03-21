import { useState, useEffect, useRef } from 'react';

interface VisibilityOptions {
  inactivityTimeout?: number; // Timeout in ms before considering user inactive
  onBecomeHidden?: () => void; // Callback when page becomes hidden
  onBecomeVisible?: () => void; // Callback when page becomes visible
  onUserInactive?: () => void;  // Callback when user is inactive
  onUserActive?: () => void;    // Callback when user becomes active again
}

export const useVisibility = ({
  inactivityTimeout = 5 * 60 * 1000, // Default 5 minutes
  onBecomeHidden,
  onBecomeVisible,
  onUserInactive,
  onUserActive
}: VisibilityOptions) => {
  const [isVisible, setIsVisible] = useState(true);
  const [isUserActive, setIsUserActive] = useState(true);
  const inactivityTimer = useRef<number | null>(null);
  
  // Handle visibility change
  useEffect(() => {
    const handleVisibilityChange = () => {
      const visible = !document.hidden;
      setIsVisible(visible);
      
      if (visible) {
        onBecomeVisible?.();
        // Reset user activity when tab becomes visible
        setIsUserActive(true);
        onUserActive?.();
      } else {
        onBecomeHidden?.();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [onBecomeHidden, onBecomeVisible, onUserActive]);
  
  // Handle user activity
  useEffect(() => {
    const resetInactivityTimer = () => {
      if (inactivityTimer.current) {
        window.clearTimeout(inactivityTimer.current);
        inactivityTimer.current = null;
      }
      
      if (!isUserActive) {
        setIsUserActive(true);
        onUserActive?.();
      }
      
      inactivityTimer.current = window.setTimeout(() => {
        setIsUserActive(false);
        onUserInactive?.();
      }, inactivityTimeout);
    };
    
    // User interactions that reset the inactivity timer
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    
    // Initialize the timer
    resetInactivityTimer();
    
    // Add event listeners
    events.forEach(event => {
      document.addEventListener(event, resetInactivityTimer);
    });
    
    return () => {
      // Clean up event listeners
      events.forEach(event => {
        document.removeEventListener(event, resetInactivityTimer);
      });
      
      // Clear the timer
      if (inactivityTimer.current) {
        window.clearTimeout(inactivityTimer.current);
      }
    };
  }, [inactivityTimeout, isUserActive, onUserActive, onUserInactive]);
  
  return { isVisible, isUserActive };
};