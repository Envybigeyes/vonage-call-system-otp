const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'vonage.db');
const db = new Database(dbPath);

// Add ttl column if it doesn't exist
try {
  db.exec(`ALTER TABLE dtmf_logs ADD COLUMN expires_at DATETIME`);
  console.log('✅ Added expires_at column to dtmf_logs');
} catch (err) {
  console.log('Column already exists or error:', err.message);
}

// Create cleanup function
function cleanupExpiredDTMF() {
  const deleted = db.prepare('DELETE FROM dtmf_logs WHERE expires_at < datetime("now")').run();
  if (deleted.changes > 0) {
    console.log(`🗑️ Cleaned up ${deleted.changes} expired DTMF logs`);
  }
}

// Run cleanup every minute
setInterval(cleanupExpiredDTMF, 60000);

module.exports = { cleanupExpiredDTMF };
