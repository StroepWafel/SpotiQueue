const express = require('express');
const { getDb } = require('../db');
const { getConfig } = require('../utils/config');
const { searchTracks, getTrack, parseSpotifyUrl, addToQueue } = require('../utils/spotify');

const router = express.Router();
const db = getDb();

// Search tracks
router.post('/search', async (req, res) => {
  try {
    // Check if queueing is enabled (search is only useful when queueing is enabled)
    const queueingEnabled = getConfig('queueing_enabled');
    if (queueingEnabled === 'false') {
      return res.status(503).json({ error: 'Queueing is currently disabled.' });
    }
    
    const { query } = req.body;
    
    if (!query || query.trim().length === 0) {
      return res.status(400).json({ error: 'Search query required' });
    }
    
    let tracks = await searchTracks(query, 10);
    
    // Filter out explicit tracks if ban_explicit is enabled
    const banExplicit = getConfig('ban_explicit') === 'true';
    if (banExplicit) {
      tracks = tracks.filter(track => !track.explicit);
    }
    
    res.json({ tracks });
  } catch (error) {
    console.error('Search error:', error);
    const statusCode = error.message.includes('authentication') ? 401 : 500;
    res.status(statusCode).json({ error: error.message || 'Failed to search tracks' });
  }
});

// Queue a track
router.post('/add', async (req, res) => {
  // Check if queueing is enabled
  const queueingEnabled = getConfig('queueing_enabled');
  if (queueingEnabled === 'false') {
    return res.status(503).json({ error: 'Queueing is currently disabled.' });
  }
  
  const fingerprintId = req.body.fingerprint_id || req.cookies.fingerprint_id;
  
  // Validate fingerprint
  if (!fingerprintId) {
    return res.status(400).json({ error: 'Could not fingerprint your device.' });
  }
  
  const fingerprint = db.prepare('SELECT * FROM fingerprints WHERE id = ?').get(fingerprintId);
  
  if (!fingerprint) {
    return res.status(400).json({ error: 'Could not fingerprint your device.' });
  }
  
  if (fingerprint.status === 'blocked') {
    const now = Math.floor(Date.now() / 1000);
    db.prepare(`
      INSERT INTO queue_attempts (fingerprint_id, status, error_message, timestamp)
      VALUES (?, ?, ?, ?)
    `).run(fingerprintId, 'blocked', 'Device blocked', now);
    
    return res.status(403).json({ error: 'This device is blocked from queueing songs.' });
  }
  
  // Check cooldown
  const cooldownEnabled = getConfig('fingerprinting_enabled') === 'true';
  const now = Math.floor(Date.now() / 1000);
  
  if (cooldownEnabled && fingerprint.cooldown_expires && fingerprint.cooldown_expires > now) {
    const remaining = fingerprint.cooldown_expires - now;
    db.prepare(`
      INSERT INTO queue_attempts (fingerprint_id, status, error_message, timestamp)
      VALUES (?, ?, ?, ?)
    `).run(fingerprintId, 'rate_limited', 'Cooldown active', now);
    
    return res.status(429).json({ 
      error: 'Please wait before queueing another song!',
      cooldown_remaining: remaining
    });
  }
  
  // Get track info
  let trackId = req.body.track_id;
  let trackInfo = null;
  
  // Handle URL input
  if (!trackId && req.body.track_url) {
    trackId = parseSpotifyUrl(req.body.track_url);
    if (!trackId) {
      return res.status(400).json({ 
        error: 'Invalid Spotify URL. Use format: https://open.spotify.com/track/TRACK_ID or spotify:track:TRACK_ID' 
      });
    }
  }
  
  if (!trackId) {
    return res.status(400).json({ error: 'Track ID or URL required' });
  }
  
  // Check if track is banned
  const banned = db.prepare('SELECT * FROM banned_tracks WHERE track_id = ?').get(trackId);
  if (banned) {
    db.prepare(`
      INSERT INTO queue_attempts (fingerprint_id, track_id, status, error_message, timestamp)
      VALUES (?, ?, ?, ?, ?)
    `).run(fingerprintId, trackId, 'banned', 'Track banned', now);
    
    return res.status(403).json({ error: 'This song is not allowed.' });
  }
  
  try {
    // Get track info
    trackInfo = await getTrack(trackId);
    
    // Check if explicit songs are banned
    const banExplicit = getConfig('ban_explicit') === 'true';
    if (banExplicit && trackInfo.explicit) {
      db.prepare(`
        INSERT INTO queue_attempts (fingerprint_id, track_id, track_name, artist_name, status, error_message, timestamp)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(fingerprintId, trackId, trackInfo.name, trackInfo.artists, 'blocked', 'Explicit content not allowed', now);
      
      return res.status(403).json({ error: 'Explicit songs are not allowed.' });
    }
    
    // Add to Spotify queue
    await addToQueue(trackInfo.uri);
    
    // Update fingerprint cooldown
    const cooldownDuration = parseInt(getConfig('cooldown_duration') || '300');
    const cooldownExpires = now + cooldownDuration;
    
    db.prepare(`
      UPDATE fingerprints
      SET last_queue_attempt = ?, cooldown_expires = ?
      WHERE id = ?
    `).run(now, cooldownExpires, fingerprintId);
    
    // Log successful queue
    db.prepare(`
      INSERT INTO queue_attempts (fingerprint_id, track_id, track_name, artist_name, status, timestamp)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(fingerprintId, trackId, trackInfo.name, trackInfo.artists, 'success', now);
    
    res.json({
      success: true,
      message: `Queued: ${trackInfo.name} — ${trackInfo.artists}`,
      track: trackInfo
    });
  } catch (error) {
    console.error('Queue error:', error);
    
    // Log failed queue
    db.prepare(`
      INSERT INTO queue_attempts (fingerprint_id, track_id, status, error_message, timestamp)
      VALUES (?, ?, ?, ?, ?)
    `).run(fingerprintId, trackId, 'error', error.message, now);
    
    res.status(500).json({ error: error.message || 'Failed to queue track' });
  }
});

module.exports = router;

