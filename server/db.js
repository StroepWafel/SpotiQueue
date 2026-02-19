const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const dbPath = process.env.DB_PATH || path.join(__dirname, '../data/queue.db');
const dbDir = path.dirname(dbPath);

let db = null;

// Ensure data directory exists
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

async function initDatabase() {
  const SQL = await initSqlJs();
  
  // Load existing database or create new one
  let data;
  if (fs.existsSync(dbPath)) {
    data = fs.readFileSync(dbPath);
  }
  
  db = new SQL.Database(data);
  
  // Create tables
  db.run(`
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
  
  // Try to add username column if it doesn't exist (ignore errors)
  try {
    db.run(`ALTER TABLE fingerprints ADD COLUMN username TEXT`);
  } catch (err) {
    // Column already exists, ignore
  }

  // Try to add github columns if they don't exist
  try {
    db.run(`ALTER TABLE fingerprints ADD COLUMN github_id TEXT`);
  } catch (err) {}
  try {
    db.run(`ALTER TABLE fingerprints ADD COLUMN github_username TEXT`);
  } catch (err) {}

  // Try to add approved_by column to prequeue
  try {
    db.run(`ALTER TABLE prequeue ADD COLUMN approved_by TEXT`);
  } catch (err) {}

  db.run(`
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

  db.run(`
    CREATE TABLE IF NOT EXISTS banned_tracks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      track_id TEXT UNIQUE NOT NULL,
      artist_id TEXT,
      reason TEXT,
      created_at INTEGER DEFAULT (strftime('%s', 'now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS prequeue (
      id TEXT PRIMARY KEY,
      fingerprint_id TEXT NOT NULL,
      track_id TEXT NOT NULL,
      track_name TEXT NOT NULL,
      artist_name TEXT NOT NULL,
      album_art TEXT,
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'declined')),
      approved_by TEXT,
      created_at INTEGER DEFAULT (strftime('%s', 'now')),
      FOREIGN KEY (fingerprint_id) REFERENCES fingerprints(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS votes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      track_id TEXT NOT NULL,
      fingerprint_id TEXT NOT NULL,
      created_at INTEGER DEFAULT (strftime('%s', 'now')),
      UNIQUE(track_id, fingerprint_id)
    )
  `);

  // Try to add approved_by column if it doesn't exist
  try {
    db.run(`ALTER TABLE prequeue ADD COLUMN approved_by TEXT`);
  } catch (err) {
    // Column already exists, ignore
  }

  // Try to add github_id column to fingerprints if it doesn't exist
  try {
    db.run(`ALTER TABLE fingerprints ADD COLUMN github_id TEXT`);
  } catch (err) {
    // Column already exists, ignore
  }

  // Try to add github_avatar column to fingerprints if it doesn't exist
  try {
    db.run(`ALTER TABLE fingerprints ADD COLUMN github_avatar TEXT`);
  } catch (err) {
    // Column already exists, ignore
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at INTEGER DEFAULT (strftime('%s', 'now'))
    )
  `);

  // Initialize default config
  const defaultConfig = [
    { key: 'cooldown_duration', value: '300' },
    { key: 'songs_before_cooldown', value: '1' },
    { key: 'fingerprinting_enabled', value: 'true' },
    { key: 'url_input_enabled', value: 'true' },
    { key: 'search_ui_enabled', value: 'true' },
    { key: 'queueing_enabled', value: 'true' },
    { key: 'prequeue_enabled', value: 'false' },
    { key: 'admin_panel_url', value: '' },
    { key: 'admin_password', value: 'admin' },
    { key: 'user_password', value: '' },
    { key: 'require_username', value: 'false' },
    { key: 'max_song_duration', value: '0' },
    { key: 'ban_explicit', value: 'false' },
    { key: 'voting_enabled', value: 'false' },
    { key: 'aura_enabled', value: 'true' },
    { key: 'confetti_enabled', value: 'true' }
  ];

  defaultConfig.forEach(config => {
    try {
      db.run(
        'INSERT OR IGNORE INTO config (key, value) VALUES (?, ?)',
        [config.key, config.value]
      );
    } catch (err) {
      // Ignore duplicate key errors
    }
  });

  saveDatabase();
  console.log('Database initialized');
}

function saveDatabase() {
  if (db) {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(dbPath, buffer);
  }
}

function getDb() {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  
  return {
    prepare: (sql) => ({
      run: (...params) => {
        try {
          db.run(sql, params);
          saveDatabase();
          return { changes: db.getRowsModified() };
        } catch (err) {
          throw err;
        }
      },
      get: (...params) => {
        try {
          const stmt = db.prepare(sql);
          stmt.bind(params);
          if (stmt.step()) {
            const row = stmt.getAsObject();
            stmt.free();
            return row;
          }
          stmt.free();
          return undefined;
        } catch (err) {
          throw err;
        }
      },
      all: (...params) => {
        try {
          const stmt = db.prepare(sql);
          stmt.bind(params);
          const rows = [];
          while (stmt.step()) {
            rows.push(stmt.getAsObject());
          }
          stmt.free();
          return rows;
        } catch (err) {
          throw err;
        }
      }
    })
  };
}

module.exports = { initDatabase, getDb };
