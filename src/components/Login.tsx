import React, { useState } from 'react';
import { useGoogleLogin } from '@react-oauth/google';
import { Mail } from 'lucide-react';

interface LoginProps {
  onLogin: (accessToken: string) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const login = useGoogleLogin({
    onSuccess: (response) => {
      setIsLoading(false);
      onLogin(response.access_token);
    },
    onError: (errorResponse) => {
      setIsLoading(false);
      console.error('Login Failed', errorResponse);
      setError('Failed to log in with Google. Please try again.');
    },
    scope: 'https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email',
  });

  const handleLogin = () => {
    setIsLoading(true);
    setError(null);
    login();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full p-8 bg-white rounded-lg shadow-lg text-center">
        <div className="flex justify-center mb-6">
          <div className="bg-blue-500 p-3 rounded-full">
            <Mail className="text-white" size={32} />
          </div>
        </div>
        <h1 className="text-2xl font-bold mb-2">Email Summarizer</h1>
        <p className="text-gray-600 mb-8">
          Connect your Gmail account to get AI-powered summaries of your emails
        </p>
        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-md text-sm">
            {error}
          </div>
        )}
        <button
          onClick={handleLogin}
          disabled={isLoading}
          className="w-full bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-4 rounded-md transition-colors flex items-center justify-center disabled:opacity-70"
        >
          {isLoading ? (
            <>
              <span className="animate-spin mr-2">⟳</span>
              Signing in...
            </>
          ) : (
            <>
              <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M12.545,10.239v3.821h5.445c-0.712,2.315-2.647,3.972-5.445,3.972c-3.332,0-6.033-2.701-6.033-6.032s2.701-6.032,6.033-6.032c1.498,0,2.866,0.549,3.921,1.453l2.814-2.814C17.503,2.988,15.139,2,12.545,2C7.021,2,2.543,6.477,2.543,12s4.478,10,10.002,10c8.396,0,10.249-7.85,9.426-11.748L12.545,10.239z"
                />
              </svg>
              Sign in with Google
            </>
          )}
        </button>
        <p className="mt-4 text-xs text-gray-500">
          We'll only access your emails to provide summaries. Your data is never stored.
        </p>
      </div>
    </div>
  );
};

export default Login;