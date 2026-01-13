const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'calls.db');
const db = new Database(dbPath);

try {
  // Check if call_state column exists
  const tableInfo = db.prepare("PRAGMA table_info(calls)").all();
  const hasCallState = tableInfo.some(col => col.name === 'call_state');
  
  if (!hasCallState) {
    console.log('Adding call_state column to calls table...');
    db.prepare('ALTER TABLE calls ADD COLUMN call_state TEXT').run();
    console.log('✅ Database updated successfully');
  } else {
    console.log('✅ Database already has call_state column');
  }
} catch (err) {
  console.error('Database update error:', err);
}

db.close();
