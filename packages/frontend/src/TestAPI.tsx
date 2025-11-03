import React, { useState } from 'react';

const TestAPI: React.FC = () => {
  const [result, setResult] = useState<string>('');

  const testConnection = async () => {
    try {
      console.log('Testing API connection...');
      const response = await fetch('http://localhost:3001/api/test');
      const data = await response.text();
      setResult(`Success: ${response.status} - ${data}`);
      console.log('Test successful:', response.status, data);
    } catch (error) {
      setResult(`Error: ${error}`);
      console.error('Test failed:', error);
    }
  };

  const testLogin = async () => {
    try {
      console.log('Testing login...');
      const response = await fetch('http://localhost:3001/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: 'admin@bomizzel.com',
          password: 'password123'
        }),
      });
      const data = await response.text();
      setResult(`Login: ${response.status} - ${data}`);
      console.log('Login test:', response.status, data);
    } catch (error) {
      setResult(`Login Error: ${error}`);
      console.error('Login test failed:', error);
    }
  };

  return (
    <div style={{ padding: '20px' }}>
      <h2>API Test Page</h2>
      <button onClick={testConnection} style={{ margin: '10px', padding: '10px' }}>
        Test Connection
      </button>
      <button onClick={testLogin} style={{ margin: '10px', padding: '10px' }}>
        Test Login
      </button>
      <div style={{ marginTop: '20px', padding: '10px', border: '1px solid #ccc' }}>
        <strong>Result:</strong>
        <pre>{result}</pre>
      </div>
    </div>
  );
};

export default TestAPI;