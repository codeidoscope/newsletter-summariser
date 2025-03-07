// Key used for storing the auth token in localStorage
const AUTH_TOKEN_KEY = 'gmail_summarizer_auth_token';

/**
 * Saves the authentication token to localStorage
 */
export const saveToken = (token: string): void => {
  localStorage.setItem(AUTH_TOKEN_KEY, token);
};

/**
 * Retrieves the authentication token from localStorage
 */
export const getToken = (): string | null => {
  return localStorage.getItem(AUTH_TOKEN_KEY);
};

/**
 * Removes the authentication token from localStorage
 */
export const removeToken = (): void => {
  localStorage.removeItem(AUTH_TOKEN_KEY);
};

/**
 * Checks if a token exists in localStorage
 */
export const hasToken = (): boolean => {
  return !!getToken();
};

/**
 * Validates the token by making a test request to the Google API
 * Returns true if the token is valid, false otherwise
 */
export const validateToken = async (token: string): Promise<boolean> => {
  try {
    // Make a lightweight request to Google API to validate the token
    const response = await fetch('https://www.googleapis.com/oauth2/v1/tokeninfo', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `access_token=${token}`,
    });
    
    // If we get a 200 response, the token is valid
    return response.status === 200;
  } catch (error) {
    console.error('Error validating token:', error);
    return false;
  }
};