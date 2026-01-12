import React, { useState, useEffect } from 'react';
import axios from 'axios';

function LiveCallMonitor({ token, axiosConfig, ws }) {
  const [calls, setCalls] = useState([]);
  const [selectedCall, setSelectedCall] = useState(null);
  const [dtmfLogs, setDtmfLogs] = useState([]);
  const [liveUpdates, setLiveUpdates] = useState([]);
  const [liveDtmf, setLiveDtmf] = useState([]);

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
        setLiveDtmf(prev => [...prev, data.data.dtmf].slice(-10));
        setLiveUpdates(prev => [`[${new Date().toLocaleTimeString()}] DTMF: ${data.data.dtmf}`, ...prev].slice(0, 50));
      } else if (data.type === 'vonage_event') {
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

      {/* Live DTMF Display */}
      <div className="live-dtmf-display">
        <h4>
          <span className="live-indicator"></span>
          LIVE DTMF INPUT
        </h4>
        <div className="dtmf-digits">
          {liveDtmf.length > 0 ? (
            liveDtmf.map((digit, i) => (
              <div key={i} className="dtmf-digit">{digit}</div>
            ))
          ) : (
            <div className="no-dtmf">Waiting for customer keypad input...</div>
          )}
        </div>
      </div>

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
                {call.voice_model && <span> • {call.voice_model.split('-')[1]}</span>}
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
                {selectedCall.caller_id && (
                  <div className="detail-item">
                    <label>Caller ID:</label>
                    <span>{selectedCall.caller_id}</span>
                  </div>
                )}
                {selectedCall.voice_model && (
                  <div className="detail-item">
                    <label>Voice:</label>
                    <span>{selectedCall.voice_model}</span>
                  </div>
                )}
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

              {/* Recording Playback */}
              {selectedCall.recording_url && (
                <div className="recording-section">
                  <h4>🎙️ Call Recording</h4>
                  <div className="recording-player">
                    <audio controls src={selectedCall.recording_url}>
                      Your browser does not support audio playback.
                    </audio>
                    <a 
                      href={selectedCall.recording_url} 
                      download
                      className="download-recording-btn"
                    >
                      📥 Download
                    </a>
                  </div>
                </div>
              )}

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
