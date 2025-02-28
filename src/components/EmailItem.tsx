import React, { useState } from 'react';
import { ChevronDown, ChevronUp, RefreshCw } from 'lucide-react';
import { Email } from '../types';

interface EmailItemProps {
  email: Email;
}

const EmailItem: React.FC<EmailItemProps> = ({ email }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border rounded-lg overflow-hidden bg-white shadow-sm hover:shadow-md transition-shadow">
      <div 
        className="p-4 cursor-pointer flex justify-between items-start"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex-1">
          <div className="flex justify-between">
            <h3 className="font-medium text-lg">{email.subject}</h3>
            <span className="text-sm text-gray-500">{email.date}</span>
          </div>
          <p className="text-sm text-gray-600 mt-1">{email.from}</p>
          {!expanded && (
            <p className="text-sm mt-2 text-gray-700 line-clamp-2">{email.snippet}</p>
          )}
        </div>
        <div className="ml-4">
          {expanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
        </div>
      </div>
      
      {expanded && (
        <div className="px-4 pb-4 border-t border-gray-100">
          <div className="mt-3">
            <h4 className="font-medium text-sm text-gray-700 mb-1">Original Email:</h4>
            <p className="text-sm whitespace-pre-line bg-gray-50 p-3 rounded">{email.body || email.snippet}</p>
          </div>
          
          <div className="mt-4">
            <h4 className="font-medium text-sm text-gray-700 mb-1">Summary:</h4>
            {email.isLoading ? (
              <div className="flex items-center text-sm text-gray-500 bg-gray-50 p-3 rounded">
                <RefreshCw className="animate-spin mr-2" size={16} />
                Generating summary...
              </div>
            ) : email.summary ? (
              <p className="text-sm bg-blue-50 p-3 rounded">{email.summary}</p>
            ) : (
              <p className="text-sm text-gray-500 bg-gray-50 p-3 rounded">No summary available</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default EmailItem;