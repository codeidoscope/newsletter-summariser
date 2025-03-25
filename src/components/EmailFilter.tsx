import React from 'react';
import { Mail, AlertCircle, Calendar, CalendarDays } from 'lucide-react';

export type FilterOption = 'all' | 'unread' | 'today' | 'week';

interface EmailFilterProps {
  activeFilter: FilterOption;
  onFilterChange: (filter: FilterOption) => void;
}

const EmailFilter: React.FC<EmailFilterProps> = ({ activeFilter, onFilterChange }) => {
  return (
    <div className="flex flex-wrap gap-2">
      <button
        onClick={() => onFilterChange('all')}
        data-track-id="all-emails-filter-button"
        className={`flex items-center px-3 py-1.5 rounded-md text-sm transition-colors ${
          activeFilter === 'all'
            ? 'bg-blue-500 text-white'
            : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
        }`}
        aria-current={activeFilter === 'all' ? 'page' : undefined}
      >
        <Mail size={16} className="mr-1.5" />
        All
      </button>
      
      <button
        onClick={() => onFilterChange('unread')}
        data-track-id="unread-emails-filter-button"
        className={`flex items-center px-3 py-1.5 rounded-md text-sm transition-colors ${
          activeFilter === 'unread'
            ? 'bg-blue-500 text-white'
            : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
        }`}
        aria-current={activeFilter === 'unread' ? 'page' : undefined}
      >
        <AlertCircle size={16} className="mr-1.5" />
        Unread
      </button>
      
      <button
        onClick={() => onFilterChange('today')}
        data-track-id="today-emails-filter-button"
        className={`flex items-center px-3 py-1.5 rounded-md text-sm transition-colors ${
          activeFilter === 'today'
            ? 'bg-blue-500 text-white'
            : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
        }`}
        aria-current={activeFilter === 'today' ? 'page' : undefined}
      >
        <Calendar size={16} className="mr-1.5" />
        Today
      </button>
      
      <button
        onClick={() => onFilterChange('week')}
        data-track-id="this-week-emails-filter-button"
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
  );
};

export default EmailFilter;