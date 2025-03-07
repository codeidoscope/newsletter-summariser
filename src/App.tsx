import { useState, useEffect } from 'react';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { fetchEmails, fetchUserProfile } from './services/googleApi';
import { summarizeEmail } from './services/openaiApi';
import { trackLogin, trackLogout, initTracking } from './services/trackingService';
import { saveToken, getToken, removeToken, validateToken } from './services/authService';
import { Email, UserProfile } from './types';
import Login from './components/Login';
import Header from './components/Header';
import EmailList from './components/EmailList';

function App() {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [emails, setEmails] = useState<Email[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(true);

  // Check if we have an OpenAI API key
  const hasOpenAIKey = Boolean(import.meta.env.VITE_OPENAI_API_KEY);

  useEffect(() => {
    // Initialize tracking when app loads
    initTracking();
    
    // Check for existing token in localStorage on app init
    const initAuth = async () => {
      setIsAuthLoading(true);
      const savedToken = getToken();

      if (savedToken) {
        try {
          // Validate the token first
          const isValid = await validateToken(savedToken);
          
          if (isValid) {
            setAccessToken(savedToken);
          } else {
            // Token is invalid, remove it
            removeToken();
          }
        } catch (error) {
          console.error('Error validating saved token:', error);
          removeToken();
        }
      }

      setIsAuthLoading(false);
    };

    initAuth();
  }, []);

  useEffect(() => {
    // If we have an access token, fetch user profile and emails
    if (accessToken) {
      const loadUserData = async () => {
        try {
          const userProfile = await fetchUserProfile(accessToken);
          setUser(userProfile);
          
          // Save token to localStorage for persistence
          saveToken(accessToken);

          // Track user login
          await trackLogin();
          
          await loadEmails();
        } catch (error) {
          console.error('Error loading user data:', error);
          handleLogout();
        }
      };
      
      loadUserData();
    }
  }, [accessToken]);

  const loadEmails = async () => {
    if (!accessToken) return;
    
    setIsLoading(true);
    try {
      const fetchedEmails = await fetchEmails(accessToken);
      setEmails(fetchedEmails);
      
      // Process emails for summaries if we have an OpenAI API key
      if (hasOpenAIKey) {
        processEmailsForSummaries(fetchedEmails);
      }
    } catch (error) {
      console.error('Error loading emails:', error);
    } finally {
      setIsLoading(false);
    }
  };

const processEmailsForSummaries = async (emailsToProcess: Email[]) => {
  // Create a copy of emails with isLoading flag for summaries
  const emailsWithLoadingState = emailsToProcess.map(email => ({
    ...email,
    isLoading: true
  }));
  setEmails(emailsWithLoadingState);

  // Process each email for summary
  for (const email of emailsWithLoadingState) {
    try {
      const { summary, newsletterType, unsubscribeLink } = await summarizeEmail(email);
      
      // Update the email with its summary, newsletter type, and unsubscribe link
      setEmails(prevEmails => 
        prevEmails.map(prevEmail => 
          prevEmail.id === email.id 
            ? { 
                ...prevEmail, 
                summary, 
                newsletterType, 
                unsubscribeLink,
                isLoading: false 
              } 
            : prevEmail
        )
      );
    } catch (error) {
      console.error(`Error summarizing email ${email.id}:`, error);
      
      // Mark as not loading even if there was an error
      setEmails(prevEmails => 
        prevEmails.map(prevEmail => 
          prevEmail.id === email.id 
            ? { ...prevEmail, isLoading: false } 
            : prevEmail
        )
      );
    }
  }
};

  const handleLogin = (token: string) => {
    setAccessToken(token);
  };

  const handleLogout = async () => {
    // Track logout event before clearing user data
    await trackLogout();
    
    // Clear token from localStorage
    removeToken();
    
    setAccessToken(null);
    setUser(null);
    setEmails([]);
  };

  if (isAuthLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID || ''}>
      <div className="min-h-screen bg-gray-50">
        {!accessToken ? (
          <Login onLogin={handleLogin} />
        ) : (
          <>
            {user && <Header user={user} onLogout={handleLogout} />}
            <main className="py-8 px-4 sm:px-6 lg:px-8">
              {!hasOpenAIKey && (
                <div className="max-w-4xl mx-auto mb-6 bg-yellow-50 border border-yellow-200 p-4 rounded-md">
                  <p className="text-yellow-700">
                    <strong>Note:</strong> OpenAI API key is not configured. Email summaries will not be generated.
                    Please add your OpenAI API key as <code>VITE_OPENAI_API_KEY</code> in the environment variables.
                  </p>
                </div>
              )}
              <EmailList 
                emails={emails} 
                onRefresh={loadEmails} 
                isLoading={isLoading} 
              />
            </main>
          </>
        )}
      </div>
    </GoogleOAuthProvider>
  );
}

export default App;