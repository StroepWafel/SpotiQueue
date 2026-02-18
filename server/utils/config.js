const { getDb } = require('../db');

function getConfig(key) {
  const db = getDb();
  const row = db.prepare('SELECT value FROM config WHERE key = ?').get(key);
  return row ? row.value : null;
}

function setConfig(key, value) {
  const db = getDb();
  const now = Math.floor(Date.now() / 1000);
  db.prepare(`
    INSERT INTO config (key, value, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = ?
  `).run(key, value, now, value, now);
  return true;
}

function getAllConfig() {
  const db = getDb();
  const rows = db.prepare('SELECT key, value FROM config').all();
  const config = {};
  rows.forEach(row => {
    config[row.key] = row.value;
  });
  return config;
}

module.exports = { getConfig, setConfig, getAllConfig };

