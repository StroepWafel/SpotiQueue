const express = require('express');
const { getDb } = require('../db');
const { getConfig } = require('../utils/config');
const { searchTracks, getTrack, parseSpotifyUrl, addToQueue, getQueue } = require('../utils/spotify');
const basicAuth = require('express-basic-auth');

const router = express.Router();

// Server-side cache for queue data
let queueCache = null;
let queueCacheExpiry = 0;
const QUEUE_CACHE_TTL = 30000; // 30 seconds

// User auth middleware (optional, only if user_password is set)
const userAuthMiddleware = (req, res, next) => {
  const userPassword = getConfig('user_password');
  
  // If no password is set, skip auth
  if (!userPassword || userPassword.trim() === '') {
    return next();
  }
  
  const auth = basicAuth({
    users: { user: userPassword },
    challenge: true,
    realm: 'Queue Access'
  });
  return auth(req, res, next);
};

// Get current queue
router.get('/current', userAuthMiddleware, async (req, res) => {
  try {
    const now = Date.now();
    
    // Return cached queue if still valid
    if (queueCache && queueCacheExpiry > now) {
      return res.json(queueCache);
    }
    
    // Fetch fresh queue data
    const queue = await getQueue();
    
    // Cache the result
    queueCache = queue;
    queueCacheExpiry = now + QUEUE_CACHE_TTL;
    
    res.json(queue);
  } catch (error) {
    console.error('Queue error:', error);
    
    // If we have cached data and hit an error, return the cache
    if (queueCache) {
      return res.json(queueCache);
    }
    
    res.status(500).json({ error: error.message || 'Failed to get queue' });
  }
});

// Search tracks
router.post('/search', userAuthMiddleware, async (req, res) => {
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

    // Filter out tracks exceeding duration limit
    const maxDuration = parseInt(getConfig('max_song_duration') || '0');
    if (maxDuration > 0) {
      tracks = tracks.filter(track => track.duration_ms <= maxDuration * 1000);
    }
    
    res.json({ tracks });
  } catch (error) {
    console.error('Search error:', error);
    const statusCode = error.message.includes('authentication') ? 401 : 500;
    res.status(statusCode).json({ error: error.message || 'Failed to search tracks' });
  }
});

// Queue a track
router.post('/add', userAuthMiddleware, async (req, res) => {
  const db = getDb();
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
  
  // Check if username is required but not set
  const requireUsername = getConfig('require_username') === 'true';
  if (requireUsername && !fingerprint.username) {
    return res.status(400).json({ 
      error: 'Username is required. Please refresh the page and enter your username.' 
    });
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
  
  // Check if user has reached the limit of songs before cooldown
  if (cooldownEnabled) {
    const songsBeforeCooldown = parseInt(getConfig('songs_before_cooldown') || '1');
    const cooldownDuration = parseInt(getConfig('cooldown_duration') || '300');
    const cooldownWindowStart = now - cooldownDuration;
    
    // Count successful queue attempts within the cooldown window
    const recentQueues = db.prepare(`
      SELECT COUNT(*) as count
      FROM queue_attempts
      WHERE fingerprint_id = ? 
        AND status = 'success' 
        AND timestamp > ?
    `).get(fingerprintId, cooldownWindowStart);
    
    const recentQueueCount = recentQueues ? recentQueues.count : 0;
    
    // If user has already queued enough songs, reject this request
    // Note: This check happens BEFORE queueing, so if count >= limit, they've already reached it
    if (recentQueueCount >= songsBeforeCooldown) {
      const cooldownExpires = now + cooldownDuration;
      db.prepare(`
        UPDATE fingerprints
        SET cooldown_expires = ?
        WHERE id = ?
      `).run(cooldownExpires, fingerprintId);
      
      db.prepare(`
        INSERT INTO queue_attempts (fingerprint_id, status, error_message, timestamp)
        VALUES (?, ?, ?, ?)
      `).run(fingerprintId, 'rate_limited', 'Cooldown limit reached', now);
      
      return res.status(429).json({ 
        error: `You've reached the limit of ${songsBeforeCooldown} song${songsBeforeCooldown > 1 ? 's' : ''} before cooldown. Please wait!`,
        cooldown_remaining: cooldownDuration
      });
    }
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

    // Check song duration limit
    const maxDuration = parseInt(getConfig('max_song_duration') || '0');
    if (maxDuration > 0 && trackInfo.duration_ms > maxDuration * 1000) {
      const maxMins = Math.floor(maxDuration / 60);
      const maxSecs = maxDuration % 60;
      db.prepare(`
        INSERT INTO queue_attempts (fingerprint_id, track_id, track_name, artist_name, status, error_message, timestamp)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(fingerprintId, trackId, trackInfo.name, trackInfo.artists, 'blocked', 'Song exceeds duration limit', now);

      return res.status(403).json({ error: `Song is too long. Maximum duration is ${maxMins}:${String(maxSecs).padStart(2, '0')}.` });
    }

    // Check for duplicate in current queue
    try {
      const currentQueue = await getQueue();
      const isDuplicate = currentQueue.queue.some(track => track.id === trackId) ||
        (currentQueue.currently_playing && currentQueue.currently_playing.id === trackId);
      if (isDuplicate) {
        db.prepare(`
          INSERT INTO queue_attempts (fingerprint_id, track_id, track_name, artist_name, status, error_message, timestamp)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(fingerprintId, trackId, trackInfo.name, trackInfo.artists, 'blocked', 'Song already in queue', now);

        return res.status(409).json({ error: 'This song is already in the queue.' });
      }
    } catch (queueErr) {
      // If we can't check the queue, allow the song through
      console.warn('Could not check queue for duplicates:', queueErr.message);
    }

    // Add to Spotify queue
    await addToQueue(trackInfo.uri);
    
    // Clear queue cache so next request gets fresh data
    queueCache = null;
    queueCacheExpiry = 0;
    
    // Log successful queue first (so it's included in the count)
    db.prepare(`
      INSERT INTO queue_attempts (fingerprint_id, track_id, track_name, artist_name, status, timestamp)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(fingerprintId, trackId, trackInfo.name, trackInfo.artists, 'success', now);
    
    // Update fingerprint last queue attempt
    db.prepare(`
      UPDATE fingerprints
      SET last_queue_attempt = ?
      WHERE id = ?
    `).run(now, fingerprintId);
    
    // Check if we need to apply cooldown after this successful queue
    const cooldownEnabled = getConfig('fingerprinting_enabled') === 'true';
    if (cooldownEnabled) {
      const songsBeforeCooldown = parseInt(getConfig('songs_before_cooldown') || '1');
      const cooldownDuration = parseInt(getConfig('cooldown_duration') || '300');
      const cooldownWindowStart = now - cooldownDuration;
      
      // Count successful queue attempts including the one we just logged
      const recentQueues = db.prepare(`
        SELECT COUNT(*) as count
        FROM queue_attempts
        WHERE fingerprint_id = ? 
          AND status = 'success' 
          AND timestamp > ?
      `).get(fingerprintId, cooldownWindowStart);
      
      const recentQueueCount = recentQueues ? recentQueues.count : 0;
      
      // If this queue reaches or exceeds the limit, apply cooldown
      if (recentQueueCount >= songsBeforeCooldown) {
        const cooldownExpires = now + cooldownDuration;
        db.prepare(`
          UPDATE fingerprints
          SET cooldown_expires = ?
          WHERE id = ?
        `).run(cooldownExpires, fingerprintId);
      }
    }
    
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

// Vote for a track in the queue
router.post('/vote', userAuthMiddleware, (req, res) => {
  const db = getDb();
  const { track_id } = req.body;
  const fingerprintId = req.body.fingerprint_id || req.cookies.fingerprint_id;

  if (!track_id) {
    return res.status(400).json({ error: 'Track ID required' });
  }

  if (!fingerprintId) {
    return res.status(400).json({ error: 'Fingerprint required' });
  }

  try {
    // Check if already voted
    const existing = db.prepare(
      'SELECT id FROM votes WHERE track_id = ? AND fingerprint_id = ?'
    ).get(track_id, fingerprintId);

    if (existing) {
      // Remove vote (toggle)
      db.prepare('DELETE FROM votes WHERE track_id = ? AND fingerprint_id = ?').run(track_id, fingerprintId);
      const count = db.prepare('SELECT COUNT(*) as count FROM votes WHERE track_id = ?').get(track_id);
      return res.json({ voted: false, votes: count ? count.count : 0 });
    }

    // Add vote
    const now = Math.floor(Date.now() / 1000);
    db.prepare(
      'INSERT INTO votes (track_id, fingerprint_id, created_at) VALUES (?, ?, ?)'
    ).run(track_id, fingerprintId, now);

    const count = db.prepare('SELECT COUNT(*) as count FROM votes WHERE track_id = ?').get(track_id);
    res.json({ voted: true, votes: count ? count.count : 0 });
  } catch (error) {
    console.error('Vote error:', error);
    res.status(500).json({ error: 'Failed to vote' });
  }
});

// Get votes for all tracks (or specific track)
router.get('/votes', userAuthMiddleware, (req, res) => {
  const db = getDb();
  const fingerprintId = req.query.fingerprint_id || req.cookies.fingerprint_id;

  try {
    // Get all vote counts
    const voteCounts = db.prepare(
      'SELECT track_id, COUNT(*) as count FROM votes GROUP BY track_id'
    ).all();

    const votes = {};
    voteCounts.forEach(row => {
      votes[row.track_id] = row.count;
    });

    // Get user's votes if fingerprint provided
    let userVotes = [];
    if (fingerprintId) {
      userVotes = db.prepare(
        'SELECT track_id FROM votes WHERE fingerprint_id = ?'
      ).all(fingerprintId).map(row => row.track_id);
    }

    res.json({ votes, userVotes });
  } catch (error) {
    console.error('Get votes error:', error);
    res.json({ votes: {}, userVotes: [] });
  }
});

module.exports = router;

