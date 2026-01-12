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
