import React, { useState } from 'react';
import axios from 'axios';

const ApiTest: React.FC = () => {
  const [result, setResult] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const testConnection = async () => {
    setLoading(true);
    setResult('');

    try {
      const testUrl = 'http://localhost:3001/health';
      console.log('Direct test URL:', testUrl);

      setResult(`🔍 Testing direct connection to: ${testUrl}`);

      // Use fetch instead of axios to avoid any axios configuration issues
      const response = await fetch(testUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      setResult(`✅ Success with fetch: ${JSON.stringify(data)}`);
    } catch (error: any) {
      console.error('Connection test failed:', error);
      setResult(`❌ Fetch Error: ${error.message}
Type: ${error.name || 'Unknown'}
Stack: ${error.stack || 'No stack trace'}`);
    } finally {
      setLoading(false);
    }
  };

  const testLogin = async () => {
    setLoading(true);
    setResult('');

    try {
      const apiUrl = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3001';
      console.log('Testing login to:', `${apiUrl}/api/auth/login`);

      const response = await axios.post(`${apiUrl}/api/auth/login`, {
        email: 'admin@bomizzel.com',
        password: 'password123',
      });
      setResult(`✅ Login Success: ${JSON.stringify(response.data, null, 2)}`);
    } catch (error: any) {
      console.error('Login test failed:', error);
      setResult(
        `❌ Login Error: ${error.message} - Status: ${error.response?.status} - Data: ${JSON.stringify(error.response?.data)}`
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 bg-white border rounded-lg shadow">
      <h3 className="text-lg font-semibold mb-4">API Connection Test</h3>

      <div className="space-y-2 mb-4">
        <button
          onClick={testConnection}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 mr-2"
        >
          {loading ? 'Testing...' : 'Test Health Endpoint'}
        </button>

        <button
          onClick={testLogin}
          disabled={loading}
          className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
        >
          {loading ? 'Testing...' : 'Test Login'}
        </button>
      </div>

      {result && (
        <div className="p-3 bg-gray-100 rounded text-sm font-mono whitespace-pre-wrap">
          {result}
        </div>
      )}
    </div>
  );
};

export default ApiTest;
