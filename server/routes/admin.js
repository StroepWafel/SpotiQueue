const express = require('express');
const basicAuth = require('express-basic-auth');
const { getDb } = require('../db');
const { getConfig } = require('../utils/config');

const router = express.Router();

// Basic auth middleware (dynamic password)
const authMiddleware = (req, res, next) => {
  const password = getConfig('admin_password') || 'admin';
  const auth = basicAuth({
    users: { admin: password },
    challenge: true,
    realm: 'Admin Area'
  });
  return auth(req, res, next);
};

// Apply auth to all admin routes
router.use(authMiddleware);

// Get all devices (fingerprints)
router.get('/devices', (req, res) => {
  const db = getDb();
  const { status, sort = 'last_queue_attempt' } = req.query;
  
  let query = 'SELECT * FROM fingerprints';
  const params = [];
  
  if (status) {
    query += ' WHERE status = ?';
    params.push(status);
  }
  
  query += ` ORDER BY ${sort} DESC LIMIT 100`;
  
  const devices = db.prepare(query).all(...params);
  
  const now = Math.floor(Date.now() / 1000);
  const cooldownDuration = parseInt(getConfig('cooldown_duration') || '300');
  
  const devicesWithStatus = devices.map(device => {
    const isCoolingDown = device.cooldown_expires && device.cooldown_expires > now;
    const cooldownRemaining = isCoolingDown ? device.cooldown_expires - now : 0;
    
    return {
      ...device,
      is_cooling_down: isCoolingDown,
      cooldown_remaining: cooldownRemaining,
      display_id: device.id.substring(0, 8) + '...' // Shortened for display
    };
  });
  
  // Sort devices to show those with usernames first if sorting by last_queue_attempt
  if (sort === 'last_queue_attempt') {
    devicesWithStatus.sort((a, b) => {
      // Devices with usernames first
      if (a.username && !b.username) return -1;
      if (!a.username && b.username) return 1;
      // Then by last_queue_attempt
      return (b.last_queue_attempt || 0) - (a.last_queue_attempt || 0);
    });
  }
  
  res.json({ devices: devicesWithStatus });
});

// Get device details
router.get('/devices/:id', (req, res) => {
  const db = getDb();
  const { id } = req.params;
  const { limit = '100' } = req.query;
  const limitNum = parseInt(limit, 10);
  
  const device = db.prepare('SELECT * FROM fingerprints WHERE id = ?').get(id);
  if (!device) {
    return res.status(404).json({ error: 'Device not found' });
  }
  
  const attempts = db.prepare(`
    SELECT * FROM queue_attempts
    WHERE fingerprint_id = ?
    ORDER BY timestamp DESC
    LIMIT ?
  `).all(id, limitNum);
  
  const totalAttempts = db.prepare(`
    SELECT COUNT(*) as count FROM queue_attempts WHERE fingerprint_id = ?
  `).get(id).count;
  
  res.json({ device, attempts, total_attempts: totalAttempts });
});

// Reset cooldown for a device
router.post('/devices/:id/reset-cooldown', (req, res) => {
  const db = getDb();
  const { id } = req.params;
  
  const device = db.prepare('SELECT * FROM fingerprints WHERE id = ?').get(id);
  if (!device) {
    return res.status(404).json({ error: 'Device not found' });
  }
  
  db.prepare('UPDATE fingerprints SET cooldown_expires = NULL WHERE id = ?').run(id);
  
  res.json({ success: true, message: 'Cooldown reset' });
});

// Block a device
router.post('/devices/:id/block', (req, res) => {
  const db = getDb();
  const { id } = req.params;
  
  const device = db.prepare('SELECT * FROM fingerprints WHERE id = ?').get(id);
  if (!device) {
    return res.status(404).json({ error: 'Device not found' });
  }
  
  db.prepare('UPDATE fingerprints SET status = ? WHERE id = ?').run('blocked', id);
  
  res.json({ success: true, message: 'Device blocked' });
});

// Unblock a device
router.post('/devices/:id/unblock', (req, res) => {
  const db = getDb();
  const { id } = req.params;
  
  const device = db.prepare('SELECT * FROM fingerprints WHERE id = ?').get(id);
  if (!device) {
    return res.status(404).json({ error: 'Device not found' });
  }
  
  db.prepare('UPDATE fingerprints SET status = ? WHERE id = ?').run('active', id);
  
  res.json({ success: true, message: 'Device unblocked' });
});

// Reset all cooldowns
router.post('/devices/reset-all-cooldowns', (req, res) => {
  const db = getDb();
  db.prepare('UPDATE fingerprints SET cooldown_expires = NULL').run();
  
  res.json({ success: true, message: 'All cooldowns reset' });
});

// Get banned tracks
router.get('/banned-tracks', (req, res) => {
  const db = getDb();
  const tracks = db.prepare('SELECT * FROM banned_tracks ORDER BY created_at DESC').all();
  res.json({ tracks });
});

// Add banned track
router.post('/banned-tracks', (req, res) => {
  const db = getDb();
  const { track_id, artist_id, reason } = req.body;
  
  if (!track_id) {
    return res.status(400).json({ error: 'Track ID required' });
  }
  
  try {
    db.prepare(`
      INSERT INTO banned_tracks (track_id, artist_id, reason)
      VALUES (?, ?, ?)
    `).run(track_id, artist_id || null, reason || null);
    
    res.json({ success: true, message: 'Track banned' });
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(400).json({ error: 'Track already banned' });
    }
    throw error;
  }
});

// Remove banned track
router.delete('/banned-tracks/:trackId', (req, res) => {
  const db = getDb();
  const { trackId } = req.params;
  
  const result = db.prepare('DELETE FROM banned_tracks WHERE track_id = ?').run(trackId);
  
  if (result.changes === 0) {
    return res.status(404).json({ error: 'Banned track not found' });
  }
  
  res.json({ success: true, message: 'Track unbanned' });
});

// Get queue statistics
router.get('/stats', (req, res) => {
  const db = getDb();
  const totalDevices = db.prepare('SELECT COUNT(*) as count FROM fingerprints').get().count;
  const activeDevices = db.prepare("SELECT COUNT(*) as count FROM fingerprints WHERE status = 'active'").get().count;
  const blockedDevices = db.prepare("SELECT COUNT(*) as count FROM fingerprints WHERE status = 'blocked'").get().count;
  
  const now = Math.floor(Date.now() / 1000);
  const coolingDown = db.prepare('SELECT COUNT(*) as count FROM fingerprints WHERE cooldown_expires > ?').get(now).count;
  
  const totalAttempts = db.prepare('SELECT COUNT(*) as count FROM queue_attempts').get().count;
  const successfulAttempts = db.prepare("SELECT COUNT(*) as count FROM queue_attempts WHERE status = 'success'").get().count;
  
  res.json({
    devices: {
      total: totalDevices,
      active: activeDevices,
      blocked: blockedDevices,
      cooling_down: coolingDown
    },
    queue_attempts: {
      total: totalAttempts,
      successful: successfulAttempts
    }
  });
});

// Reset all data (devices, stats, banned tracks - but NOT config)
router.post('/reset-all-data', (req, res) => {
  const db = getDb();
  try {
    // Use a transaction to ensure all deletions succeed or fail together
    const resetData = db.transaction(() => {
      // Delete queue attempts first (has foreign key to fingerprints)
      db.prepare('DELETE FROM queue_attempts').run();
      
      // Then delete fingerprints (devices)
      db.prepare('DELETE FROM fingerprints').run();
      
      // Delete banned tracks (no dependencies)
      db.prepare('DELETE FROM banned_tracks').run();
    });
    
    resetData();
    
    res.json({ 
      success: true, 
      message: 'All data has been reset. Devices, stats, and banned tracks have been cleared.' 
    });
  } catch (error) {
    console.error('Error resetting data:', error);
    res.status(500).json({ error: `Failed to reset data: ${error.message}` });
  }
});

module.exports = router;

