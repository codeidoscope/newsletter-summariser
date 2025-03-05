import { useState, useEffect } from 'react';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { fetchEmails, fetchUserProfile } from './services/googleApi';
import { summarizeEmail } from './services/openaiApi';
import { trackLogin } from './services/trackingService';
import { Email, UserProfile } from './types';
import Login from './components/Login';
import Header from './components/Header';
import EmailList from './components/EmailList';

function App() {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [emails, setEmails] = useState<Email[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Check if we have an OpenAI API key
  const hasOpenAIKey = Boolean(import.meta.env.VITE_OPENAI_API_KEY);

  useEffect(() => {
    // If we have an access token, fetch user profile and emails
    if (accessToken) {
      const loadUserData = async () => {
        try {
          const userProfile = await fetchUserProfile(accessToken);
          setUser(userProfile);
          
          // Track user login
          await trackLogin(userProfile);
          
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
        const summary = await summarizeEmail(email);
        
        // Update the email with its summary
        setEmails(prevEmails => 
          prevEmails.map(prevEmail => 
            prevEmail.id === email.id 
              ? { ...prevEmail, summary, isLoading: false } 
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

  const handleLogout = () => {
    setAccessToken(null);
    setUser(null);
    setEmails([]);
  };

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