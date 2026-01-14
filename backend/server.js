const express = require('express');
const cors = require('cors');
require('dotenv').config();
const Database = require('better-sqlite3');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// Database update on startup
const dbPath = path.join(__dirname, 'calls.db');
const db = new Database(dbPath);

try {
  const tableInfo = db.prepare("PRAGMA table_info(calls)").all();
  const hasCallState = tableInfo.some(col => col.name === 'call_state');
  
  if (!hasCallState) {
    console.log('Adding call_state column to calls table...');
    db.prepare('ALTER TABLE calls ADD COLUMN call_state TEXT').run();
    console.log('✅ Database updated successfully');
  }
} catch (err) {
  console.error('Database update error:', err);
}

db.close();

// Load routes
const advancedCalls = require('./routes/advanced-calls');

/**
 * ROUTES
 */
app.use('/api/advanced-calls', advancedCalls);

/**
 * Health check
 */
app.get('/health', (req, res) => {
  res.json({ ok: true });
});

/**
 * REQUIRED BY VONAGE — MUST RETURN 204
 */
app.post('/webhooks/event', (req, res) => {
  res.status(204).end();
});

/**
 * START SERVER
 * Fly.io requires listening on 0.0.0.0:8080
 */
const PORT = process.env.PORT || 8080;
const HOST = '0.0.0.0';

app.listen(PORT, HOST, () => {
  console.log(`✅ Server running on ${HOST}:${PORT}`);
});
