import axios from 'axios';
import { Email, UserProfile } from '../types';
import { removeToken } from './authService';

// Create an axios instance for Google API calls
const googleApiClient = axios.create();

// Add response interceptor to handle auth errors
googleApiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    // If the error is due to an invalid token
    if (error.response && (error.response.status === 401 || error.response.status === 403)) {
      console.error('Authentication error with Google API, clearing token');
      // Clear the token
      removeToken();
      // Optionally, you could force a page reload here to restart the auth flow
      // window.location.reload();
    }
    return Promise.reject(error);
  }
);

// Function to fetch user profile information
export const fetchUserProfile = async (accessToken: string): Promise<UserProfile> => {
  try {
    const response = await googleApiClient.get('https://www.googleapis.com/oauth2/v1/userinfo', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    
    return {
      email: response.data.email,
      name: response.data.name,
      picture: response.data.picture,
    };
  } catch (error) {
    console.error('Error fetching user profile:', error);
    throw error;
  }
};

/**
 * Properly decodes a base64 string to UTF-8 text
 */
const decodeBase64 = (base64: string): string => {
  // Replace URL-safe Base64 characters
  const sanitizedBase64 = base64.replace(/-/g, '+').replace(/_/g, '/');

  try {
    // Decode the Base64 to a binary string
    const binaryString = atob(sanitizedBase64);

    // Convert to Uint8Array
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // Use TextDecoder to convert to UTF-8
    return new TextDecoder('utf-8').decode(bytes);
  } catch (error) {
    console.error('Error decoding base64:', error);
    // Fallback to basic atob if the above fails
    return atob(sanitizedBase64);
  }
};

// Function to fetch emails from Gmail
export const fetchEmails = async (accessToken: string, maxResults = 10): Promise<Email[]> => {
  try {
    // First, get the list of messages
    const messagesResponse = await googleApiClient.get(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        params: {
          maxResults,
        },
      }
    );

    // For each message ID, get the full message details
    const emails: Email[] = await Promise.all(
      messagesResponse.data.messages.map(async (message: { id: string; threadId: string }) => {
        const messageResponse = await googleApiClient.get(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${message.id}`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
            params: {
              format: 'full',
            },
          }
        );

        const { payload, snippet, internalDate, labelIds } = messageResponse.data;
        
        // Extract headers
        const headers = payload.headers;
        const subject = headers.find((header: { name: string }) => header.name === 'Subject')?.value || 'No Subject';
        const from = headers.find((header: { name: string }) => header.name === 'From')?.value || 'Unknown Sender';
        
        // Extract body with proper UTF-8 decoding
        let body = '';
        if (payload.parts && payload.parts.length > 0) {
          // Find the text/plain part
          const textPart = payload.parts.find((part: any) => part.mimeType === 'text/plain');
          if (textPart && textPart.body && textPart.body.data) {
            body = decodeBase64(textPart.body.data);
          }
        } else if (payload.body && payload.body.data) {
          body = decodeBase64(payload.body.data);
        }

        // Format date without seconds
        const date = new Date(parseInt(internalDate)).toLocaleString(undefined, {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          // seconds are intentionally omitted
        });

        // Check if the email is unread
        const isUnread = labelIds && labelIds.includes('UNREAD');

        return {
          id: message.id,
          threadId: message.threadId,
          subject,
          snippet,
          from,
          date,
          body,
          isUnread,
        };
      })
    );

    return emails;
  } catch (error) {
    console.error('Error fetching emails:', error);
    throw error;
  }
};

/**
 * Marks an email as read by removing the UNREAD label
 */
export const markEmailAsRead = async (accessToken: string, messageId: string): Promise<boolean> => {
  try {
    await googleApiClient.post(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/modify`,
      {
        removeLabelIds: ['UNREAD']
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );
    return true;
  } catch (error) {
    console.error('Error marking email as read:', error);
    throw error;
  }
};

/**
 * Deletes an email by moving it to trash
 */
export const deleteEmail = async (accessToken: string, messageId: string): Promise<boolean> => {
  try {
    await googleApiClient.post(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/trash`,
      {},
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );
    return true;
  } catch (error) {
    console.error('Error deleting email:', error);
    throw error;
  }
};