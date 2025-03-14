import React from 'react';
import { Mail, RefreshCw, AlertCircle, Calendar, CalendarDays } from 'lucide-react';
import { Email } from '../types';
import EmailItem from './EmailItem';
import { FilterOption } from './EmailFilter';

interface EmailListProps {
  emails: Email[];
  onRefresh: () => void;
  isLoading: boolean;
  onMarkAsRead: (emailId: string) => Promise<void>;
  onDeleteEmail: (emailId: string) => Promise<void>;
  activeFilter?: FilterOption;
}

const EmailList: React.FC<EmailListProps> = ({ 
  emails, 
  onRefresh, 
  isLoading, 
  onMarkAsRead, 
  onDeleteEmail, 
  activeFilter = 'all' 
}) => {
  // Helper function to get the appropriate icon and title based on filter
  const getFilterInfo = () => {
    switch (activeFilter) {
      case 'unread':
        return { 
          icon: <AlertCircle className="mr-2 dark:text-gray-200" size={20} />, 
          title: 'Unread Emails' 
        };
      case 'today':
        return { 
          icon: <Calendar className="mr-2 dark:text-gray-200" size={20} />, 
          title: 'Emails from Today' 
        };
      case 'week':
        return { 
          icon: <CalendarDays className="mr-2 dark:text-gray-200" size={20} />, 
          title: 'Emails from This Week' 
        };
      default:
        return { 
          icon: <Mail className="mr-2 dark:text-gray-200" size={20} />, 
          title: 'Recent Emails' 
        };
    }
  };

  const { icon, title } = getFilterInfo();

  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold flex items-center text-gray-900 dark:text-white">
          {icon}
          {title}
          {emails.length > 0 && (
            <span className="ml-2 text-sm bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-2 py-0.5 rounded-full">
              {emails.length}
            </span>
          )}
        </h2>
        <button 
          onClick={onRefresh}
          disabled={isLoading}
          className="flex items-center px-3 py-1 bg-blue-500 dark:bg-blue-600 text-white rounded hover:bg-blue-600 dark:hover:bg-blue-700 disabled:bg-blue-300 dark:disabled:bg-blue-800 transition-colors"
        >
          <RefreshCw className={`mr-1 ${isLoading ? 'animate-spin' : ''}`} size={16} />
          Refresh
        </button>
      </div>
      
      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-pulse flex flex-col items-center">
            <RefreshCw className="animate-spin mb-2 text-gray-600 dark:text-gray-300" size={24} />
            <p className="text-gray-600 dark:text-gray-300">Loading emails...</p>
          </div>
        </div>
      ) : emails.length === 0 ? (
        <div className="text-center py-10 bg-gray-50 dark:bg-gray-800 rounded-lg transition-colors">
          <Mail className="mx-auto mb-2 text-gray-400 dark:text-gray-500" size={32} />
          <p className="text-gray-500 dark:text-gray-400">No emails found</p>
        </div>
      ) : (
        <div className="space-y-4">
          {emails.map((email) => (
            <EmailItem 
              key={email.id} 
              email={email} 
              onMarkAsRead={onMarkAsRead}
              onDeleteEmail={onDeleteEmail}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default EmailList;