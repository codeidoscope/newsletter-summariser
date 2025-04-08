import React, { useState } from 'react';
import { LogOut, Mail, Send, CheckCircle, User } from 'lucide-react';
import { UserProfile } from '../types';
import ThemeToggle from './ThemeToggle';
import { sendTrackingDataAndClear } from '../services/trackingService';

interface HeaderProps {
  user: UserProfile;
  onLogout: () => void;
}

const Header: React.FC<HeaderProps> = ({ user, onLogout }) => {
  const [isSending, setIsSending] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [imageError, setImageError] = useState(false);
  
  const handleSendTracking = async () => {
    setIsSending(true);
    try {
      await sendTrackingDataAndClear(user.email, 'Manual Send from Header Button');
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000); // Hide success message after 3 seconds
    } catch (error) {
      console.error('Error sending tracking data:', error);
    } finally {
      setIsSending(false);
    }
  };

  const handleImageError = () => {
    setImageError(true);
  };

  return (
    <header className="bg-white dark:bg-gray-800 shadow-sm transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          <div className="flex items-center">
            <Mail className="h-8 w-8 text-blue-500 dark:text-blue-400" />
            <span className="ml-2 text-xl font-bold text-gray-900 dark:text-white">Newsletter Summariser</span>
          </div>
          
          <div className="flex items-center">
            <button
              onClick={handleSendTracking}
              data-track-id="send-tracking-data-button"
              disabled={isSending}
              className="mr-4 flex items-center px-3 py-1.5 text-sm font-medium rounded-md text-white bg-green-500 hover:bg-green-600 disabled:bg-green-400 transition-colors"
            >
              {isSending ? (
                <span className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Sending...
                </span>
              ) : showSuccess ? (
                <span className="flex items-center">
                  <CheckCircle className="h-4 w-4 mr-1" />
                  Sent!
                </span>
              ) : (
                <span className="flex items-center">
                  <Send className="h-4 w-4 mr-1" />
                  Send Tracking Data
                </span>
              )}
            </button>
            
            <ThemeToggle className="mr-4" />
            
            <div className="flex items-center">
              {imageError ? (
                <div className="h-8 w-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-gray-500 dark:text-gray-400">
                  <User size={20} />
                </div>
              ) : (
                <img
                  className="h-8 w-8 rounded-full object-cover bg-gray-100 dark:bg-gray-700"
                  src={user.picture}
                  alt={user.name}
                  onError={handleImageError}
                  referrerPolicy="no-referrer" 
                />
              )}
              <span className="ml-2 text-sm font-medium text-gray-700 dark:text-gray-300">{user.name}</span>
            </div>
            
            <button
              onClick={onLogout}
              data-track-id="logout-button"
              className="ml-4 flex items-center text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              <LogOut className="h-4 w-4 mr-1" />
              Logout
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;