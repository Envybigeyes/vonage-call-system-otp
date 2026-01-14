const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { db, initDatabase } = require('./database');

const app = express();
app.use(cors());
app.use(express.json());

// Initialize database tables first
initDatabase();

// Then add call_state column if it doesn't exist
try {
  const tableInfo = db.prepare("PRAGMA table_info(calls)").all();
  const hasCallState = tableInfo.some(col => col.name === 'call_state');
  
  if (!hasCallState) {
    console.log('Adding call_state column to calls table...');
    db.prepare('ALTER TABLE calls ADD COLUMN call_state TEXT').run();
    console.log('✅ call_state column added successfully');
  }
} catch (err) {
  console.error('Database update error:', err);
}

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
