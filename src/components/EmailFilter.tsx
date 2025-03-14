import React from 'react';
import { Mail, AlertCircle, Calendar, CalendarDays } from 'lucide-react';

export type FilterOption = 'all' | 'unread' | 'today' | 'week';

interface EmailFilterProps {
  activeFilter: FilterOption;
  onFilterChange: (filter: FilterOption) => void;
}

const EmailFilter: React.FC<EmailFilterProps> = ({ activeFilter, onFilterChange }) => {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-3 mb-4 shadow-sm">
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => onFilterChange('all')}
          className={`flex items-center px-3 py-1.5 rounded-md text-sm transition-colors ${
            activeFilter === 'all'
              ? 'bg-blue-500 text-white'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
          }`}
          aria-current={activeFilter === 'all' ? 'page' : undefined}
        >
          <Mail size={16} className="mr-1.5" />
          All Emails
        </button>
        
        <button
          onClick={() => onFilterChange('unread')}
          className={`flex items-center px-3 py-1.5 rounded-md text-sm transition-colors ${
            activeFilter === 'unread'
              ? 'bg-blue-500 text-white'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
          }`}
          aria-current={activeFilter === 'unread' ? 'page' : undefined}
        >
          <AlertCircle size={16} className="mr-1.5" />
          Unread Only
        </button>
        
        <button
          onClick={() => onFilterChange('today')}
          className={`flex items-center px-3 py-1.5 rounded-md text-sm transition-colors ${
            activeFilter === 'today'
              ? 'bg-blue-500 text-white'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
          }`}
          aria-current={activeFilter === 'today' ? 'page' : undefined}
        >
          <Calendar size={16} className="mr-1.5" />
          Today Only
        </button>
        
        <button
          onClick={() => onFilterChange('week')}
          className={`flex items-center px-3 py-1.5 rounded-md text-sm transition-colors ${
            activeFilter === 'week'
              ? 'bg-blue-500 text-white'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
          }`}
          aria-current={activeFilter === 'week' ? 'page' : undefined}
        >
          <CalendarDays size={16} className="mr-1.5" />
          This Week
        </button>
      </div>
    </div>
  );
};

export default EmailFilter;