const express = require('express');
const crypto = require('crypto');
const { getDb } = require('../db');
const { getConfig } = require('../utils/config');

const router = express.Router();

// Generate or retrieve fingerprint
router.post('/generate', (req, res) => {
  const db = getDb();
  const fingerprintId = req.cookies.fingerprint_id || crypto.randomBytes(16).toString('hex');
  const username = req.body.username || null;
  const requireUsername = getConfig('require_username') === 'true';
  
  // Check if fingerprint exists
  const existing = db.prepare('SELECT * FROM fingerprints WHERE id = ?').get(fingerprintId);
  
  if (!existing) {
    // Create new fingerprint
    const now = Math.floor(Date.now() / 1000);
    
    // If username is required but not provided, return error
    if (requireUsername && !username) {
      return res.status(400).json({ 
        error: 'Username is required',
        requires_username: true 
      });
    }
    
    db.prepare(`
      INSERT INTO fingerprints (id, first_seen, last_queue_attempt, cooldown_expires, status, username)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(fingerprintId, now, null, null, 'active', username);
  } else {
    // Update username if provided and not already set
    if (username && !existing.username) {
      db.prepare('UPDATE fingerprints SET username = ? WHERE id = ?').run(username, fingerprintId);
    }
    
    // If username is required but not set, return error
    if (requireUsername && !existing.username && !username) {
      return res.status(400).json({ 
        error: 'Username is required',
        requires_username: true 
      });
    }
  }
  
  res.cookie('fingerprint_id', fingerprintId, {
    httpOnly: true,
    maxAge: 365 * 24 * 60 * 60 * 1000, // 1 year
    sameSite: 'lax'
  });
  
  const fingerprint = db.prepare('SELECT * FROM fingerprints WHERE id = ?').get(fingerprintId);
  res.json({ 
    fingerprint_id: fingerprintId,
    username: fingerprint.username,
    requires_username: requireUsername && !fingerprint.username
  });
});

// Validate fingerprint
router.post('/validate', (req, res) => {
  const db = getDb();
  const fingerprintId = req.body.fingerprint_id || req.cookies.fingerprint_id;
  const requireUsername = getConfig('require_username') === 'true';
  
  if (!fingerprintId) {
    return res.status(400).json({ error: 'No fingerprint provided' });
  }
  
  const fingerprint = db.prepare('SELECT * FROM fingerprints WHERE id = ?').get(fingerprintId);
  
  if (!fingerprint) {
    return res.status(400).json({ error: 'Invalid fingerprint' });
  }
  
  // Check if username is required but not set
  if (requireUsername && !fingerprint.username) {
    return res.status(400).json({ 
      error: 'Username is required',
      requires_username: true 
    });
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

