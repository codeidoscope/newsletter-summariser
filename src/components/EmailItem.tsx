import React, { useState, useRef } from 'react';
import { ChevronDown, ChevronUp, RefreshCw, Trash, CheckSquare, Loader } from 'lucide-react';
import { Email } from '../types';
import EmailRenderer from './EmailRenderer';

interface EmailItemProps {
  email: Email;
  onMarkAsRead: (emailId: string) => Promise<void>;
  onDeleteEmail: (emailId: string) => Promise<void>;
}

const EmailItem: React.FC<EmailItemProps> = ({ email, onMarkAsRead, onDeleteEmail }) => {
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
  
  const handleMarkAsRead = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent expanding/collapsing the email
    onMarkAsRead(email.id);
  };
  
  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent expanding/collapsing the email
    onDeleteEmail(email.id);
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
          
          {/* Changed from <p> to <div> to fix DOM nesting issue */}
          <div className="text-sm text-gray-600 mt-1 flex items-center">
            <span className="flex-1">
              {email.from}
              {email.isUnread && (
                <span className="ml-2 bg-blue-500 text-white text-xs px-2 py-0.5 rounded-full">
                  New
                </span>
              )}
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
            </span>
            <div className="flex space-x-2 ml-2">
            <a
                href={`https://mail.google.com/mail/u/0/#inbox/${email.id}`}
                className="text-green-600 hover:text-green-800 p-1 rounded hover:bg-green-50 flex items-center text-xs"
                onClick={(e) => e.stopPropagation()} // Prevent expanding when clicking the link
                target="_blank"
                rel="noopener noreferrer"
                title="View in Gmail"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  width="14"
                  height="14"
                  className="mr-1"
                  fill="currentColor"
                >
                  <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 14H4V8l8 5 8-5v10zm-8-7L4 6h16l-8 5z" />
                </svg>
                View in Gmail
              </a>
              {email.isUnread && (
                <button
                  className="text-blue-500 hover:text-blue-700 p-1 rounded hover:bg-blue-50 flex items-center text-xs"
                  onClick={handleMarkAsRead}
                  disabled={email.actionLoading === 'mark-read'}
                  title="Mark as read"
                >
                  {email.actionLoading === 'mark-read' ? (
                    <Loader size={14} className="animate-spin" />
                  ) : (
                    <>
                      <CheckSquare size={14} className="mr-1" /> Mark as read
                    </>
                  )}
                </button>
              )}
              <button
                className="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-50 flex items-center text-xs"
                onClick={handleDelete}
                disabled={email.actionLoading === 'delete'}
                title="Delete email"
              >
                {email.actionLoading === 'delete' ? (
                  <Loader size={14} className="animate-spin" />
                ) : (
                  <>
                    <Trash size={14} className="mr-1" /> Delete email
                  </>
                )}
              </button>
            </div>
          </div>
          
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

            <div className="bg-gray-50 p-3 rounded text-sm max-h-[500px] overflow-y-auto">
              <EmailRenderer
                htmlContent={email.htmlBody}
                textContent={email.textBody || email.snippet}
                className="email-content"
              />
            </div>
            
            <div className="flex mt-3">
              <div className="flex space-x-2 mr-auto">
                {email.isUnread && (
                  <button
                    className="text-blue-500 hover:text-blue-700 p-1 rounded hover:bg-blue-50 flex items-center text-sm"
                    onClick={handleMarkAsRead}
                    disabled={email.actionLoading === 'mark-read'}
                  >
                    {email.actionLoading === 'mark-read' ? (
                      <Loader size={16} className="animate-spin mr-1" />
                    ) : (
                      <CheckSquare size={16} className="mr-1" />
                    )}
                    Mark as read
                  </button>
                )}
                <a
                  href={`https://mail.google.com/mail/u/0/#inbox/${email.id}`}
                  className="text-green-600 hover:text-green-800 p-1 rounded hover:bg-green-50 flex items-center text-sm"
                  onClick={(e) => e.stopPropagation()} // Prevent expanding when clicking the link
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    width="16"
                    height="16"
                    className="mr-1"
                    fill="currentColor"
                  >
                    <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 14H4V8l8 5 8-5v10zm-8-7L4 6h16l-8 5z" />
                  </svg>
                  View in Gmail
                </a>
                <button
                  className="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-50 flex items-center text-sm"
                  onClick={handleDelete}
                  disabled={email.actionLoading === 'delete'}
                >
                  {email.actionLoading === 'delete' ? (
                    <Loader size={16} className="animate-spin mr-1" />
                  ) : (
                    <Trash size={16} className="mr-1" />
                  )}
                  Delete
                </button>
              </div>
              
              <div
                className="p-2 cursor-pointer flex items-center justify-center text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded"
                onClick={() => toggleExpanded(false)}
              >
                <ChevronUp size={20} className="mr-2" /> Close original email
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmailItem;