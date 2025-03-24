import { useState, useEffect, useMemo } from 'react';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { fetchEmails, fetchUserProfile, markEmailAsRead, deleteEmail } from './services/googleApi';
import { summarizeEmail } from './services/openaiApi';
import { trackLogin, initTracking, sendTrackingDataAndClear } from './services/trackingService';
import { BeaconService } from './services/beaconService';
import { saveToken, getToken, removeToken, validateToken } from './services/authService';
import { Email, UserProfile } from './types';
import { ThemeProvider } from './context/ThemeContext';
import { parseEmailDate, isToday, isThisWeek } from './utils/dateUtils';
import { useVisibility } from './hooks/useVisibility.ts';
import Login from './components/Login';
import Header from './components/Header';
import EmailList from './components/EmailList';
import EmailFilter, { FilterOption } from './components/EmailFilter';
import { buildApiUrl } from './utils/urlHelper';

const RECIPIENT_FILTER = import.meta.env.VITE_RECIPIENT_FILTER || null;

function App() {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [emails, setEmails] = useState<Email[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(true);
  const [activeFilter, setActiveFilter] = useState<FilterOption>('all');

  const hasOpenAIKey = Boolean(import.meta.env.VITE_OPENAI_API_KEY);

  const {} = useVisibility({
    inactivityTimeout: 15 * 60 * 1000, // 15 minutes of inactivity
    onBecomeHidden: async () => {
      if (user) {
        try {
          console.log('Tab hidden, sending tracking data');
          await sendTrackingDataAndClear(user.email, 'Tab Hidden');
        } catch (error) {
          console.error('Error sending tracking data on tab hidden:', error);

          BeaconService.sendTrackingEmailBeacon(user.email, 'Tab Hidden (Fallback)');
        }
      }
    },
    onUserInactive: async () => {
      if (user) {
        try {
          console.log('User inactive, sending tracking data');
          await sendTrackingDataAndClear(user.email, 'User Inactive');
        } catch (error) {
          console.error('Error sending tracking data on user inactive:', error);
          BeaconService.sendTrackingEmailBeacon(user.email, 'User Inactive (Fallback)');
        }
      }
    }
  });
  
  useEffect(() => {
    initTracking();
    
    const initAuth = async () => {
      setIsAuthLoading(true);
      const savedToken = getToken();

      if (savedToken) {
        try {
          const isValid = await validateToken(savedToken);
          
          if (isValid) {
            setAccessToken(savedToken);
          } else {
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

  // Enhanced useEffect to handle browser close/refresh using Beacon API
  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (user) {
        console.log('beforeunload event triggered, sending tracking data');
        
        // Use Beacon API directly for all tracking - most reliable for page close
        const beaconSent = BeaconService.sendTrackingEmailBeacon(user.email, 'Page Close');
        console.log(`Email beacon sent: ${beaconSent ? 'successfully queued' : 'failed to queue'}`);
        
        // Send a regular tracking beacon as well
        BeaconService.sendTrackingBeacon(user.email, 'Page Close');
        
        // For confirmation dialog (optional)
        event.preventDefault();
        return 'Are you sure you want to leave? Your tracking data will be sent.';
      }
    };
    
    // Use both beforeunload and unload for maximum reliability
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('unload', () => {
      if (user) {
        // Last ditch effort on unload - use only beacon here
        BeaconService.sendTrackingEmailBeacon(user.email, 'Page Unload');
      }
    });
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('unload', () => {});
    };
  }, [user]);

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (user) {
        // Use Beacon API directly for all tracking - most reliable for page close
        const beaconSent = BeaconService.sendTrackingEmailBeacon(user.email, 'Page Close');
        console.log(`Email beacon sent: ${beaconSent ? 'successfully queued' : 'failed to queue'}`);
        
        // Send a regular tracking beacon as well
        BeaconService.sendTrackingBeacon(user.email, 'Page Close');
        
        event.preventDefault();
        return 'Are you sure you want to leave? Your tracking data will be sent.';
      }
    };
    
    // Use both beforeunload and unload for maximum reliability
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('unload', () => {
      if (user) {
        BeaconService.sendTrackingEmailBeacon(user.email, 'Page Unload');
      }
    });
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('unload', () => {});
    };
  }, [user]);

  useEffect(() => {
    if (accessToken) {
      const loadUserData = async () => {
        try {
          const userProfile = await fetchUserProfile(accessToken);
          setUser(userProfile);
          
          saveToken(accessToken);

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
      const maxResults = 20;
      const fetchedEmails = await fetchEmails(accessToken, maxResults, RECIPIENT_FILTER);
      setEmails(fetchedEmails);
      
      if (hasOpenAIKey) {
        processEmailsForSummaries(fetchedEmails);
      }
    } catch (error) {
      console.error('Error loading emails:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFilterChange = (filter: FilterOption) => {
    setActiveFilter(filter);

    if (filter !== 'all') {
      loadEmails();
    }
  };

const processEmailsForSummaries = async (emailsToProcess: Email[]) => {
  const emailsWithLoadingState = emailsToProcess.map(email => ({
    ...email,
    isLoading: true
  }));
  setEmails(emailsWithLoadingState);

  for (const email of emailsWithLoadingState) {
    try {
      const { summary, newsletterType, unsubscribeLink } = await summarizeEmail(email);
      
      setEmails(prevEmails => 
        prevEmails.map(prevEmail => 
          prevEmail.id === email.id 
            ? { 
                ...prevEmail, 
                summary, 
                newsletterType: newsletterType || undefined,
                unsubscribeLink: unsubscribeLink || undefined,
                isLoading: false 
              } 
            : prevEmail
        )
      );
    } catch (error) {
      console.error(`Error summarizing email ${email.id}:`, error);
      
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
    if (user) {
      try {
        console.log('Sending tracking data before logout');
        
        const url = buildApiUrl(import.meta.env.VITE_API_BASE_URL || 'http://localhost:5175', 'send-tracking-data');
        
        // Use fetch with keepalive for more reliable delivery during page transitions
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userEmail: user.email,
            reason: 'User Logout - Sync Request',
            timestamp: new Date().toISOString()
          }),
          keepalive: true
        });
        
        if (response.ok) {
          console.log('Tracking data sent successfully');
        } else {
          console.error('Failed to send tracking data:', await response.text());
        }
        
        // Add a short delay to give request time to complete
        await new Promise(resolve => setTimeout(resolve, 300));
        
      } catch (error) {
        console.error('Error sending tracking data on logout:', error);
        BeaconService.sendTrackingEmailBeacon(user.email, 'User Logout (Fallback)');
      }
    }
    
    removeToken();
    setAccessToken(null);
    setUser(null);
    setEmails([]);
  }
  
  const handleMarkAsRead = async (emailId: string) => {
    if (!accessToken) return;
    
    setEmails(prevEmails => 
      prevEmails.map(email => 
        email.id === emailId 
          ? { ...email, actionLoading: 'mark-read' } 
          : email
      )
    );
    
    try {
      await markEmailAsRead(accessToken, emailId);
      
      setEmails(prevEmails => 
        prevEmails.map(email => 
          email.id === emailId 
            ? { ...email, isUnread: false, actionLoading: null } 
            : email
        )
      );
    } catch (error) {
      console.error('Error marking email as read:', error);
      
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
    
    setEmails(prevEmails => 
      prevEmails.map(email => 
        email.id === emailId 
          ? { ...email, actionLoading: 'delete' } 
          : email
      )
    );
    
    try {
      await deleteEmail(accessToken, emailId);
      
      setEmails(prevEmails => prevEmails.filter(email => email.id !== emailId));
    } catch (error) {
      console.error('Error deleting email:', error);
      
      setEmails(prevEmails => 
        prevEmails.map(email => 
          email.id === emailId 
            ? { ...email, actionLoading: null } 
            : email
        )
      );
    }
  };

  const filteredEmails = useMemo(() => {
    if (activeFilter === 'all') {
      return emails;
    }

    return emails.filter(email => {
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
                  <div className="bg-white dark:bg-gray-800 rounded-lg p-3 mb-4 shadow-sm">
                    <EmailFilter
                      activeFilter={activeFilter}
                      onFilterChange={handleFilterChange}
                    />
                  </div>

                  <EmailList
                    emails={filteredEmails}
                    onRefresh={loadEmails}
                    isLoading={isLoading}
                    onMarkAsRead={handleMarkAsRead}
                    onDeleteEmail={handleDeleteEmail}
                    activeFilter={activeFilter}
                    selectedRecipient={RECIPIENT_FILTER}
                  />

                  {filteredEmails.length === 0 && !isLoading && (
                    <div className="text-center py-10 bg-gray-50 dark:bg-gray-800 rounded-lg">
                      <p className="text-gray-500 dark:text-gray-400">
                        No emails match the current filter. Try another filter or refresh.
                      </p>
                    </div>
                  )}

                  {RECIPIENT_FILTER && (
                    <div className="max-w-4xl mx-auto mt-6 mb-6 bg-blue-25 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900 p-4 rounded-md">
                      <p className="text-blue-500 text-xs dark:text-blue-300">
                        <strong>Showing emails sent to:</strong> <code className="bg-blue-50 dark:bg-blue-900/30 px-1 rounded">{RECIPIENT_FILTER}</code>
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