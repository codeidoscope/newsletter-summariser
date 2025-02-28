import React from 'react';
import { Mail, RefreshCw } from 'lucide-react';
import { Email } from '../types';
import EmailItem from './EmailItem';

interface EmailListProps {
  emails: Email[];
  onRefresh: () => void;
  isLoading: boolean;
}

const EmailList: React.FC<EmailListProps> = ({ emails, onRefresh, isLoading }) => {
  return (
    <div className="w-full max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold flex items-center">
          <Mail className="mr-2" size={20} />
          Recent Emails
        </h2>
        <button 
          onClick={onRefresh}
          disabled={isLoading}
          className="flex items-center px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-blue-300"
        >
          <RefreshCw className={`mr-1 ${isLoading ? 'animate-spin' : ''}`} size={16} />
          Refresh
        </button>
      </div>
      
      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-pulse flex flex-col items-center">
            <RefreshCw className="animate-spin mb-2" size={24} />
            <p>Loading emails...</p>
          </div>
        </div>
      ) : emails.length === 0 ? (
        <div className="text-center py-10 bg-gray-50 rounded-lg">
          <Mail className="mx-auto mb-2 text-gray-400" size={32} />
          <p className="text-gray-500">No emails found</p>
        </div>
      ) : (
        <div className="space-y-4">
          {emails.map((email) => (
            <EmailItem key={email.id} email={email} />
          ))}
        </div>
      )}
    </div>
  );
};

export default EmailList;