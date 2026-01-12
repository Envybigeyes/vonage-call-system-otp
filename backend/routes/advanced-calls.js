const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { db } = require('../database');
const { verifyToken } = require('./auth');

const router = express.Router();
const callStates = new Map();

let DeepgramTTS = null;
let deepgramTTS = null;

try {
  if (process.env.DEEPGRAM_API_KEY) {
    DeepgramTTS = require('../services/deepgram-tts');
    deepgramTTS = new DeepgramTTS();
    console.log('✅ Deepgram TTS loaded');
  }
} catch (err) {
  console.warn('⚠️  Deepgram not available:', err.message);
}

function useFallbackTTS() {
  return !deepgramTTS || !deepgramTTS.enabled;
}

router.post('/initiate-advanced', verifyToken, async (req, res) => {
  const { phone_number, language, script_flow, voice, caller_id, recording_enabled } = req.body;

  try {
    const vonage = req.app.locals.vonage;
    const tempCallUuid = uuidv4();

    callStates.set(tempCallUuid, {
      currentStep: 0,
      scriptFlow: script_flow,
      dtmfBuffer: '',
      phoneNumber: phone_number,
      language: language || 'en-US',
      voice: voice || 'Joey',
      recording: recording_enabled || false,
      useDeepgram: !useFallbackTTS()
    });

    const firstStep = script_flow.steps[0];
    const fromNumber = caller_id || process.env.VONAGE_PHONE_NUMBER;

    let audioUrl = null;
    if (!useFallbackTTS()) {
      try {
        const audioData = await deepgramTTS.generateForVonage(
          firstStep.message,
          `${tempCallUuid}-step0`,
          { voice: voice || 'aura-asteria-en' }
        );
        audioUrl = audioData.streamUrl;
        callStates.get(tempCallUuid).audioUrls = [audioUrl];
      } catch (err) {
        console.error('Deepgram failed, using Vonage TTS:', err.message);
        callStates.get(tempCallUuid).useDeepgram = false;
      }
    }

    // FIXED: Use callback-based API for v2.11.1
    vonage.calls.create({
      to: [{ type: 'phone', number: phone_number }],
      from: { type: 'phone', number: fromNumber },
      answer_url: [`${process.env.BASE_URL}/api/advanced-calls/answer/${tempCallUuid}`],
      answer_method: 'POST',
      event_url: [`${process.env.BASE_URL}/webhooks/event`]
    }, (err, result) => {
      if (err) {
        console.error('Vonage call error:', err);
        return res.status(500).json({ error: err.message || 'Call failed' });
      }

      const callData = callStates.get(tempCallUuid);
      callStates.set(result.uuid, callData);
      callStates.delete(tempCallUuid);

      const insert = db.prepare(`
        INSERT INTO calls (call_uuid, phone_number, language, custom_script, recording_enabled, caller_id, voice_model, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      insert.run(
        result.uuid,
        phone_number,
        language,
        JSON.stringify(script_flow),
        recording_enabled ? 1 : 0,
        fromNumber,
        voice || 'Joey',
        'ringing'
      );

      res.json({ success: true, call_uuid: result.uuid });
    });
  } catch (err) {
    console.error('Advanced call error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/answer/:call_uuid', async (req, res) => {
  const { call_uuid } = req.params;
  const state = callStates.get(call_uuid);

  if (!state) {
    return res.json([{ action: 'talk', text: 'Call state not found.', voiceName: 'Joey' }]);
  }

  const step = state.scriptFlow.steps[state.currentStep];
  const voiceName = state.language === 'es-ES' ? 'Lucia' : 'Joey';

  const ncco = [];

  if (state.useDeepgram && state.audioUrls && state.audioUrls[state.currentStep]) {
    ncco.push({
      action: 'stream',
      streamUrl: [state.audioUrls[state.currentStep]]
    });
  } else {
    ncco.push({
      action: 'talk',
      text: step.message,
      voiceName: voiceName,
      language: state.language
    });
  }

  if (state.recording) {
    ncco.push({
      action: 'record',
      eventUrl: [`${process.env.BASE_URL}/webhooks/recording`],
      endOnSilence: 3,
      format: 'mp3'
    });
  }

  ncco.push({
    action: 'input',
    eventUrl: [`${process.env.BASE_URL}/api/advanced-calls/dtmf-handler/${call_uuid}`],
    dtmf: {
      maxDigits: step.expectedDigits || 1,
      timeOut: step.timeout || 30
    }
  });

  res.json(ncco);
});

router.post('/dtmf-handler/:call_uuid', async (req, res) => {
  const { call_uuid } = req.params;
  const { dtmf } = req.body;
  const state = callStates.get(call_uuid);

  if (!state) {
    return res.json([{ action: 'talk', text: 'Session expired.', voiceName: 'Joey' }]);
  }

  db.prepare('INSERT INTO dtmf_logs (call_uuid, digit, timestamp) VALUES (?, ?, ?)').run(call_uuid, dtmf, new Date().toISOString());

  if (global.wss) {
    global.wss.clients.forEach(client => {
      if (client.readyState === 1) {
        client.send(JSON.stringify({
          type: 'dtmf',
          data: { call_uuid, dtmf, timestamp: new Date().toISOString() }
        }));
      }
    });
  }

  state.dtmfBuffer += dtmf;
  const currentStep = state.scriptFlow.steps[state.currentStep];
  const voiceName = state.language === 'es-ES' ? 'Lucia' : 'Joey';

  if (state.dtmfBuffer.length >= (currentStep.expectedDigits || 1)) {
    state.dtmfBuffer = '';
    state.currentStep++;

    if (state.currentStep >= state.scriptFlow.steps.length) {
      callStates.delete(call_uuid);
      return res.json([
        { action: 'talk', text: state.scriptFlow.finalMessage || 'Thank you. Goodbye.', voiceName: voiceName }
      ]);
    }

    const nextStep = state.scriptFlow.steps[state.currentStep];
    return res.json([
      { action: 'talk', text: nextStep.message, voiceName: voiceName },
      {
        action: 'input',
        eventUrl: [`${process.env.BASE_URL}/api/advanced-calls/dtmf-handler/${call_uuid}`],
        dtmf: { maxDigits: nextStep.expectedDigits || 1, timeOut: nextStep.timeout || 30 }
      }
    ]);
  }

  res.json([]);
});

module.exports = router;
