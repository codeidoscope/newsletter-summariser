/**
 * Helper utility for constructing API URLs consistently
 * Prevents duplicate "/api" segments in URLs
 */

/**
 * Constructs a proper API URL by ensuring there are no duplicate "/api" segments
 * 
 * @param {string} basePath - The base API URL (usually from environment variable)
 * @param {string} endpoint - The endpoint to append to the base URL
 * @returns {string} The properly constructed URL
 */
export const buildApiUrl = (basePath: string, endpoint: string): string => {
    // Remove any trailing slashes from the base path
    const normalizedBase = basePath.endsWith('/') 
      ? basePath.slice(0, -1) 
      : basePath;
    
    // Remove any leading slashes from the endpoint
    const normalizedEndpoint = endpoint.startsWith('/') 
      ? endpoint.slice(1) 
      : endpoint;
    
    // Check if the base path already includes "/api"
    if (normalizedBase.endsWith('/api')) {
      return `${normalizedBase}/${normalizedEndpoint}`;
    } else {
      // If the endpoint starts with "api/", just use it directly
      if (normalizedEndpoint.startsWith('api/')) {
        return `${normalizedBase}/${normalizedEndpoint}`;
      }
      // Otherwise, add the api/ prefix
      return `${normalizedBase}/api/${normalizedEndpoint}`;
    }
  };