const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = process.env.DB_PATH || path.join(__dirname, '../data/queue.db');
const dbDir = path.dirname(dbPath);

// Ensure data directory exists
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(dbPath);

function initDatabase() {
  // Fingerprints table
  db.exec(`
    CREATE TABLE IF NOT EXISTS fingerprints (
      id TEXT PRIMARY KEY,
      first_seen INTEGER NOT NULL,
      last_queue_attempt INTEGER,
      cooldown_expires INTEGER,
      status TEXT DEFAULT 'active' CHECK(status IN ('active', 'blocked')),
      username TEXT,
      created_at INTEGER DEFAULT (strftime('%s', 'now'))
    )
  `);
  
  // Add username column to existing fingerprints table if it doesn't exist
  try {
    db.exec(`ALTER TABLE fingerprints ADD COLUMN username TEXT`);
  } catch (error) {
    // Column already exists, ignore error
    if (!error.message.includes('duplicate column')) {
      console.warn('Warning adding username column:', error.message);
    }
  }

  // Queue attempts log
  db.exec(`
    CREATE TABLE IF NOT EXISTS queue_attempts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fingerprint_id TEXT NOT NULL,
      track_id TEXT,
      track_name TEXT,
      artist_name TEXT,
      status TEXT NOT NULL,
      error_message TEXT,
      timestamp INTEGER DEFAULT (strftime('%s', 'now')),
      FOREIGN KEY (fingerprint_id) REFERENCES fingerprints(id)
    )
  `);

  // Banned tracks
  db.exec(`
    CREATE TABLE IF NOT EXISTS banned_tracks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      track_id TEXT UNIQUE NOT NULL,
      artist_id TEXT,
      reason TEXT,
      created_at INTEGER DEFAULT (strftime('%s', 'now'))
    )
  `);

  // Configuration
  db.exec(`
    CREATE TABLE IF NOT EXISTS config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at INTEGER DEFAULT (strftime('%s', 'now'))
    )
  `);

  // Initialize default config
  const defaultConfig = [
    { key: 'cooldown_duration', value: '300' }, // 5 minutes in seconds
    { key: 'songs_before_cooldown', value: '1' }, // Number of songs allowed before cooldown starts
    { key: 'fingerprinting_enabled', value: 'true' },
    { key: 'url_input_enabled', value: 'true' },
    { key: 'search_ui_enabled', value: 'true' },
    { key: 'queueing_enabled', value: 'true' },
    { key: 'admin_panel_url', value: '' }, // Empty by default, will use placeholder if not configured
    { key: 'admin_password', value: 'admin' },
    { key: 'require_username', value: 'false' } // Require username on first visit
  ];

  const stmt = db.prepare('INSERT OR IGNORE INTO config (key, value) VALUES (?, ?)');
  const insertMany = db.transaction((configs) => {
    for (const config of configs) {
      stmt.run(config.key, config.value);
    }
  });
  insertMany(defaultConfig);

  console.log('Database initialized');
}

function getDb() {
  return db;
}

module.exports = { initDatabase, getDb };

