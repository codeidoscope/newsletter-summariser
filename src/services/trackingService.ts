import axios from 'axios';
import { throttle, debounce } from 'lodash';

// Base URL for the tracking API
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5175/api';

// Scroll tracking state
const scrollState = {
  lastPosition: 0,
  initialPosition: 0,
  direction: 'down',
  startTime: 0,
  milestones: {
    '25%': false,
    '50%': false,
    '75%': false,
    '100%': false
  },
  // Track time spent at different scroll depths (in ms)
  timeAtDepth: {
    'top': 0,
    'quarter': 0,
    'half': 0,
    'threequarters': 0,
    'bottom': 0
  },
  // Last time we updated the current depth timing
  lastDepthUpdate: 0,
  // Current depth section
  currentDepth: 'top',
  // Elements that have been seen
  visibleElements: new Set<string>(),
  // Rapid scroll detection
  scrollEvents: 0,
  lastScrollIncrement: Date.now()
};

/**
 * Generic function to track events with simplified data structure
 */
const trackEvent = async (eventType: string, data: any = {}): Promise<void> => {
  try {
    const url = `${API_BASE_URL}/track/${eventType}`;
    
    // Make sure data is serializable
    const cleanData = JSON.parse(JSON.stringify(data));
    
    await axios.post(url, {
      data: cleanData
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
 */
export const trackLogin = async (): Promise<void> => {
  await trackEvent('login');
};

/**
 * Tracks a user logout event
 */
export const trackLogout = async (): Promise<void> => {
  await trackEvent('logout');
};

/**
 * Tracks when a tab becomes hidden
 */
export const trackTabHidden = async (): Promise<void> => {
  await trackEvent('tab_hidden', {
    url: window.location.pathname
  });
};

/**
 * Tracks when a tab becomes visible
 */
export const trackTabVisible = async (): Promise<void> => {
  await trackEvent('tab_visible', {
    url: window.location.pathname
  });
};

/**
 * Tracks mouse clicks for heatmap
 */
const trackClick = async (e: MouseEvent): Promise<void> => {
  const { clientX, clientY } = e;
  const targetElement = e.target as HTMLElement;
  const elementType = targetElement.tagName.toLowerCase();
  
  await trackEvent('click', {
    x: clientX,
    y: clientY,
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
    path: window.location.pathname,
    elementType,
    elementClasses: targetElement.className || ''
  });
};

/**
 * Tracks mouse movement (throttled)
 */
const trackMouseMove = throttle(async (e: MouseEvent): Promise<void> => {
  const { clientX, clientY } = e;
  
  await trackEvent('mouse_move', {
    x: clientX,
    y: clientY,
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
    path: window.location.pathname
  });
}, 1000); // Only track once per second to avoid too much data

/**
 * Tracks element focus
 */
const trackFocus = async (e: FocusEvent): Promise<void> => {
  const targetElement = e.target as HTMLElement;
  
  await trackEvent('focus', {
    elementType: targetElement.tagName.toLowerCase(),
    elementClasses: targetElement.className || '',
    path: window.location.pathname
  });
};

/**
 * Tracks copy events
 */
const trackCopy = async (): Promise<void> => {
  await trackEvent('copy', {
    path: window.location.pathname
  });
};

/**
 * Tracks paste events
 */
const trackPaste = async (): Promise<void> => {
  await trackEvent('paste', {
    path: window.location.pathname
  });
};

/**
 * Updates the time spent at the current scroll depth
 */
const updateScrollDepthTiming = (): void => {
  const now = Date.now();
  const timeDiff = now - scrollState.lastDepthUpdate;
  
  if (scrollState.lastDepthUpdate > 0 && scrollState.currentDepth) {
    scrollState.timeAtDepth[scrollState.currentDepth] += timeDiff;
  }
  
  scrollState.lastDepthUpdate = now;
};

/**
 * Determines which section of the page the user is currently viewing
 */
const updateCurrentDepth = (scrollPercent: number): void => {
  const oldDepth = scrollState.currentDepth;
  
  let newDepth = 'top';
  if (scrollPercent >= 87.5) {
    newDepth = 'bottom';
  } else if (scrollPercent >= 62.5) {
    newDepth = 'threequarters';
  } else if (scrollPercent >= 37.5) {
    newDepth = 'half';
  } else if (scrollPercent >= 12.5) {
    newDepth = 'quarter';
  }
  
  if (newDepth !== oldDepth) {
    updateScrollDepthTiming();
    scrollState.currentDepth = newDepth;
  }
};

/**
 * Identifies important elements that are currently visible in the viewport
 */
const checkVisibleElements = (): void => {
  // Find elements with ID or data-section attribute
  const trackableElements = document.querySelectorAll('[id], [data-section]');
  
  trackableElements.forEach(element => {
    const rect = element.getBoundingClientRect();
    const isVisible = (
      rect.top < window.innerHeight &&
      rect.bottom > 0
    );
    
    if (isVisible) {
      const id = element.id || (element as HTMLElement).dataset.section;
      if (id && !scrollState.visibleElements.has(id)) {
        scrollState.visibleElements.add(id);
      }
    }
  });
};

/**
 * Calculate reading speed based on scroll patterns
 */
const getReadingPattern = (): string => {
  // Reset scroll events counter after 2 seconds of inactivity
  const now = Date.now();
  if (now - scrollState.lastScrollIncrement > 2000) {
    scrollState.scrollEvents = 0;
  }
  
  scrollState.scrollEvents++;
  scrollState.lastScrollIncrement = now;
  
  // Determine reading pattern
  if (scrollState.scrollEvents > 5) {
    return 'skimming'; // Fast scrolling
  } else if (scrollState.scrollEvents > 2) {
    return 'scanning'; // Moderate scrolling
  } else {
    return 'reading'; // Slow, deliberate scrolling
  }
};

/**
 * Tracks scroll actions with rich metadata
 */
const trackScroll = throttle((): void => {
  // Get current scroll position and calculate percentage
  const scrollPosition = window.scrollY;
  const documentHeight = document.documentElement.scrollHeight;
  const viewportHeight = window.innerHeight;
  const scrollableDistance = documentHeight - viewportHeight;
  const scrollPercentage = scrollableDistance > 0 
    ? (scrollPosition / scrollableDistance) * 100 
    : 0;
  
  // Determine scroll direction
  const direction = scrollPosition > scrollState.lastPosition ? 'down' : 'up';
  const directionChanged = direction !== scrollState.direction;
  scrollState.direction = direction;
  
  // Check scroll milestones
  const milestones = scrollState.milestones;
  if (scrollPercentage >= 25 && !milestones['25%']) {
    milestones['25%'] = true;
    trackEvent('scroll_milestone', { milestone: '25%', timeToReach: Date.now() - scrollState.startTime });
  }
  if (scrollPercentage >= 50 && !milestones['50%']) {
    milestones['50%'] = true;
    trackEvent('scroll_milestone', { milestone: '50%', timeToReach: Date.now() - scrollState.startTime });
  }
  if (scrollPercentage >= 75 && !milestones['75%']) {
    milestones['75%'] = true;
    trackEvent('scroll_milestone', { milestone: '75%', timeToReach: Date.now() - scrollState.startTime });
  }
  if (scrollPercentage >= 99 && !milestones['100%']) {
    milestones['100%'] = true;
    trackEvent('scroll_milestone', { milestone: '100%', timeToReach: Date.now() - scrollState.startTime });
  }
  
  // Update current depth section
  updateCurrentDepth(scrollPercentage);
  
  // Check for visible elements
  checkVisibleElements();
  
  // Get reading pattern
  const readingPattern = getReadingPattern();
  
  // Only send detailed scroll data periodically or on direction change
  if (directionChanged) {
    // Convert Set to Array for serialization
    const visibleSections = Array.from(scrollState.visibleElements);
    
    trackEvent('scroll_direction_change', {
      from: scrollState.lastPosition,
      to: scrollPosition,
      oldDirection: scrollState.direction === 'down' ? 'up' : 'down',
      newDirection: scrollState.direction,
      percentage: Math.round(scrollPercentage),
      visibleSections,
      pattern: readingPattern
    });
  }
  
  // Update the last position
  scrollState.lastPosition = scrollPosition;
}, 500); // Throttle to twice per second

/**
 * Tracks when scrolling stops and creates a scroll session summary
 */
const trackScrollEnd = debounce((): void => {
  // Update timing for the current depth before sending
  updateScrollDepthTiming();
  
  // Convert Set to Array for serialization
  const viewedSections = Array.from(scrollState.visibleElements);
  
  trackEvent('scroll_session', {
    totalScrollDistance: Math.abs(window.scrollY - scrollState.initialPosition),
    reachedBottom: scrollState.milestones['100%'],
    timeSpent: {
      top: Math.round(scrollState.timeAtDepth.top / 1000),
      quarter: Math.round(scrollState.timeAtDepth.quarter / 1000),
      half: Math.round(scrollState.timeAtDepth.half / 1000),
      threeQuarters: Math.round(scrollState.timeAtDepth.threequarters / 1000),
      bottom: Math.round(scrollState.timeAtDepth.bottom / 1000)
    },
    viewedSections
  });
}, 1000); // Wait 1 second after scrolling stops

/**
 * Initializes all tracking for the current session
 */
export const initTracking = (): void => {
  // Track visibility changes
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      trackTabHidden();
    } else if (document.visibilityState === 'visible') {
      trackTabVisible();
    }
  });

  // Track when the user is about to leave the page
  window.addEventListener('beforeunload', () => {
    // Final scroll session tracking before page unload
    trackScrollEnd.flush();
    
    trackEvent('page_close', {
      path: window.location.pathname
    });
  });
  
  // Track clicks for heatmap
  document.addEventListener('click', trackClick);
  
  // Track mouse movement
  document.addEventListener('mousemove', trackMouseMove);
  
  // Track focus events
  document.addEventListener('focus', trackFocus, true);
  
  // Track copy/paste events
  document.addEventListener('copy', trackCopy);
  document.addEventListener('paste', trackPaste);
  
  // Initialize scroll tracking
  scrollState.startTime = Date.now();
  scrollState.lastDepthUpdate = Date.now();
  scrollState.initialPosition = window.scrollY;
  document.addEventListener('scroll', () => {
    trackScroll();
    trackScrollEnd();
  });
  
  // Track when the page loads
  trackEvent('page_load', {
    path: window.location.pathname,
    referrer: document.referrer || '',
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight
  });
};