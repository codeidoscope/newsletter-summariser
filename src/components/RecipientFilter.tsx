import React, { useState, useEffect } from 'react';
import { AtSign } from 'lucide-react';

interface RecipientFilterProps {
  userEmail: string;
  selectedRecipient: string | null;
  onSelectRecipient: (recipient: string | null) => void;
}

const RecipientFilter: React.FC<RecipientFilterProps> = ({ 
  userEmail, 
  selectedRecipient, 
  onSelectRecipient 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [savedAddresses, setSavedAddresses] = useState<string[]>([]);
  const [newAddress, setNewAddress] = useState('');
  
  // Parse the base email (before the @ symbol)
  const parseBaseEmail = (email: string): { username: string, domain: string } => {
    const parts = email.split('@');
    return {
      username: parts[0],
      domain: parts[1]
    };
  };
  
  const { username, domain } = parseBaseEmail(userEmail);
  
  // Load saved addresses from localStorage on component mount
  useEffect(() => {
    const saved = localStorage.getItem('savedEmailAddresses');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setSavedAddresses(parsed);
        }
      } catch (e) {
        console.error('Error parsing saved email addresses', e);
      }
    }
  }, []);
  
  // Save addresses to localStorage when they change
  useEffect(() => {
    if (savedAddresses.length > 0) {
      localStorage.setItem('savedEmailAddresses', JSON.stringify(savedAddresses));
    }
  }, [savedAddresses]);
  
  const handleAddAddress = () => {
    // Validate that the input is not empty
    if (!newAddress.trim()) return;
    
    // Create the full email address with plus addressing
    const plusAddress = `${username}+${newAddress}@${domain}`;
    
    // Add to saved addresses if not already there
    if (!savedAddresses.includes(plusAddress)) {
      setSavedAddresses([...savedAddresses, plusAddress]);
    }
    
    // Clear the input
    setNewAddress('');
  };
  
  const handleRemoveAddress = (address: string) => {
    setSavedAddresses(savedAddresses.filter(a => a !== address));
    
    // If the removed address was selected, reset the selection
    if (selectedRecipient === address) {
      onSelectRecipient(null);
    }
  };
  
  const handleSelectRecipient = (address: string | null) => {
    onSelectRecipient(address);
    setIsOpen(false);
  };
  
  // Generate a display name for the recipient
  const getDisplayName = (email: string | null): string => {
    if (!email) return 'All Recipients';
    
    // For plus addresses, extract the segment after the plus
    if (email.includes('+')) {
      const match = email.match(new RegExp(`${username}\\+([^@]+)@`));
      if (match && match[1]) {
        return `+${match[1]}`;
      }
    }
    
    return email;
  };
  
  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center px-3 py-1.5 rounded-md text-sm transition-colors bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
        aria-haspopup="true"
        aria-expanded={isOpen}
      >
        <AtSign size={16} className="mr-1.5" />
        {getDisplayName(selectedRecipient)}
      </button>
      
      {isOpen && (
        <div className="absolute mt-1 w-64 bg-white dark:bg-gray-800 rounded-md shadow-lg z-10 border border-gray-200 dark:border-gray-700">
          <div className="p-2">
            <div className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
              Filter by recipient:
            </div>
            
            <div className="mb-2">
              <button
                onClick={() => handleSelectRecipient(null)}
                className={`w-full text-left px-3 py-2 rounded-md text-sm ${
                  selectedRecipient === null
                    ? 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200'
                    : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                All Recipients
              </button>
              
              <button
                onClick={() => handleSelectRecipient(userEmail)}
                className={`w-full text-left px-3 py-2 rounded-md text-sm ${
                  selectedRecipient === userEmail
                    ? 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200'
                    : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                {userEmail} (Main)
              </button>
            </div>
            
            {savedAddresses.length > 0 && (
              <div className="mb-2">
                <div className="mb-1 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  Saved Addresses
                </div>
                {savedAddresses.map(address => (
                  <div key={address} className="flex items-center">
                    <button
                      onClick={() => handleSelectRecipient(address)}
                      className={`flex-grow text-left px-3 py-2 rounded-md text-sm ${
                        selectedRecipient === address
                          ? 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200'
                          : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                      }`}
                    >
                      {getDisplayName(address)}
                    </button>
                    <button
                      onClick={() => handleRemoveAddress(address)}
                      className="text-red-500 hover:text-red-700 dark:text-red-400 p-1 rounded-full"
                      title="Remove address"
                    >
                      &times;
                    </button>
                  </div>
                ))}
              </div>
            )}
            
            <div className="border-t border-gray-200 dark:border-gray-700 pt-2 mt-2">
              <div className="mb-1 text-xs font-medium text-gray-500 dark:text-gray-400">
                Add New Plus Address
              </div>
              <div className="flex items-center">
                <div className="flex-shrink-0 text-gray-500 dark:text-gray-400">
                  {username}+
                </div>
                <input
                  type="text"
                  value={newAddress}
                  onChange={(e) => setNewAddress(e.target.value)}
                  placeholder="tag"
                  className="flex-grow ml-1 p-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
                <div className="flex-shrink-0 ml-1 text-gray-500 dark:text-gray-400">
                  @{domain}
                </div>
              </div>
              <button
                onClick={handleAddAddress}
                disabled={!newAddress.trim()}
                className="mt-2 w-full px-3 py-1 bg-blue-500 text-white rounded-md disabled:bg-blue-300 dark:disabled:bg-blue-700"
              >
                Add
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RecipientFilter;