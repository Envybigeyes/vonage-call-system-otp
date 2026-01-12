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
    CREATE TABLE IF NOT EXISTS reactive_scripts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      script_flow TEXT NOT NULL,
      language TEXT DEFAULT 'en-US',
      voice TEXT DEFAULT 'aura-asteria-en',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
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
      recording_url TEXT,
      caller_id TEXT,
      voice_model TEXT DEFAULT 'aura-asteria-en',
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

  db.exec(`
    CREATE TABLE IF NOT EXISTS webhook_retry_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      webhook_type TEXT NOT NULL,
      payload TEXT NOT NULL,
      url TEXT NOT NULL,
      retry_count INTEGER DEFAULT 0,
      max_retries INTEGER DEFAULT 3,
      next_retry DATETIME,
      status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
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
