import axios from 'axios';
import { throttle, debounce } from 'lodash';
import { buildApiUrl } from '../utils/urlHelper';

// Define a type for scroll depth sections
type ScrollDepthSection = 'top' | 'quarter' | 'half' | 'threequarters' | 'bottom';

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
  lastDepthUpdate: 0,
  currentDepth: 'top' as ScrollDepthSection,
  visibleElements: new Set<string>(),
  // Rapid scroll detection
  scrollEvents: 0,
  lastScrollIncrement: Date.now()
};

export const trackEvent = async (eventType: string, data: any = {}): Promise<void> => {
  try {
    const url = buildApiUrl(`track/${eventType}`);
    
    const cleanData = JSON.parse(JSON.stringify(data));
    
    await axios.post(url, {
      data: cleanData
    });
    
    if (import.meta.env.DEV) {
      console.log(`${eventType} event tracked successfully`);
    }
  } catch (error) {
    console.error(`Error tracking ${eventType} event:`, error);
  }
};

export const trackLogin = async (): Promise<void> => {
  await trackEvent('login');
};

export const trackLogout = async (): Promise<void> => {
  await trackEvent('logout');
};

export const trackTabHidden = async (): Promise<void> => {
  await trackEvent('tab_hidden', {
    url: window.location.pathname
  });
};

export const trackTabVisible = async (): Promise<void> => {
  await trackEvent('tab_visible', {
    url: window.location.pathname
  });
};

export const sendTrackingDataEmail = async (userEmail: string, reason: string): Promise<void> => {
  try {
    const url = buildApiUrl('send-tracking-data');
    console.log("URL: ", url)
    
    await axios.post(url, {
      userEmail,
      reason
    });
    
    if (import.meta.env.DEV) {
      console.log('Tracking data sent via email');
    }
  } catch (error) {
    console.error('Error sending tracking data email:', error);
  }
};

export const clearTrackingData = async (): Promise<void> => {
  try {
    const url = buildApiUrl('clear-tracking-data');
    
    await axios.post(url, {});
    
    if (import.meta.env.DEV) {
      console.log('Tracking data cleared');
    }
  } catch (error) {
    console.error('Error clearing tracking data:', error);
  }
};

export const sendTrackingDataAndClear = async (userEmail: string, reason: string): Promise<void> => {
  await sendTrackingDataEmail(userEmail, reason);
  
  // Comment this out if you want to keep accumulating data
  // await clearTrackingData();
};

const hasClass = (element: HTMLElement, className: string): boolean => {
  if (typeof element.className === 'string') {
    return element.className.split(' ').includes(className);
  } else if (element.classList && element.classList.contains) {
    return element.classList.contains(className);
  } else {
    return false;
  }
};

const getElementDescription = (element: HTMLElement): string => {
  // Check for expandable email items (specific to this app)
  if (isEmailItem(element)) {
    const isExpanded = isElementExpanded(element);
    return isExpanded ? "collapse email item" : "expand email item";
  }
  
  // Try to get description from various attributes
  // 1. Check for button text
  if (element.tagName.toLowerCase() === 'button' && element.textContent?.trim()) {
    return `button: ${element.textContent.trim()}`;
  }
  
  // 2. Check for aria-label (accessibility description)
  if (element.getAttribute('aria-label')) {
    return element.getAttribute('aria-label') || '';
  }
  
  // 3. Check for title attribute
  if (element.getAttribute('title')) {
    return element.getAttribute('title') || '';
  }
  
  // 4. Check for name attribute (form elements)
  if (element.getAttribute('name')) {
    return `${element.tagName.toLowerCase()}: ${element.getAttribute('name')}`;
  }
  
  // 5. Check for placeholder (input fields)
  if (element.getAttribute('placeholder')) {
    return `input: ${element.getAttribute('placeholder')}`;
  }
  
  // 6. Check for id attribute if it's descriptive (not auto-generated)
  const id = element.getAttribute('id');
  if (id && !id.match(/^[a-z0-9]{8,}$/i)) { // Skip IDs that look like auto-generated
    return `element: ${id}`;
  }
  
  // 7. Check for text content for clickable elements
  if (isClickable(element) && element.textContent?.trim()) {
    const text = element.textContent.trim();
    return text.length > 30 ? text.substring(0, 30) + '...' : text;
  }
  
  // 8. Check for Lucide icons (used in the app)
  const iconElement = element.closest('[data-lucide]');
  if (iconElement) {
    const iconName = iconElement.getAttribute('data-lucide');
    if (iconName === 'chevron-down') return 'expand email icon';
    if (iconName === 'chevron-up') return 'collapse email icon';
    if (iconName === 'refresh-cw') return 'refresh emails icon';
    if (iconName === 'log-out') return 'logout icon';
    if (iconName === 'mail') return 'mail icon';
    return `icon: ${iconName}`;
  }
  
  // 9. Check for common UI patterns based on classes
  if (hasClass(element, 'refresh')) return 'refresh button';
  if (hasClass(element, 'logout')) return 'logout button';
  if (hasClass(element, 'login')) return 'login button';
  
  let className = '';
  if (typeof element.className === 'string') {
    className = element.className;
  } else if (element.classList && element.classList.value) {
    className = element.classList.value;
  }
  
  return `${element.tagName.toLowerCase()}${className ? ': ' + className : ''}`;
};

const isEmailItem = (element: HTMLElement): boolean => {
  const item = element.closest('.border.rounded-lg');
  if (!item) return false;
  
  return !!item.querySelector('.font-medium.text-lg') && 
         !!item.querySelector('.text-sm.text-gray-600');
};

const isElementExpanded = (element: HTMLElement): boolean => {
  const item = element.closest('.border.rounded-lg');
  if (!item) return false;
  
  return !!item.querySelector('.px-4.pb-4') || !!item.querySelector('[data-lucide="chevron-up"]');
};

const isClickable = (element: HTMLElement): boolean => {
  const clickableTags = ['a', 'button', 'input', 'select', 'textarea'];
  if (clickableTags.includes(element.tagName.toLowerCase())) return true;
  
  if (element.getAttribute('role') === 'button') return true;
  if (element.getAttribute('onclick')) return true;
  if (element.getAttribute('tabindex') === '0') return true;
  
  const style = window.getComputedStyle(element);
  if (style.cursor === 'pointer') return true;
  
  return false;
};

const trackClick = async (e: MouseEvent): Promise<void> => {
  const { clientX, clientY } = e;
  const targetElement = e.target as HTMLElement;
  
  const elementDescription = getElementDescription(targetElement);
  
  await trackEvent('click', {
    x: clientX,
    y: clientY,
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
    elementType: targetElement.tagName.toLowerCase(),
    elementClasses: typeof targetElement.className === 'string' ? 
      targetElement.className : 
      (targetElement.classList ? targetElement.classList.value : ''),
    description: elementDescription
  });
};

const trackMouseMove = throttle(async (e: MouseEvent): Promise<void> => {
  const { clientX, clientY } = e;
  
  await trackEvent('mouse_move', {
    x: clientX,
    y: clientY,
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
  });
}, 1000); // Only track once per second to avoid too much data

const trackFocus = async (e: FocusEvent): Promise<void> => {
  const targetElement = e.target as HTMLElement;
  
  await trackEvent('focus', {
    elementType: targetElement.tagName.toLowerCase(),
    elementClasses: typeof targetElement.className === 'string' ? 
      targetElement.className : 
      (targetElement.classList ? targetElement.classList.value : ''),
  });
};

const trackCopy = async (): Promise<void> => {
  await trackEvent('copy', {
    event: "copy text"
  });
};

const trackPaste = async (): Promise<void> => {
  await trackEvent('paste', {
    event: "paste text"
  });
};

const updateScrollDepthTiming = (): void => {
  const now = Date.now();
  const timeDiff = now - scrollState.lastDepthUpdate;
  
  if (scrollState.lastDepthUpdate > 0) {
    // Use the currentDepth as a key, which we now know is of type ScrollDepthSection
    const depth = scrollState.currentDepth;
    scrollState.timeAtDepth[depth] += timeDiff;
  }
  
  scrollState.lastDepthUpdate = now;
};

const updateCurrentDepth = (scrollPercent: number): void => {
  const oldDepth = scrollState.currentDepth;
  
  let newDepth: ScrollDepthSection = 'top';
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

const checkVisibleElements = (): void => {
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

const getReadingPattern = (): string => {
  // Reset scroll events counter after 2 seconds of inactivity
  const now = Date.now();
  if (now - scrollState.lastScrollIncrement > 2000) {
    scrollState.scrollEvents = 0;
  }
  
  scrollState.scrollEvents++;
  scrollState.lastScrollIncrement = now;

  if (scrollState.scrollEvents > 5) {
    return 'skimming';
  } else if (scrollState.scrollEvents > 2) {
    return 'scanning';
  } else {
    return 'reading';
  }
};

const trackScroll = throttle((): void => {
  const scrollPosition = window.scrollY;
  const documentHeight = document.documentElement.scrollHeight;
  const viewportHeight = window.innerHeight;
  const scrollableDistance = documentHeight - viewportHeight;
  const scrollPercentage = scrollableDistance > 0 
    ? (scrollPosition / scrollableDistance) * 100 
    : 0;
  
  const direction = scrollPosition > scrollState.lastPosition ? 'down' : 'up';
  const directionChanged = direction !== scrollState.direction;
  scrollState.direction = direction;
  
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
  
  updateCurrentDepth(scrollPercentage);
  
  checkVisibleElements();
    if (directionChanged) {
      const visibleSections = Array.from(scrollState.visibleElements);
      
      trackEvent('scroll_direction_change', {
        from: scrollState.lastPosition,
        to: scrollPosition,
        oldDirection: scrollState.direction === 'down' ? 'up' : 'down',
        newDirection: scrollState.direction,
        percentage: Math.round(scrollPercentage),
        visibleSections,
      });
    }
  
    scrollState.lastPosition = scrollPosition;
}, 500); // Throttle to twice per second

const trackScrollEnd = debounce((): void => {
  updateScrollDepthTiming();

  const viewedSections = Array.from(scrollState.visibleElements);

  const readingPattern = getReadingPattern();
  
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
    viewedSections,
    pattern: readingPattern,
  });
}, 3000); // Wait 3 seconds after scrolling stops

export const initTracking = (): void => {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      trackTabHidden();
    } else if (document.visibilityState === 'visible') {
      trackTabVisible();
    }
  });

  window.addEventListener('beforeunload', () => {
    trackScrollEnd.flush();
    
    trackEvent('page_close', {
      event: "close page"
    });
  });
  
  document.addEventListener('click', trackClick);
  document.addEventListener('mousemove', trackMouseMove);
  document.addEventListener('focus', trackFocus, true);
  document.addEventListener('copy', trackCopy);
  document.addEventListener('paste', trackPaste);
  
  scrollState.startTime = Date.now();
  scrollState.lastDepthUpdate = Date.now();
  scrollState.initialPosition = window.scrollY;
  document.addEventListener('scroll', () => {
    trackScroll();
    trackScrollEnd();
  });
  
  trackEvent('page_load', {
    referrer: document.referrer || '',
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight
  });
};