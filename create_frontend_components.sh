#!/bin/bash
# PART 3: Create All Frontend React Components
# Run this from inside vonage-call-system directory

set -e

echo "╔══════════════════════════════════════════════════════════╗"
echo "║  CREATING FRONTEND REACT COMPONENTS...                  ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

cd ~/vonage-call-system

echo "📝 Creating frontend/src/components/Login.js..."
cat > frontend/src/components/Login.js << 'LOGINJS'
import React, { useState } from 'react';
import axios from 'axios';

function Login({ onLogin }) {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('admin');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await axios.post('/api/auth/login', { username, password });
      onLogin(response.data.token, response.data.username);
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-box">
        <div className="cyber-border"></div>
        <h1 className="login-title">
          <span className="glitch" data-text="VONAGE">VONAGE</span>
          <br />
          CALL SYSTEM
        </h1>
        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <input
              type="text"
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>
          <div className="input-group">
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {error && <div className="error-message">{error}</div>}
          <button type="submit" className="login-btn" disabled={loading}>
            {loading ? 'AUTHENTICATING...' : 'ACCESS SYSTEM'}
          </button>
        </form>
        <div className="login-footer">
          Default: admin / admin
        </div>
      </div>
    </div>
  );
}

export default Login;
LOGINJS

echo "✅ Login.js created"

echo "📝 Creating frontend/src/components/Dashboard.js..."
cat > frontend/src/components/Dashboard.js << 'DASHJS'
import React, { useState, useEffect } from 'react';
import CallInitiator from './CallInitiator';
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

    websocket.onopen = () => {
      console.log('WebSocket connected');
      setWsConnected(true);
    };

    websocket.onclose = () => {
      console.log('WebSocket disconnected');
      setWsConnected(false);
    };

    setWs(websocket);

    return () => {
      websocket.close();
    };
  }, []);

  const axiosConfig = {
    headers: { Authorization: `Bearer ${token}` }
  };

  return (
    <div className="dashboard">
      <nav className="navbar">
        <div className="nav-left">
          <h1 className="nav-title">
            <span className="glitch" data-text="VONAGE">VONAGE</span> CALL SYSTEM
          </h1>
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
            📞 CALL INITIATOR
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
DASHJS

echo "✅ Dashboard.js created"

echo "📝 Creating frontend/src/components/CallInitiator.js..."
cat > frontend/src/components/CallInitiator.js << 'CALLJS'
import React, { useState, useEffect } from 'react';
import axios from 'axios';

function CallInitiator({ token, axiosConfig }) {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [language, setLanguage] = useState('en-US');
  const [scriptId, setScriptId] = useState('');
  const [customScript, setCustomScript] = useState('');
  const [recordingEnabled, setRecordingEnabled] = useState(false);
  const [scripts, setScripts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [saveScriptName, setSaveScriptName] = useState('');

  useEffect(() => {
    fetchScripts();
  }, []);

  const fetchScripts = async () => {
    try {
      const response = await axios.get('/api/scripts', axiosConfig);
      setScripts(response.data);
    } catch (err) {
      console.error('Failed to fetch scripts:', err);
    }
  };

  const handleInitiateCall = async (e) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);

    try {
      const response = await axios.post('/api/calls/initiate', {
        phone_number: phoneNumber,
        language,
        script_id: scriptId || null,
        custom_script: customScript || null,
        recording_enabled: recordingEnabled
      }, axiosConfig);

      setResult({ success: true, data: response.data });
      setPhoneNumber('');
      setCustomScript('');
    } catch (err) {
      setResult({ success: false, error: err.response?.data?.error || 'Call failed' });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveScript = async () => {
    if (!saveScriptName || !customScript) {
      alert('Please provide a script name and content');
      return;
    }

    try {
      await axios.post('/api/scripts', {
        name: saveScriptName,
        content: customScript,
        language
      }, axiosConfig);

      alert('Script saved successfully!');
      setSaveScriptName('');
      fetchScripts();
    } catch (err) {
      alert('Failed to save script');
    }
  };

  return (
    <div className="call-initiator">
      <h2 className="section-title">📞 INITIATE CALL</h2>

      <form onSubmit={handleInitiateCall} className="call-form">
        <div className="form-group">
          <label>Phone Number</label>
          <input
            type="tel"
            placeholder="+1234567890"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            required
          />
        </div>

        <div className="form-group">
          <label>Language</label>
          <select value={language} onChange={(e) => setLanguage(e.target.value)}>
            <option value="en-US">English (US)</option>
            <option value="es-ES">Spanish (ES)</option>
          </select>
        </div>

        <div className="form-group">
          <label>Pre-saved Script</label>
          <select value={scriptId} onChange={(e) => {
            setScriptId(e.target.value);
            if (e.target.value) {
              const script = scripts.find(s => s.id === parseInt(e.target.value));
              setCustomScript(script?.content || '');
            }
          }}>
            <option value="">-- Select Script --</option>
            {scripts.map(script => (
              <option key={script.id} value={script.id}>{script.name}</option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label>Custom Script</label>
          <textarea
            rows="5"
            placeholder="Enter custom script text..."
            value={customScript}
            onChange={(e) => setCustomScript(e.target.value)}
          />
          <div className="script-actions">
            <input
              type="text"
              placeholder="Script name to save"
              value={saveScriptName}
              onChange={(e) => setSaveScriptName(e.target.value)}
              className="save-script-input"
            />
            <button type="button" onClick={handleSaveScript} className="save-script-btn">
              💾 SAVE SCRIPT
            </button>
          </div>
        </div>

        <div className="form-group checkbox-group">
          <label>
            <input
              type="checkbox"
              checked={recordingEnabled}
              onChange={(e) => setRecordingEnabled(e.target.checked)}
            />
            Enable Call Recording
          </label>
        </div>

        <button type="submit" className="call-btn" disabled={loading}>
          {loading ? '📞 CALLING...' : '📞 START CALL'}
        </button>
      </form>

      {result && (
        <div className={`result-box ${result.success ? 'success' : 'error'}`}>
          {result.success ? (
            <>
              <h3>✅ Call Initiated Successfully!</h3>
              <p>Call UUID: {result.data.call_uuid}</p>
              <p>Check Live Monitor for real-time updates</p>
            </>
          ) : (
            <>
              <h3>❌ Call Failed</h3>
              <p>{result.error}</p>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default CallInitiator;
CALLJS

echo "✅ CallInitiator.js created"

echo "📝 Creating frontend/src/components/LiveCallMonitor.js..."
cat > frontend/src/components/LiveCallMonitor.js << 'MONITORJS'
import React, { useState, useEffect } from 'react';
import axios from 'axios';

function LiveCallMonitor({ token, axiosConfig, ws }) {
  const [calls, setCalls] = useState([]);
  const [selectedCall, setSelectedCall] = useState(null);
  const [dtmfLogs, setDtmfLogs] = useState([]);
  const [events, setEvents] = useState([]);
  const [liveUpdates, setLiveUpdates] = useState([]);

  useEffect(() => {
    fetchCalls();
    const interval = setInterval(fetchCalls, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!ws) return;

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      if (data.type === 'dtmf') {
        setDtmfLogs(prev => [...prev, data.data]);
        setLiveUpdates(prev => [`[${new Date().toLocaleTimeString()}] DTMF: ${data.data.dtmf}`, ...prev].slice(0, 50));
      } else if (data.type === 'vonage_event') {
        setEvents(prev => [data.data, ...prev].slice(0, 50));
        setLiveUpdates(prev => [`[${new Date().toLocaleTimeString()}] Event: ${data.data.status || data.data.type}`, ...prev].slice(0, 50));
      }
    };
  }, [ws]);

  const fetchCalls = async () => {
    try {
      const response = await axios.get('/api/calls', axiosConfig);
      setCalls(response.data);
    } catch (err) {
      console.error('Failed to fetch calls:', err);
    }
  };

  const fetchCallDetails = async (call_uuid) => {
    try {
      const response = await axios.get(`/api/calls/${call_uuid}`, axiosConfig);
      setSelectedCall(response.data.call);
      setDtmfLogs(response.data.dtmf);
      setEvents(response.data.events);
    } catch (err) {
      console.error('Failed to fetch call details:', err);
    }
  };

  const handleStartRecording = async (call_uuid) => {
    try {
      await axios.post(`/api/calls/${call_uuid}/record`, {}, axiosConfig);
      alert('Recording started');
    } catch (err) {
      alert('Failed to start recording');
    }
  };

  const handleEscalate = async (call_uuid) => {
    if (!window.confirm('Escalate this call to your phone?')) return;
    
    try {
      await axios.post(`/api/calls/${call_uuid}/escalate`, {}, axiosConfig);
      alert('Call escalated to your phone');
    } catch (err) {
      alert('Failed to escalate call');
    }
  };

  const handleHangup = async (call_uuid) => {
    if (!window.confirm('Hang up this call?')) return;
    
    try {
      await axios.post(`/api/calls/${call_uuid}/hangup`, {}, axiosConfig);
      alert('Call ended');
      fetchCalls();
    } catch (err) {
      alert('Failed to hang up call');
    }
  };

  return (
    <div className="live-monitor">
      <h2 className="section-title">📡 LIVE CALL MONITOR</h2>

      <div className="monitor-grid">
        <div className="calls-list">
          <h3>Recent Calls</h3>
          {calls.map(call => (
            <div
              key={call.id}
              className={`call-item ${selectedCall?.id === call.id ? 'selected' : ''}`}
              onClick={() => fetchCallDetails(call.call_uuid)}
            >
              <div className="call-header">
                <span className={`status-badge ${call.status}`}>{call.status}</span>
                <span className="call-number">{call.phone_number}</span>
              </div>
              <div className="call-meta">
                {new Date(call.started_at).toLocaleString()}
              </div>
            </div>
          ))}
        </div>

        <div className="call-details">
          {selectedCall ? (
            <>
              <h3>Call Details</h3>
              <div className="details-grid">
                <div className="detail-item">
                  <label>UUID:</label>
                  <span>{selectedCall.call_uuid}</span>
                </div>
                <div className="detail-item">
                  <label>Phone:</label>
                  <span>{selectedCall.phone_number}</span>
                </div>
                <div className="detail-item">
                  <label>Status:</label>
                  <span className={`status-badge ${selectedCall.status}`}>
                    {selectedCall.status}
                  </span>
                </div>
                <div className="detail-item">
                  <label>Language:</label>
                  <span>{selectedCall.language}</span>
                </div>
              </div>

              <div className="call-actions">
                <button onClick={() => handleStartRecording(selectedCall.call_uuid)}>
                  🎙️ START RECORDING
                </button>
                <button onClick={() => handleEscalate(selectedCall.call_uuid)}>
                  📞 ESCALATE
                </button>
                <button onClick={() => handleHangup(selectedCall.call_uuid)} className="danger">
                  ❌ HANG UP
                </button>
              </div>

              <h4>DTMF Inputs</h4>
              <div className="dtmf-log">
                {dtmfLogs.length > 0 ? (
                  dtmfLogs.map((log, i) => (
                    <div key={i} className="log-entry">
                      <span className="digit">{log.digit}</span>
                      <span className="time">{new Date(log.timestamp).toLocaleTimeString()}</span>
                    </div>
                  ))
                ) : (
                  <p className="no-data">No DTMF inputs yet</p>
                )}
              </div>
            </>
          ) : (
            <p className="no-selection">Select a call to view details</p>
          )}
        </div>

        <div className="live-feed">
          <h3>🔴 Live Updates</h3>
          <div className="updates-log">
            {liveUpdates.map((update, i) => (
              <div key={i} className="update-entry">{update}</div>
            ))}
            {liveUpdates.length === 0 && (
              <p className="no-data">Waiting for live events...</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default LiveCallMonitor;
MONITORJS

echo "✅ LiveCallMonitor.js created"

echo "📝 Creating frontend/src/components/Analytics.js..."
cat > frontend/src/components/Analytics.js << 'ANALYTICSJS'
import React, { useState, useEffect } from 'react';
import axios from 'axios';

function Analytics({ token, axiosConfig }) {
  const [stats, setStats] = useState(null);
  const [calls, setCalls] = useState([]);

  useEffect(() => {
    fetchAnalytics();
    fetchCalls();
  }, []);

  const fetchAnalytics = async () => {
    try {
      const response = await axios.get('/api/calls/analytics/stats', axiosConfig);
      setStats(response.data);
    } catch (err) {
      console.error('Failed to fetch analytics:', err);
    }
  };

  const fetchCalls = async () => {
    try {
      const response = await axios.get('/api/calls', axiosConfig);
      setCalls(response.data);
    } catch (err) {
      console.error('Failed to fetch calls:', err);
    }
  };

  return (
    <div className="analytics">
      <h2 className="section-title">📊 ANALYTICS & REPORTS</h2>

      {stats && (
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-value">{stats.total_calls}</div>
            <div className="stat-label">Total Calls</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.completed_calls}</div>
            <div className="stat-label">Completed</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.failed_calls}</div>
            <div className="stat-label">Failed</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.success_rate}%</div>
            <div className="stat-label">Success Rate</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.average_duration}s</div>
            <div className="stat-label">Avg Duration</div>
          </div>
        </div>
      )}

      <div className="call-history">
        <h3>Call History</h3>
        <table className="data-table">
          <thead>
            <tr>
              <th>Time</th>
              <th>Phone Number</th>
              <th>Language</th>
              <th>Status</th>
              <th>Script</th>
              <th>Duration</th>
            </tr>
          </thead>
          <tbody>
            {calls.map(call => (
              <tr key={call.id}>
                <td>{new Date(call.started_at).toLocaleString()}</td>
                <td>{call.phone_number}</td>
                <td>{call.language}</td>
                <td>
                  <span className={`status-badge ${call.status}`}>
                    {call.status}
                  </span>
                </td>
                <td>{call.script_name || 'Custom'}</td>
                <td>{call.duration ? `${call.duration}s` : 'N/A'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default Analytics;
ANALYTICSJS

echo "✅ Analytics.js created"
echo ""
echo "✅ ALL REACT COMPONENTS CREATED!"
echo ""
