const express = require('express');
const crypto = require('crypto');
const { getDb } = require('../db');
const { getConfig } = require('../utils/config');

const router = express.Router();
const db = getDb();

// Generate or retrieve fingerprint
router.post('/generate', (req, res) => {
  const fingerprintId = req.cookies.fingerprint_id || crypto.randomBytes(16).toString('hex');
  
  // Check if fingerprint exists
  const existing = db.prepare('SELECT * FROM fingerprints WHERE id = ?').get(fingerprintId);
  
  if (!existing) {
    // Create new fingerprint
    const now = Math.floor(Date.now() / 1000);
    db.prepare(`
      INSERT INTO fingerprints (id, first_seen, last_queue_attempt, cooldown_expires, status)
      VALUES (?, ?, ?, ?, ?)
    `).run(fingerprintId, now, null, null, 'active');
  }
  
  res.cookie('fingerprint_id', fingerprintId, {
    httpOnly: true,
    maxAge: 365 * 24 * 60 * 60 * 1000, // 1 year
    sameSite: 'lax'
  });
  
  res.json({ fingerprint_id: fingerprintId });
});

// Validate fingerprint
router.post('/validate', (req, res) => {
  const fingerprintId = req.body.fingerprint_id || req.cookies.fingerprint_id;
  
  if (!fingerprintId) {
    return res.status(400).json({ error: 'No fingerprint provided' });
  }
  
  const fingerprint = db.prepare('SELECT * FROM fingerprints WHERE id = ?').get(fingerprintId);
  
  if (!fingerprint) {
    return res.status(400).json({ error: 'Invalid fingerprint' });
  }
  
  if (fingerprint.status === 'blocked') {
    return res.status(403).json({ error: 'Device is blocked from queueing songs.' });
  }
  
  const now = Math.floor(Date.now() / 1000);
  const cooldownEnabled = getConfig('fingerprinting_enabled') === 'true';
  
  if (cooldownEnabled && fingerprint.cooldown_expires && fingerprint.cooldown_expires > now) {
    const remaining = fingerprint.cooldown_expires - now;
    return res.status(429).json({ 
      error: 'Please wait before queueing another song!',
      cooldown_remaining: remaining
    });
  }
  
  res.json({ valid: true, fingerprint });
});

module.exports = router;

