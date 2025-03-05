import axios from 'axios';
import { UserProfile } from '../types';

// Base URL for the tracking API
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5175/api';

/**
 * Tracks a user login event
 * @param user The user profile information
 */
export const trackLogin = async (user: UserProfile): Promise<void> => {
  try {
    await axios.post(`${API_BASE_URL}/track/login`, {
      email: user.email,
      name: user.name,
      timestamp: new Date().toISOString()
    });
    
    // Only log in development, not in production
    if (import.meta.env.DEV) {
      console.log('Login event tracked successfully');
    }
  } catch (error) {
    // Don't throw the error, just log it
    // We don't want tracking failures to affect the user experience
    console.error('Error tracking login event:', error);
  }
};