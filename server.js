const express = require('express');
const cors = require('cors');
require('dotenv').config();
const advancedCalls = require('./routes/advanced-calls');

const app = express();
app.use(cors());
app.use(express.json());

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
