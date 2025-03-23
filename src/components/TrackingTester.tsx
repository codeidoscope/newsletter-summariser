import React, { useState } from 'react';
import { BeaconService } from '../services/beaconService';
import { sendTrackingDataAndClear, trackEvent } from '../services/trackingService';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5175'

// Helper function to build correct API URL
const buildApiUrl = (endpoint: string): string => {
  // Get base URL from environment variable or use default
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5175';
  
  // Remove trailing slash from base URL if present
  const baseUrl = API_BASE_URL.endsWith('/') 
    ? API_BASE_URL.slice(0, -1) 
    : API_BASE_URL;
  
  // Check if baseUrl already ends with /api
  if (baseUrl.endsWith('/api')) {
    return `${baseUrl}/${endpoint}`;
  } else {
    return `${baseUrl}/api/${endpoint}`;
  }
};

interface TrackingTesterProps {
  userEmail: string;
  className?: string;
}

const TrackingTester: React.FC<TrackingTesterProps> = ({ userEmail, className = '' }) => {
  const [lastResult, setLastResult] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [testType, setTestType] = useState<string>('xhr');
  
  const runTest = async (method: string) => {
    setIsLoading(true);
    setLastResult('');
    
    try {
      let result = false;
      
      if (method === 'xhr') {
        await sendTrackingDataAndClear(userEmail, 'Manual Test from UI');
        result = true;
      } else if (method === 'beacon') {
        result = BeaconService.sendTrackingEmailBeacon(userEmail, 'Manual Beacon Test from UI');
      } else if (method === 'fetch-keepalive') {
        // Test fetch with keepalive using correct URL construction
        const url = buildApiUrl('send-tracking-data');
        
        const fetchPromise = fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userEmail, 
            reason: 'Manual Fetch Keepalive Test',
            timestamp: new Date().toISOString()
          }),
          keepalive: true
        });
        
        // Don't await to simulate page close
        fetchPromise.then(() => console.log('Fetch completed successfully'))
          .catch(e => console.error('Fetch error:', e));
        
        result = true;
      } else if (method === 'event') {
        await trackEvent('test_event', { userEmail, timestamp: new Date().toISOString() });
        result = true;
      }
      
      setLastResult(`Test ${result ? 'succeeded' : 'failed'}`);
    } catch (error) {
      console.error('Test error:', error);
      setLastResult(`Test failed with error: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsLoading(false);
    }
  };
  
  const apiBaseUrl = API_BASE_URL.endsWith('/api') 
  ? API_BASE_URL 
  : `${API_BASE_URL}/api`;
  
  return (
    <div className={`p-4 bg-gray-100 dark:bg-gray-800 rounded-lg ${className}`}>
      <h3 className="text-lg font-medium mb-2 text-gray-800 dark:text-white">Tracking Test Panel</h3>
      
      <div className="mb-4">
        <div className="flex gap-2 mb-2">
          <button
            className={`px-3 py-1 rounded-md text-sm ${testType === 'xhr' ? 'bg-blue-500 text-white' : 'bg-gray-200 dark:bg-gray-700'}`}
            onClick={() => setTestType('xhr')}
          >
            XHR
          </button>
          <button
            className={`px-3 py-1 rounded-md text-sm ${testType === 'beacon' ? 'bg-blue-500 text-white' : 'bg-gray-200 dark:bg-gray-700'}`}
            onClick={() => setTestType('beacon')}
          >
            Beacon
          </button>
          <button
            className={`px-3 py-1 rounded-md text-sm ${testType === 'fetch-keepalive' ? 'bg-blue-500 text-white' : 'bg-gray-200 dark:bg-gray-700'}`}
            onClick={() => setTestType('fetch-keepalive')}
          >
            Fetch+Keepalive
          </button>
          <button
            className={`px-3 py-1 rounded-md text-sm ${testType === 'event' ? 'bg-blue-500 text-white' : 'bg-gray-200 dark:bg-gray-700'}`}
            onClick={() => setTestType('event')}
          >
            Event
          </button>
        </div>
        
        <button
          className="w-full bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-4 rounded-md transition-colors flex items-center justify-center"
          onClick={() => runTest(testType)}
          disabled={isLoading}
        >
          {isLoading ? (
            <>
              <span className="animate-spin mr-2">⟳</span>
              Testing...
            </>
          ) : (
            `Run ${testType.toUpperCase()} Test`
          )}
        </button>
      </div>
      
      {lastResult && (
        <div className={`p-3 rounded-md text-sm ${lastResult.includes('failed') ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300' : 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'}`}>
          {lastResult}
        </div>
      )}
      
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
        Email: {userEmail}<br/>
        API URL: {apiBaseUrl}
      </p>
    </div>
  );
};

export default TrackingTester;