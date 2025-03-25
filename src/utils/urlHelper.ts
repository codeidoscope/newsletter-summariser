/**
 * Helper utility for constructing API URLs consistently
 * Prevents duplicate "/api" segments in URLs
 */

/**
 * Constructs a proper API URL by ensuring there are no duplicate "/api" segments
 * 
 * @param {string} endpoint - The API endpoint
 * @param {string} [basePath] - Optional custom base API URL (defaults to environment variable)
 * @returns {string} The properly constructed URL
 */
export const buildApiUrl = (endpoint: string, basePath?: string): string => {
  // Use provided basePath or default from environment variable
  const basePathToUse = basePath || import.meta.env.VITE_API_BASE_URL || 'http://localhost:5175';
  
  // Remove any trailing slashes from the base path
  const normalizedBase = basePathToUse.endsWith('/') 
    ? basePathToUse.slice(0, -1) 
    : basePathToUse;
  
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