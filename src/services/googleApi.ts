import axios from 'axios';
import { Email, UserProfile } from '../types';

// Function to fetch user profile information
export const fetchUserProfile = async (accessToken: string): Promise<UserProfile> => {
  try {
    const response = await axios.get('https://www.googleapis.com/oauth2/v1/userinfo', {
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

// Function to fetch emails from Gmail
export const fetchEmails = async (accessToken: string, maxResults = 10): Promise<Email[]> => {
  try {
    // First, get the list of messages
    const messagesResponse = await axios.get(
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
        const messageResponse = await axios.get(
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

        const { payload, snippet, internalDate } = messageResponse.data;
        
        // Extract headers
        const headers = payload.headers;
        const subject = headers.find((header: { name: string }) => header.name === 'Subject')?.value || 'No Subject';
        const from = headers.find((header: { name: string }) => header.name === 'From')?.value || 'Unknown Sender';
        
        // Extract body
        let body = '';
        if (payload.parts && payload.parts.length > 0) {
          // Find the text/plain part
          const textPart = payload.parts.find((part: any) => part.mimeType === 'text/plain');
          if (textPart && textPart.body && textPart.body.data) {
            body = atob(textPart.body.data.replace(/-/g, '+').replace(/_/g, '/'));
          }
        } else if (payload.body && payload.body.data) {
          body = atob(payload.body.data.replace(/-/g, '+').replace(/_/g, '/'));
        }

        // Format date
        const date = new Date(parseInt(internalDate)).toLocaleString();

        return {
          id: message.id,
          threadId: message.threadId,
          subject,
          snippet,
          from,
          date,
          body,
        };
      })
    );

    return emails;
  } catch (error) {
    console.error('Error fetching emails:', error);
    throw error;
  }
};