import { useState, useEffect, useMemo } from 'react';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { fetchEmails, fetchUserProfile, markEmailAsRead, deleteEmail } from './services/googleApi';
import { summarizeEmail } from './services/openaiApi';
import { trackLogin, trackLogout, initTracking } from './services/trackingService';
import { saveToken, getToken, removeToken, validateToken } from './services/authService';
import { Email, UserProfile } from './types';
import { ThemeProvider } from './context/ThemeContext';
import { parseEmailDate, isToday, isThisWeek } from './utils/dateUtils';
import Login from './components/Login';
import Header from './components/Header';
import EmailList from './components/EmailList';
import EmailFilter, { FilterOption } from './components/EmailFilter';

function App() {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [emails, setEmails] = useState<Email[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(true);
  const [activeFilter, setActiveFilter] = useState<FilterOption>('all');

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
      const maxResults = 20
      const fetchedEmails = await fetchEmails(accessToken, maxResults);
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

  // Handle filter changes
  const handleFilterChange = (filter: FilterOption) => {
    setActiveFilter(filter);

    // Reload emails when changing filters to ensure we have enough after filtering
    if (filter !== 'all') {
      loadEmails();
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
                newsletterType: newsletterType || undefined, // Convert null to undefined
                unsubscribeLink: unsubscribeLink || undefined, // Convert null to undefined
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
  
  const handleMarkAsRead = async (emailId: string) => {
    if (!accessToken) return;
    
    // Set the loading state for this specific email action
    setEmails(prevEmails => 
      prevEmails.map(email => 
        email.id === emailId 
          ? { ...email, actionLoading: 'mark-read' } 
          : email
      )
    );
    
    try {
      await markEmailAsRead(accessToken, emailId);
      
      // Update the email status in our local state
      setEmails(prevEmails => 
        prevEmails.map(email => 
          email.id === emailId 
            ? { ...email, isUnread: false, actionLoading: null } 
            : email
        )
      );
    } catch (error) {
      console.error('Error marking email as read:', error);
      
      // Clear loading state on error
      setEmails(prevEmails => 
        prevEmails.map(email => 
          email.id === emailId 
            ? { ...email, actionLoading: null } 
            : email
        )
      );
    }
  };
  
  const handleDeleteEmail = async (emailId: string) => {
    if (!accessToken) return;
    
    // Set the loading state for this specific email action
    setEmails(prevEmails => 
      prevEmails.map(email => 
        email.id === emailId 
          ? { ...email, actionLoading: 'delete' } 
          : email
      )
    );
    
    try {
      await deleteEmail(accessToken, emailId);
      
      // Remove the email from our local state
      setEmails(prevEmails => prevEmails.filter(email => email.id !== emailId));
    } catch (error) {
      console.error('Error deleting email:', error);
      
      // Clear loading state on error
      setEmails(prevEmails => 
        prevEmails.map(email => 
          email.id === emailId 
            ? { ...email, actionLoading: null } 
            : email
        )
      );
    }
  };

  // Apply filters to emails
  const filteredEmails = useMemo(() => {
    if (activeFilter === 'all') {
      return emails;
    }

    return emails.filter(email => {
      // Parse the email date
      const emailDate = parseEmailDate(email.date);

      switch (activeFilter) {
        case 'unread':
          return email.isUnread;
        case 'today':
          return isToday(emailDate);
        case 'week':
          return isThisWeek(emailDate);
        default:
          return true;
      }
    });
  }, [emails, activeFilter]);

  if (isAuthLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-300">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID || ''}>
      <ThemeProvider>
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
          {!accessToken ? (
            <Login onLogin={handleLogin} />
          ) : (
            <>
              {user && <Header user={user} onLogout={handleLogout} />}
              <main className="py-8 px-4 sm:px-6 lg:px-8">
                {!hasOpenAIKey && (
                  <div className="max-w-4xl mx-auto mb-6 bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-700 p-4 rounded-md">
                    <p className="text-yellow-700 dark:text-yellow-400">
                      <strong>Note:</strong> OpenAI API key is not configured. Email summaries will not be generated.
                      Please add your OpenAI API key as <code className="bg-yellow-100 dark:bg-yellow-900 px-1 rounded">VITE_OPENAI_API_KEY</code> in the environment variables.
                    </p>
                  </div>
                )}
                <div className="max-w-4xl mx-auto">
                  <EmailFilter
                    activeFilter={activeFilter}
                    onFilterChange={handleFilterChange}
                  />

                  <EmailList
                    emails={filteredEmails}
                    onRefresh={loadEmails}
                    isLoading={isLoading}
                    onMarkAsRead={handleMarkAsRead}
                    onDeleteEmail={handleDeleteEmail}
                    activeFilter={activeFilter}
                  />

                  {filteredEmails.length === 0 && !isLoading && (
                    <div className="text-center py-10 bg-gray-50 dark:bg-gray-800 rounded-lg">
                      <p className="text-gray-500 dark:text-gray-400">
                        No emails match the current filter. Try another filter or refresh.
                      </p>
                    </div>
                  )}
                </div>
              </main>
            </>
          )}
        </div>
      </ThemeProvider>
    </GoogleOAuthProvider>
  );
}

export default App;