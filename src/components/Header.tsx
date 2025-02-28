import React from 'react';
import { LogOut, Mail } from 'lucide-react';
import { UserProfile } from '../types';

interface HeaderProps {
  user: UserProfile;
  onLogout: () => void;
}

const Header: React.FC<HeaderProps> = ({ user, onLogout }) => {
  return (
    <header className="bg-white shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          <div className="flex items-center">
            <Mail className="h-8 w-8 text-blue-500" />
            <span className="ml-2 text-xl font-bold text-gray-900">Email Summarizer</span>
          </div>
          
          <div className="flex items-center">
            <div className="flex items-center">
              <img
                className="h-8 w-8 rounded-full"
                src={user.picture}
                alt={user.name}
              />
              <span className="ml-2 text-sm font-medium text-gray-700">{user.name}</span>
            </div>
            
            <button
              onClick={onLogout}
              className="ml-4 flex items-center text-sm text-gray-500 hover:text-gray-700"
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