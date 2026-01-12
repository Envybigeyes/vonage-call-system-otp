import React, { useState } from 'react';
import Login from './components/Login';
import Dashboard from './components/Dashboard';

function App() {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [username, setUsername] = useState(localStorage.getItem('username'));

  const handleLogin = (authToken, user) => {
    localStorage.setItem('token', authToken);
    localStorage.setItem('username', user);
    setToken(authToken);
    setUsername(user);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    setToken(null);
    setUsername(null);
  };

  return (
    <div className="app">
      {!token ? (
        <Login onLogin={handleLogin} />
      ) : (
        <Dashboard token={token} username={username} onLogout={handleLogout} />
      )}
    </div>
  );
}

export default App;
