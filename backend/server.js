const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
const Vonage = require('@vonage/server-sdk');  // Changed this line!
require('dotenv').config();

const { initDatabase, db } = require('./database');
const { setupWebSocket } = require('./websocket');
const authRoutes = require('./routes/auth');
const callRoutes = require('./routes/calls');
const scriptRoutes = require('./routes/scripts');
const advancedCallRoutes = require('./routes/advanced-calls');
const reactiveScriptRoutes = require('./routes/reactive-scripts');

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Serve audio files
const audioDir = path.join(__dirname, 'audio-cache');
if (!fs.existsSync(audioDir)) {
  fs.mkdirSync(audioDir, { recursive: true });
}
app.use('/audio', express.static(audioDir));

let privateKey;
const keyPath = path.join(__dirname, 'private.key');

if (fs.existsSync(keyPath)) {
  privateKey = fs.readFileSync(keyPath, 'utf8');
  console.log('✅ Loaded private key from FILE');
} else if (process.env.VONAGE_PRIVATE_KEY) {
  privateKey = Buffer.from(process.env.VONAGE_PRIVATE_KEY, 'base64').toString('utf8');
  console.log('✅ Loaded private key from ENVIRONMENT');
} else {
  console.error('❌ No private key found');
  process.exit(1);
}

// FIXED: Use correct syntax for v2.11.1
const vonage = new Vonage({
  apiKey: process.env.VONAGE_API_KEY,
  apiSecret: process.env.VONAGE_API_SECRET,
  applicationId: process.env.VONAGE_APPLICATION_ID,
  privateKey: privateKey
});

console.log('✅ Vonage initialized');

if (process.env.DEEPGRAM_API_KEY) {
  console.log('✅ Deepgram TTS enabled');
} else {
  console.warn('⚠️  No Deepgram API key - using Vonage TTS');
}

app.locals.vonage = vonage;
initDatabase();

// Auto-cleanup
setInterval(() => {
  try {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const deletedDtmf = db.prepare('DELETE FROM dtmf_logs WHERE timestamp < ?').run(fiveMinutesAgo);
    if (deletedDtmf.changes > 0) {
      console.log(`🗑️ Deleted ${deletedDtmf.changes} old DTMF logs`);
    }

    const files = fs.readdirSync(audioDir);
    const now = Date.now();
    let deletedFiles = 0;
    files.forEach(file => {
      const filePath = path.join(audioDir, file);
      const stats = fs.statSync(filePath);
      if (now - stats.mtimeMs > 5 * 60 * 1000) {
        fs.unlinkSync(filePath);
        deletedFiles++;
      }
    });
    if (deletedFiles > 0) {
      console.log(`🗑️ Deleted ${deletedFiles} old audio files`);
    }
  } catch (err) {
    console.error('Cleanup error:', err);
  }
}, 60000);

app.use('/api/auth', authRoutes);
app.use('/api/calls', callRoutes);
app.use('/api/scripts', scriptRoutes);
app.use('/api/advanced-calls', advancedCallRoutes);
app.use('/api/reactive-scripts', reactiveScriptRoutes);

app.get('/webhooks/answer', (req, res) => {
  res.json([{ action: 'talk', text: 'Connecting your call.', voiceName: 'Joey' }]);
});

app.post('/webhooks/event', (req, res) => {
  const event = req.body;
  console.log('📡 Event:', event.status || event.type);
  
  if (global.wss) {
    global.wss.clients.forEach(client => {
      if (client.readyState === 1) {
        client.send(JSON.stringify({ type: 'vonage_event', data: event }));
      }
    });
  }
  res.status(204).send();
});

app.post('/webhooks/dtmf', (req, res) => {
  const { dtmf, call_uuid } = req.body;
  console.log(`🔢 DTMF: ${dtmf}`);
  
  try {
    db.prepare('INSERT INTO dtmf_logs (call_uuid, digit, timestamp) VALUES (?, ?, ?)').run(call_uuid, dtmf, new Date().toISOString());
  } catch (err) {
    console.error('DTMF error:', err);
  }
  
  if (global.wss) {
    global.wss.clients.forEach(client => {
      if (client.readyState === 1) {
        client.send(JSON.stringify({ type: 'dtmf', data: { dtmf, call_uuid, timestamp: new Date().toISOString() } }));
      }
    });
  }
  res.status(204).send();
});

app.post('/webhooks/recording', (req, res) => {
  const recording = req.body;
  console.log('🎙️ Recording:', recording.recording_url);
  
  if (recording.recording_url && recording.conversation_uuid) {
    try {
      db.prepare('UPDATE calls SET recording_url = ? WHERE call_uuid = ?').run(recording.recording_url, recording.conversation_uuid);
    } catch (err) {
      console.error('Recording save error:', err);
    }
  }
  
  if (global.wss) {
    global.wss.clients.forEach(client => {
      if (client.readyState === 1) {
        client.send(JSON.stringify({ type: 'recording', data: recording }));
      }
    });
  }
  res.status(204).send();
});

app.use(express.static(path.join(__dirname, '../frontend/build')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/build/index.html'));
});

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`
╔══════════════════════════════════════════════════════════╗
║  🚀 Vonage Call System with Deepgram AI                  ║
║  📡 Listening: 0.0.0.0:${PORT}                           ║
║  🎙️ Voice: Deepgram TTS (if enabled)                    ║
║  🗑️ Auto-Cleanup: Every 5 minutes                        ║
╚══════════════════════════════════════════════════════════╝
  `);
});

setupWebSocket(server);
process.on('SIGTERM', () => { server.close(() => process.exit(0)); });
