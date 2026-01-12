import React, { useState, useEffect } from 'react';
import axios from 'axios';

function AdvancedCallInitiator({ token, axiosConfig }) {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [language, setLanguage] = useState('en-US');
  const [voice, setVoice] = useState('aura-asteria-en');
  const [callerId, setCallerId] = useState('');
  const [recordingEnabled, setRecordingEnabled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  
  const [savedScripts, setSavedScripts] = useState([]);
  const [selectedScriptId, setSelectedScriptId] = useState('');
  const [scriptName, setScriptName] = useState('');
  const [scriptSteps, setScriptSteps] = useState([
    { message: '', expectedDigits: 1, timeout: 30, validation: null }
  ]);

  const voiceOptions = {
    'en-US': [
      { value: 'aura-asteria-en', label: 'Asteria - Warm Female' },
      { value: 'aura-luna-en', label: 'Luna - Friendly Female' },
      { value: 'aura-stella-en', label: 'Stella - Professional Female' },
      { value: 'aura-athena-en', label: 'Athena - Authoritative Female' },
      { value: 'aura-hera-en', label: 'Hera - Confident Female' },
      { value: 'aura-orion-en', label: 'Orion - Deep Male' },
      { value: 'aura-arcas-en', label: 'Arcas - Casual Male' },
      { value: 'aura-perseus-en', label: 'Perseus - Professional Male' },
      { value: 'aura-angus-en', label: 'Angus - Irish Male' },
      { value: 'aura-orpheus-en', label: 'Orpheus - Narrator Male' },
      { value: 'aura-helios-en', label: 'Helios - Energetic Male' },
      { value: 'aura-zeus-en', label: 'Zeus - Commanding Male' }
    ],
    'es-ES': [
      { value: 'aura-asteria-en', label: 'Asteria (English accent)' }
    ]
  };

  const appointmentScript = {
    steps: [
      {
        message: "Hello customer, this is an automated call to notify you of an upcoming appointment. We need you to confirm the appointment. In order to do so, we need to verify your identity. A 6 digit one time password will be sent to the phone number associated with your account. Please enter those digits into the keypad now.",
        expectedDigits: 6,
        timeout: 30,
        validation: { type: 'exact_length', length: 6 },
        onInvalid: { message: "That code was incorrect. Please enter the 6 digit code sent to your phone." }
      },
      {
        message: "Thank you for verifying your identity. Please press 1 to confirm your appointment tomorrow at 12 PM at 123 North Janesmith Avenue, Anywhere, USA. We look forward to your visit. Goodbye.",
        expectedDigits: 1,
        timeout: 10
      }
    ],
    finalMessage: "Thank you. Your appointment has been confirmed. Goodbye."
  };

  useEffect(() => {
    fetchSavedScripts();
  }, []);

  const fetchSavedScripts = async () => {
    try {
      const response = await axios.get('/api/reactive-scripts', axiosConfig);
      setSavedScripts(response.data);
    } catch (err) {
      console.error('Failed to fetch scripts:', err);
    }
  };

  const makeCallWithScript = async (scriptFlow, scriptVoice, scriptLang) => {
    if (!phoneNumber) {
      alert('Please enter a phone number first');
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const response = await axios.post('/api/advanced-calls/initiate-advanced', {
        phone_number: phoneNumber,
        language: scriptLang || language,
        script_flow: scriptFlow,
        voice: scriptVoice || voice,
        caller_id: callerId || undefined,
        recording_enabled: recordingEnabled
      }, axiosConfig);

      setResult({ success: true, data: response.data });
      setPhoneNumber('');
    } catch (err) {
      setResult({ success: false, error: err.response?.data?.error || 'Call failed' });
    } finally {
      setLoading(false);
    }
  };

  const handleAppointmentCall = async () => {
    await makeCallWithScript(appointmentScript, voice, language);
  };

  const handleCustomCall = async () => {
    const customFlow = {
      steps: scriptSteps.filter(step => step.message.trim() !== ''),
      finalMessage: "Thank you. Goodbye."
    };
    await makeCallWithScript(customFlow, voice, language);
  };

  const handleCallWithSavedScript = async (script) => {
    await makeCallWithScript(script.script_flow, script.voice, script.language);
  };

  const handleSaveScript = async () => {
    if (!scriptName.trim()) {
      alert('Please enter a script name');
      return;
    }

    const customFlow = {
      steps: scriptSteps.filter(step => step.message.trim() !== ''),
      finalMessage: "Thank you. Goodbye."
    };

    try {
      await axios.post('/api/reactive-scripts', {
        name: scriptName,
        script_flow: customFlow,
        language: language,
        voice: voice
      }, axiosConfig);

      alert('Script saved successfully!');
      setScriptName('');
      fetchSavedScripts();
    } catch (err) {
      alert('Failed to save script');
    }
  };

  const handleLoadScript = async (scriptId) => {
    try {
      const response = await axios.get(`/api/reactive-scripts/${scriptId}`, axiosConfig);
      const script = response.data;
      
      setScriptSteps(script.script_flow.steps);
      setLanguage(script.language);
      setVoice(script.voice);
      alert(`Loaded: ${script.name}`);
    } catch (err) {
      alert('Failed to load script');
    }
  };

  const handleDeleteScript = async (scriptId) => {
    if (!window.confirm('Delete this script?')) return;

    try {
      await axios.delete(`/api/reactive-scripts/${scriptId}`, axiosConfig);
      fetchSavedScripts();
    } catch (err) {
      alert('Failed to delete script');
    }
  };

  const addStep = () => {
    setScriptSteps([...scriptSteps, {
      message: '',
      expectedDigits: 1,
      timeout: 30,
      validation: null
    }]);
  };

  const updateStep = (index, field, value) => {
    const newSteps = [...scriptSteps];
    newSteps[index][field] = value;
    setScriptSteps(newSteps);
  };

  const removeStep = (index) => {
    setScriptSteps(scriptSteps.filter((_, i) => i !== index));
  };

  return (
    <div className="advanced-call-initiator">
      <h2 className="section-title">🤖 ADVANCED REACTIVE SCRIPTS (DEEPGRAM AI)</h2>

      <div className="call-form">
        <div className="global-settings">
          <h3>📞 Call Settings</h3>
          
          <div className="form-group">
            <label>Phone Number *</label>
            <input
              type="tel"
              placeholder="+1234567890"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              required
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Language</label>
              <select value={language} onChange={(e) => setLanguage(e.target.value)}>
                <option value="en-US">English (US)</option>
                <option value="es-ES">Spanish (ES)</option>
              </select>
            </div>

            <div className="form-group">
              <label>AI Voice</label>
              <select value={voice} onChange={(e) => setVoice(e.target.value)}>
                {voiceOptions[language].map(v => (
                  <option key={v.value} value={v.value}>{v.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Caller ID (Optional)</label>
              <input
                type="tel"
                placeholder="Leave empty for default"
                value={callerId}
                onChange={(e) => setCallerId(e.target.value)}
              />
              <small>Must be a number you own/verified with Vonage</small>
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
          </div>
        </div>

        <div className="script-template">
          <h3>📋 Quick Start: Appointment Confirmation</h3>
          <div className="template-preview">
            <p><strong>Step 1:</strong> Request 6-digit OTP verification (30 sec)</p>
            <p><strong>Step 2:</strong> Confirm appointment (press 1)</p>
            <p><strong>Voice:</strong> Deepgram AI - Natural & Clear</p>
          </div>
          <button 
            onClick={handleAppointmentCall} 
            className="call-btn template-btn"
            disabled={loading || !phoneNumber}
          >
            {loading ? '📞 CALLING...' : '📞 START APPOINTMENT CALL'}
          </button>
        </div>

        {savedScripts.length > 0 && (
          <div className="saved-scripts-section">
            <h3>💾 Saved Reactive Scripts</h3>
            <div className="saved-scripts-list">
              {savedScripts.map(script => (
                <div key={script.id} className="saved-script-item">
                  <div className="script-info">
                    <strong>{script.name}</strong>
                    <span className="script-meta">
                      {script.language} • {script.voice.split('-')[1]} voice • {script.script_flow.steps.length} steps
                    </span>
                  </div>
                  <div className="script-actions">
                    <button 
                      onClick={() => handleCallWithSavedScript(script)}
                      className="call-with-script-btn"
                      disabled={loading || !phoneNumber}
                    >
                      📞 Call
                    </button>
                    <button onClick={() => handleLoadScript(script.id)}>📂 Edit</button>
                    <button onClick={() => handleDeleteScript(script.id)} className="delete-btn">🗑️</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="custom-script-builder">
          <h3>🛠️ Custom Multi-Step Script Builder</h3>
          
          <div className="form-group">
            <label>Script Name (to save)</label>
            <input
              type="text"
              placeholder="e.g., Payment Verification Flow"
              value={scriptName}
              onChange={(e) => setScriptName(e.target.value)}
            />
          </div>

          {scriptSteps.map((step, index) => (
            <div key={index} className="script-step">
              <div className="step-header">
                <h4>Step {index + 1}</h4>
                {scriptSteps.length > 1 && (
                  <button 
                    type="button" 
                    onClick={() => removeStep(index)}
                    className="remove-step-btn"
                  >
                    ❌ Remove
                  </button>
                )}
              </div>

              <div className="form-group">
                <label>Message (What the AI will say)</label>
                <textarea
                  rows="3"
                  placeholder="Enter the message for this step..."
                  value={step.message}
                  onChange={(e) => updateStep(index, 'message', e.target.value)}
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Expected Digits</label>
                  <input
                    type="number"
                    min="1"
                    max="20"
                    value={step.expectedDigits}
                    onChange={(e) => updateStep(index, 'expectedDigits', parseInt(e.target.value))}
                  />
                </div>

                <div className="form-group">
                  <label>Timeout (seconds)</label>
                  <input
                    type="number"
                    min="5"
                    max="60"
                    value={step.timeout}
                    onChange={(e) => updateStep(index, 'timeout', parseInt(e.target.value))}
                  />
                </div>
              </div>
            </div>
          ))}

          <button type="button" onClick={addStep} className="add-step-btn">
            ➕ Add Another Step
          </button>

          <div className="button-row">
            <button 
              onClick={handleSaveScript} 
              className="save-btn"
              disabled={!scriptName.trim()}
            >
              💾 Save Script
            </button>

            <button 
              onClick={handleCustomCall} 
              className="call-btn"
              disabled={loading || !phoneNumber}
            >
              {loading ? '📞 CALLING...' : '📞 START CUSTOM CALL'}
            </button>
          </div>
        </div>

        {result && (
          <div className={`result-box ${result.success ? 'success' : 'error'}`}>
            {result.success ? (
              <>
                <h3>✅ Call Initiated with Deepgram AI!</h3>
                <p>Call UUID: {result.data.call_uuid}</p>
                <p>Using voice: {voice}</p>
                <p>Check Live Monitor for real-time DTMF updates</p>
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
    </div>
  );
}

export default AdvancedCallInitiator;
