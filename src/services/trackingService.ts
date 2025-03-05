import axios from 'axios';
import { UserProfile } from '../types';

// Base URL for the tracking API
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5175/api';

/**
 * Generic function to track user events
 * @param eventType The type of event to track
 * @param user The user profile information
 * @param details Optional additional event details
 */
const trackEvent = async (
  eventType: string, 
  user: UserProfile | null, 
  details?: Record<string, any>
): Promise<void> => {
  if (!user) return;
  
  try {
    await axios.post(`${API_BASE_URL}/track/${eventType}`, {
      email: user.email,
      name: user.name,
      timestamp: new Date().toISOString(),
      details
    });
    
    // Only log in development, not in production
    if (import.meta.env.DEV) {
      console.log(`${eventType} event tracked successfully`);
    }
  } catch (error) {
    // Don't throw the error, just log it
    // We don't want tracking failures to affect the user experience
    console.error(`Error tracking ${eventType} event:`, error);
  }
};

/**
 * Tracks a user login event
 * @param user The user profile information
 */
export const trackLogin = async (user: UserProfile): Promise<void> => {
  await trackEvent('login', user);
};

/**
 * Tracks a user logout event
 * @param user The user profile information
 */
export const trackLogout = async (user: UserProfile): Promise<void> => {
  await trackEvent('logout', user);
};

/**
 * Tracks when a tab becomes hidden
 * @param user The user profile information
 */
export const trackTabHidden = async (user: UserProfile): Promise<void> => {
  await trackEvent('tab_hidden', user, {
    url: window.location.href,
    time: new Date().toISOString()
  });
};

/**
 * Tracks when a tab becomes visible
 * @param user The user profile information
 */
export const trackTabVisible = async (user: UserProfile): Promise<void> => {
  await trackEvent('tab_visible', user, {
    url: window.location.href,
    time: new Date().toISOString()
  });
};

/**
 * Initializes visibility tracking for the current user
 * @param user The user profile information
 */
export const initVisibilityTracking = (user: UserProfile): void => {
  if (!user) return;

  // Track visibility changes using the Page Visibility API
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      trackTabHidden(user);
    } else if (document.visibilityState === 'visible') {
      trackTabVisible(user);
    }
  });

  // Track when the user is about to leave the page
  window.addEventListener('beforeunload', () => {
    trackEvent('page_close', user, {
      url: window.location.href,
      time: new Date().toISOString()
    });
  });
};