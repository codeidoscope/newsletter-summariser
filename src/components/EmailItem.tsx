import React, { useState, useRef } from 'react';
import { ChevronDown, ChevronUp, RefreshCw } from 'lucide-react';
import { Email } from '../types';

interface EmailItemProps {
  email: Email;
}

const EmailItem: React.FC<EmailItemProps> = ({ email }) => {
  const [expanded, setExpanded] = useState(false);
  const emailRef = useRef<HTMLDivElement>(null);

  const toggleExpanded = (newState: boolean) => {
    // If we're collapsing the email
    if (expanded && !newState) {
      // Scroll to the email container with smooth animation
      emailRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
    }
    setExpanded(newState);
  };

  return (
    <div
      ref={emailRef}
      className="border rounded-lg overflow-hidden bg-white shadow-sm hover:shadow-md transition-shadow"
    >
      <div 
        className="p-4 cursor-pointer flex justify-between items-start"
        onClick={() => toggleExpanded(!expanded)}
      >
        <div className="flex-1">
          <div className="flex justify-between">
            <h3 className="font-medium text-lg">{email.subject}</h3>
            <span className="text-sm text-gray-500">{email.date}</span>
          </div>
          <p className="text-sm text-gray-600 mt-1">
            {email.from}
            {email.unsubscribeLink && (
              <span className="ml-2">
                <a 
                  href={email.unsubscribeLink} 
                  className="text-blue-500 hover:underline"
                  onClick={(e) => e.stopPropagation()} // Prevent expanding when clicking the link
                  target="_blank" 
                  rel="noopener noreferrer"
                >
                  Unsubscribe
                </a>
              </span>
            )}
          </p>
          {!expanded && (
            <div className="mt-3">
              <h4 className="font-medium text-sm text-gray-700 mb-1">Summary:</h4>
              {email.isLoading ? (
                <div className="flex items-center text-sm text-gray-500 bg-gray-50 p-3 rounded">
                  <RefreshCw className="animate-spin mr-2" size={16} />
                  Generating summary...
                </div>
              ) : email.summary ? (
                <div>
                  <p className="text-sm bg-blue-50 p-3 rounded">{email.summary}</p>
                  {email.newsletterType && (
                    <p className="text-sm bg-green-50 p-2 rounded mt-2">
                      <span className="font-medium">Newsletter Type:</span> {email.newsletterType}
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-gray-500 bg-gray-50 p-3 rounded">No summary available</p>
              )}
            </div>
          )}
        </div>
        <div className="ml-4">
          {expanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
        </div>
      </div>
      
      {expanded && (
        <div className="px-4 pb-4 border-t border-gray-100">
          <div className="mt-3">
            <h4 className="font-medium text-sm text-gray-700 mb-1">Summary:</h4>
            {email.isLoading ? (
              <div className="flex items-center text-sm text-gray-500 bg-gray-50 p-3 rounded">
                <RefreshCw className="animate-spin mr-2" size={16} />
                Generating summary...
              </div>
            ) : email.summary ? (
              <div>
                <p className="text-sm bg-blue-50 p-3 rounded">{email.summary}</p>
                {email.newsletterType && (
                  <p className="text-sm bg-green-50 p-2 rounded mt-2">
                    <span className="font-medium">Newsletter Type:</span> {email.newsletterType}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-gray-500 bg-gray-50 p-3 rounded">No summary available</p>
            )}
          </div>
          
          <div className="mt-4">
            <h4 className="font-medium text-sm text-gray-700 mb-1">Original Email:</h4>
            <p className="text-sm whitespace-pre-line bg-gray-50 p-3 rounded">{email.body || email.snippet}</p>
            <div
              className="mt-3 p-2 cursor-pointer flex items-center justify-center text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded"
              onClick={() => toggleExpanded(false)}
            >
              <ChevronUp size={20} className="mr-2" /> Close original email
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmailItem;