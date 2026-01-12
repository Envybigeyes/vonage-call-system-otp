import React, { useState, useEffect } from 'react';
import CallInitiator from './CallInitiator';
import AdvancedCallInitiator from './AdvancedCallInitiator';
import LiveCallMonitor from './LiveCallMonitor';
import Analytics from './Analytics';

function Dashboard({ token, username, onLogout }) {
  const [activeView, setActiveView] = useState('initiator');
  const [wsConnected, setWsConnected] = useState(false);
  const [ws, setWs] = useState(null);

  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;
    const websocket = new WebSocket(wsUrl);
    websocket.onopen = () => { setWsConnected(true); };
    websocket.onclose = () => { setWsConnected(false); };
    setWs(websocket);
    return () => { websocket.close(); };
  }, []);

  const axiosConfig = { headers: { Authorization: `Bearer ${token}` } };

  return (
    <div className="dashboard">
      <nav className="navbar">
        <div className="nav-left">
          <h1 className="nav-title"><span className="glitch" data-text="VONAGE">VONAGE</span> CALL SYSTEM</h1>
          <div className="status-indicator">
            <span className={`status-dot ${wsConnected ? 'connected' : 'disconnected'}`}></span>
            {wsConnected ? 'CONNECTED' : 'DISCONNECTED'}
          </div>
        </div>
        <div className="nav-right">
          <span className="username">👤 {username}</span>
          <button onClick={onLogout} className="logout-btn">LOGOUT</button>
        </div>
      </nav>

      <div className="dashboard-content">
        <aside className="sidebar">
          <button
            className={`sidebar-btn ${activeView === 'initiator' ? 'active' : ''}`}
            onClick={() => setActiveView('initiator')}
          >
            📞 SIMPLE CALL
          </button>
          <button
            className={`sidebar-btn ${activeView === 'advanced' ? 'active' : ''}`}
            onClick={() => setActiveView('advanced')}
          >
            🤖 ADVANCED SCRIPTS
          </button>
          <button
            className={`sidebar-btn ${activeView === 'monitor' ? 'active' : ''}`}
            onClick={() => setActiveView('monitor')}
          >
            📡 LIVE MONITOR
          </button>
          <button
            className={`sidebar-btn ${activeView === 'analytics' ? 'active' : ''}`}
            onClick={() => setActiveView('analytics')}
          >
            📊 ANALYTICS
          </button>
        </aside>

        <main className="main-content">
          {activeView === 'initiator' && (
            <CallInitiator token={token} axiosConfig={axiosConfig} />
          )}
          {activeView === 'advanced' && (
            <AdvancedCallInitiator token={token} axiosConfig={axiosConfig} />
          )}
          {activeView === 'monitor' && (
            <LiveCallMonitor token={token} axiosConfig={axiosConfig} ws={ws} />
          )}
          {activeView === 'analytics' && (
            <Analytics token={token} axiosConfig={axiosConfig} />
          )}
        </main>
      </div>
    </div>
  );
}

export default Dashboard;
