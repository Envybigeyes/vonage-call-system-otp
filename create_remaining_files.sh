#!/bin/bash
# PART 2: Create All Remaining Backend and Frontend Files
# Run this from inside the vonage-call-system directory

set -e

echo "╔══════════════════════════════════════════════════════════╗"
echo "║  CREATING ALL REMAINING CODE FILES...                   ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

if [ ! -d "backend" ] || [ ! -d "frontend" ]; then
    echo "❌ Error: Run this from inside vonage-call-system directory"
    echo "Current dir: $(pwd)"
    exit 1
fi

echo "📝 Creating backend/database.js..."
cat > backend/database.js << 'DBJS'
const Database = require('better-sqlite3');
const path = require('path');

const dbPath = process.env.DATABASE_PATH || path.join(__dirname, 'vonage.db');
const db = new Database(dbPath);

function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS scripts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      content TEXT NOT NULL,
      language TEXT DEFAULT 'en-US',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS calls (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      call_uuid TEXT UNIQUE,
      phone_number TEXT NOT NULL,
      language TEXT NOT NULL,
      script_id INTEGER,
      custom_script TEXT,
      status TEXT DEFAULT 'initiated',
      recording_enabled INTEGER DEFAULT 0,
      started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      ended_at DATETIME,
      duration INTEGER,
      FOREIGN KEY(script_id) REFERENCES scripts(id)
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS dtmf_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      call_uuid TEXT NOT NULL,
      digit TEXT NOT NULL,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(call_uuid) REFERENCES calls(call_uuid)
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS call_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      call_uuid TEXT NOT NULL,
      event_type TEXT NOT NULL,
      event_data TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(call_uuid) REFERENCES calls(call_uuid)
    )
  `);

  const insertUser = db.prepare('INSERT OR IGNORE INTO users (username, password) VALUES (?, ?)');
  insertUser.run('admin', 'admin');

  const insertScript = db.prepare('INSERT OR IGNORE INTO scripts (id, name, content, language) VALUES (?, ?, ?, ?)');
  insertScript.run(1, 'Welcome Call (English)', 'Hello, this is an automated call. Please press 1 to continue or 2 to speak with an agent.', 'en-US');
  insertScript.run(2, 'Llamada de Bienvenida (Spanish)', 'Hola, esta es una llamada automatizada. Presione 1 para continuar o 2 para hablar con un agente.', 'es-ES');

  console.log('✅ Database initialized');
}

module.exports = { db, initDatabase };
DBJS

echo "✅ database.js created"

echo "📝 Creating backend/websocket.js..."
cat > backend/websocket.js << 'WSJS'
const WebSocket = require('ws');

function setupWebSocket(server) {
  const wss = new WebSocket.Server({ server });

  wss.on('connection', (ws) => {
    console.log('🔌 WebSocket client connected');

    ws.on('message', (message) => {
      console.log('📨 Received:', message.toString());
    });

    ws.on('close', () => {
      console.log('🔌 WebSocket client disconnected');
    });

    ws.send(JSON.stringify({ type: 'connected', message: 'WebSocket connected' }));
  });

  global.wss = wss;
  console.log('✅ WebSocket server ready');
}

module.exports = { setupWebSocket };
WSJS

echo "✅ websocket.js created"

echo "📝 Creating backend/server.js..."
cat > backend/server.js << 'SERVERJS'
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
const { Vonage } = require('@vonage/server-sdk');
require('dotenv').config();

const { initDatabase } = require('./database');
const { setupWebSocket } = require('./websocket');
const authRoutes = require('./routes/auth');
const callRoutes = require('./routes/calls');
const scriptRoutes = require('./routes/scripts');

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

let privateKey;
try {
  privateKey = fs.readFileSync(path.join(__dirname, 'private.key'), 'utf8');
} catch (err) {
  console.error('⚠️  private.key not found. Please add it to backend/ directory');
  process.exit(1);
}

const vonage = new Vonage({
  apiKey: process.env.VONAGE_API_KEY,
  apiSecret: process.env.VONAGE_API_SECRET,
  applicationId: process.env.VONAGE_APPLICATION_ID,
  privateKey: privateKey
});

app.locals.vonage = vonage;
initDatabase();

app.use('/api/auth', authRoutes);
app.use('/api/calls', callRoutes);
app.use('/api/scripts', scriptRoutes);

app.get('/webhooks/answer', (req, res) => {
  const { call_uuid, to } = req.query;
  console.log(`📞 Call answered: ${call_uuid} to ${to}`);
  
  const ncco = [{
    action: 'talk',
    text: 'Connecting your call, please wait.',
    voiceName: 'Amy'
  }];
  
  res.json(ncco);
});

app.post('/webhooks/event', (req, res) => {
  const event = req.body;
  console.log('📡 Vonage Event:', event);
  
  if (global.wss) {
    global.wss.clients.forEach(client => {
      if (client.readyState === 1) {
        client.send(JSON.stringify({
          type: 'vonage_event',
          data: event
        }));
      }
    });
  }
  
  res.status(204).send();
});

app.post('/webhooks/dtmf', (req, res) => {
  const { dtmf, call_uuid } = req.body;
  console.log(`🔢 DTMF received: ${dtmf} for call ${call_uuid}`);
  
  if (global.wss) {
    global.wss.clients.forEach(client => {
      if (client.readyState === 1) {
        client.send(JSON.stringify({
          type: 'dtmf',
          data: { dtmf, call_uuid, timestamp: new Date().toISOString() }
        }));
      }
    });
  }
  
  res.status(204).send();
});

app.post('/webhooks/recording', (req, res) => {
  const recording = req.body;
  console.log('🎙️ Recording available:', recording);
  
  if (global.wss) {
    global.wss.clients.forEach(client => {
      if (client.readyState === 1) {
        client.send(JSON.stringify({
          type: 'recording',
          data: recording
        }));
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
║  🚀 Vonage Call System Server Running                    ║
║  📡 Port: ${PORT}                                        ║
║  🌐 Base URL: ${process.env.BASE_URL || 'http://localhost:8080'}
║  🔐 Login: admin / admin                                 ║
╚══════════════════════════════════════════════════════════╝
  `);
});

setupWebSocket(server);

process.on('SIGTERM', () => {
  console.log('👋 SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});
SERVERJS

echo "✅ server.js created"

echo "📝 Creating backend/routes/auth.js..."
cat > backend/routes/auth.js << 'AUTHJS'
const express = require('express');
const jwt = require('jsonwebtoken');
const { db } = require('../database');

const router = express.Router();

router.post('/login', (req, res) => {
  const { username, password } = req.body;

  try {
    const user = db.prepare('SELECT * FROM users WHERE username = ? AND password = ?').get(username, password);

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username },
      process.env.JWT_SECRET || 'default-secret-change-me',
      { expiresIn: '24h' }
    );

    res.json({ token, username: user.username });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

function verifyToken(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(403).json({ error: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default-secret-change-me');
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

module.exports = router;
module.exports.verifyToken = verifyToken;
AUTHJS

echo "✅ auth.js created"

echo "📝 Creating backend/routes/scripts.js..."
cat > backend/routes/scripts.js << 'SCRIPTSJS'
const express = require('express');
const { db } = require('../database');
const { verifyToken } = require('./auth');

const router = express.Router();

router.get('/', verifyToken, (req, res) => {
  try {
    const scripts = db.prepare('SELECT * FROM scripts ORDER BY created_at DESC').all();
    res.json(scripts);
  } catch (err) {
    console.error('Get scripts error:', err);
    res.status(500).json({ error: 'Failed to fetch scripts' });
  }
});

router.post('/', verifyToken, (req, res) => {
  const { name, content, language } = req.body;

  try {
    const insert = db.prepare('INSERT INTO scripts (name, content, language) VALUES (?, ?, ?)');
    const result = insert.run(name, content, language || 'en-US');

    res.json({ success: true, id: result.lastInsertRowid });
  } catch (err) {
    console.error('Save script error:', err);
    res.status(500).json({ error: 'Failed to save script' });
  }
});

router.delete('/:id', verifyToken, (req, res) => {
  try {
    db.prepare('DELETE FROM scripts WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    console.error('Delete script error:', err);
    res.status(500).json({ error: 'Failed to delete script' });
  }
});

module.exports = router;
SCRIPTSJS

echo "✅ scripts.js created"

echo ""
echo "⚠️  Creating backend/routes/calls.js (this is a large file)..."
cat > backend/routes/calls.js << 'CALLSJS'
const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { db } = require('../database');
const { verifyToken } = require('./auth');

const router = express.Router();

router.get('/', verifyToken, (req, res) => {
  try {
    const calls = db.prepare(`
      SELECT c.*, s.name as script_name 
      FROM calls c 
      LEFT JOIN scripts s ON c.script_id = s.id 
      ORDER BY c.started_at DESC 
      LIMIT 100
    `).all();
    res.json(calls);
  } catch (err) {
    console.error('Get calls error:', err);
    res.status(500).json({ error: 'Failed to fetch calls' });
  }
});

router.get('/:call_uuid', verifyToken, (req, res) => {
  try {
    const call = db.prepare('SELECT * FROM calls WHERE call_uuid = ?').get(req.params.call_uuid);
    const dtmf = db.prepare('SELECT * FROM dtmf_logs WHERE call_uuid = ? ORDER BY timestamp').all(req.params.call_uuid);
    const events = db.prepare('SELECT * FROM call_events WHERE call_uuid = ? ORDER BY timestamp').all(req.params.call_uuid);

    res.json({ call, dtmf, events });
  } catch (err) {
    console.error('Get call details error:', err);
    res.status(500).json({ error: 'Failed to fetch call details' });
  }
});

router.post('/initiate', verifyToken, async (req, res) => {
  const { phone_number, language, script_id, custom_script, recording_enabled } = req.body;

  try {
    const vonage = req.app.locals.vonage;
    const call_uuid = uuidv4();

    let scriptContent = custom_script;
    if (script_id && !custom_script) {
      const script = db.prepare('SELECT content FROM scripts WHERE id = ?').get(script_id);
      scriptContent = script?.content || 'Hello, this is a test call.';
    }

    const voiceName = language === 'es-ES' ? 'Lucia' : 'Amy';

    const ncco = [
      {
        action: 'talk',
        text: scriptContent,
        voiceName: voiceName,
        language: language
      },
      {
        action: 'input',
        eventUrl: [`${process.env.BASE_URL}/webhooks/dtmf`],
        dtmf: {
          maxDigits: 1,
          timeOut: 10
        }
      }
    ];

    if (recording_enabled) {
      ncco.push({
        action: 'record',
        eventUrl: [`${process.env.BASE_URL}/webhooks/recording`],
        endOnSilence: 3,
        format: 'mp3'
      });
    }

    const result = await vonage.voice.createOutboundCall({
      to: [{
        type: 'phone',
        number: phone_number
      }],
      from: {
        type: 'phone',
        number: process.env.VONAGE_PHONE_NUMBER
      },
      ncco: ncco,
      event_url: [`${process.env.BASE_URL}/webhooks/event`]
    });

    const insert = db.prepare(`
      INSERT INTO calls (call_uuid, phone_number, language, script_id, custom_script, recording_enabled, status)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    insert.run(result.uuid, phone_number, language, script_id, custom_script, recording_enabled ? 1 : 0, 'ringing');

    const logEvent = db.prepare('INSERT INTO call_events (call_uuid, event_type, event_data) VALUES (?, ?, ?)');
    logEvent.run(result.uuid, 'initiated', JSON.stringify(result));

    res.json({ success: true, call_uuid: result.uuid, vonage_response: result });
  } catch (err) {
    console.error('Call initiation error:', err);
    res.status(500).json({ error: err.message || 'Failed to initiate call' });
  }
});

router.post('/:call_uuid/record', verifyToken, async (req, res) => {
  try {
    const vonage = req.app.locals.vonage;
    await vonage.voice.streamAudio(req.params.call_uuid, {
      stream_url: [`${process.env.BASE_URL}/webhooks/recording`],
      loop: 0
    });

    db.prepare('UPDATE calls SET recording_enabled = 1 WHERE call_uuid = ?').run(req.params.call_uuid);

    res.json({ success: true });
  } catch (err) {
    console.error('Recording start error:', err);
    res.status(500).json({ error: 'Failed to start recording' });
  }
});

router.post('/:call_uuid/escalate', verifyToken, async (req, res) => {
  try {
    const vonage = req.app.locals.vonage;
    
    await vonage.voice.transferCall(req.params.call_uuid, {
      action: 'transfer',
      destination: {
        type: 'ncco',
        ncco: [{
          action: 'connect',
          endpoint: [{
            type: 'phone',
            number: process.env.ADMIN_PHONE
          }]
        }]
      }
    });

    const logEvent = db.prepare('INSERT INTO call_events (call_uuid, event_type, event_data) VALUES (?, ?, ?)');
    logEvent.run(req.params.call_uuid, 'escalated', JSON.stringify({ to: process.env.ADMIN_PHONE }));

    res.json({ success: true });
  } catch (err) {
    console.error('Escalation error:', err);
    res.status(500).json({ error: 'Failed to escalate call' });
  }
});

router.post('/:call_uuid/hangup', verifyToken, async (req, res) => {
  try {
    const vonage = req.app.locals.vonage;
    await vonage.voice.hangupCall(req.params.call_uuid);

    db.prepare('UPDATE calls SET status = ?, ended_at = CURRENT_TIMESTAMP WHERE call_uuid = ?')
      .run('completed', req.params.call_uuid);

    res.json({ success: true });
  } catch (err) {
    console.error('Hangup error:', err);
    res.status(500).json({ error: 'Failed to hang up call' });
  }
});

router.get('/analytics/stats', verifyToken, (req, res) => {
  try {
    const total = db.prepare('SELECT COUNT(*) as count FROM calls').get().count;
    const completed = db.prepare('SELECT COUNT(*) as count FROM calls WHERE status = ?').get('completed').count;
    const failed = db.prepare('SELECT COUNT(*) as count FROM calls WHERE status = ?').get('failed').count;
    const avgDuration = db.prepare('SELECT AVG(duration) as avg FROM calls WHERE duration IS NOT NULL').get().avg;

    res.json({
      total_calls: total,
      completed_calls: completed,
      failed_calls: failed,
      average_duration: Math.round(avgDuration || 0),
      success_rate: total > 0 ? ((completed / total) * 100).toFixed(1) : 0
    });
  } catch (err) {
    console.error('Analytics error:', err);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

module.exports = router;
CALLSJS

echo "✅ calls.js created"
echo ""
echo "✅ ALL BACKEND FILES CREATED!"
echo ""
echo "Now creating frontend files..."
echo ""
