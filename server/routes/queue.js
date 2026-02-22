const express = require('express');
const { getDb } = require('../db');
const { getConfig } = require('../utils/config');
const { searchTracks, getTrack, parseSpotifyUrl, addToQueue, getQueue } = require('../utils/spotify');
const { getGuestAuthRequirements, sendAuthRequiredResponse } = require('../utils/guest-auth');

const router = express.Router();
const db = getDb();

// Get fingerprint IDs that share cooldown (by GitHub/Google account, or device)
function getCooldownFingerprintIds(fingerprint) {
  if (fingerprint.github_id) {
    return db.prepare('SELECT id FROM fingerprints WHERE github_id = ?').all(fingerprint.github_id).map(r => r.id);
  }
  if (fingerprint.google_id) {
    return db.prepare('SELECT id FROM fingerprints WHERE google_id = ?').all(fingerprint.google_id).map(r => r.id);
  }
  return [fingerprint.id];
}

// Server-side cache for queue data
let queueCache = null;
let queueCacheExpiry = 0;
const QUEUE_CACHE_TTL = 20000; // 20 seconds

// Get current queue (optionally sorted by votes when voting_auto_promote enabled)
router.get('/current', async (req, res) => {
  try {
    const now = Date.now();

    if (queueCache && queueCacheExpiry > now) {
      return res.json(queueCache);
    }

    const queue = await getQueue();
    const autoPromote = getConfig('voting_auto_promote') === 'true';
    const guestQueuedIds = new Set(
      db.prepare("SELECT DISTINCT track_id FROM queue_attempts WHERE status = 'success' AND track_id IS NOT NULL").all().map(r => r.track_id)
    );

    if (queue?.queue?.length > 0) {
      queue.queue = queue.queue.map(t => ({ ...t, votable: guestQueuedIds.has(t.id) }));
    }
    if (queue?.currently_playing) {
      queue.currently_playing = { ...queue.currently_playing, votable: guestQueuedIds.has(queue.currently_playing.id) };
    }

    if (autoPromote && queue?.queue?.length > 0) {
      const voteRows = db.prepare('SELECT track_id, COALESCE(SUM(direction), 0) as net FROM votes GROUP BY track_id').all();
      const voteMap = {};
      voteRows.forEach(row => { voteMap[row.track_id] = row.net; });
      queue.queue = [...queue.queue].sort((a, b) => {
        if (!a.votable && !b.votable) return 0;
        if (!a.votable) return 1;
        if (!b.votable) return -1;
        return (voteMap[b.id] ?? 0) - (voteMap[a.id] ?? 0);
      });
    }

    queueCache = queue;
    queueCacheExpiry = now + QUEUE_CACHE_TTL;

    res.json(queue);
  } catch (error) {
    console.error('Queue error:', error);

    if (queueCache) {
      return res.json(queueCache);
    }

    res.status(500).json({ error: error.message || 'Failed to get queue' });
  }
});

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

  const authReq = getGuestAuthRequirements(fingerprint);
  if (authReq.authRequired) {
    return sendAuthRequiredResponse(res, authReq);
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
  
  // Check cooldown (shared across devices with same GitHub/Google account)
  const cooldownEnabled = getConfig('fingerprinting_enabled') === 'true';
  const now = Math.floor(Date.now() / 1000);
  const cooldownIds = getCooldownFingerprintIds(fingerprint);
  
  if (cooldownEnabled && cooldownIds.length > 0) {
    const placeholders = cooldownIds.map(() => '?').join(',');
    const maxCooldown = db.prepare(`
      SELECT MAX(cooldown_expires) as mx FROM fingerprints
      WHERE id IN (${placeholders}) AND cooldown_expires > ?
    `).get(...cooldownIds, now);
    if (maxCooldown?.mx) {
      const remaining = maxCooldown.mx - now;
      db.prepare(`
        INSERT INTO queue_attempts (fingerprint_id, status, error_message, timestamp)
        VALUES (?, ?, ?, ?)
      `).run(fingerprintId, 'rate_limited', 'Cooldown active', now);
      return res.status(429).json({
        error: 'Please wait before queueing another song!',
        cooldown_remaining: remaining
      });
    }
  }
  
  // Check if user has reached the limit of songs before cooldown (count shared across account)
  if (cooldownEnabled && cooldownIds.length > 0) {
    const songsBeforeCooldown = parseInt(getConfig('songs_before_cooldown') || '1');
    const cooldownDuration = parseInt(getConfig('cooldown_duration') || '300');
    const cooldownWindowStart = now - cooldownDuration;
    const placeholders = cooldownIds.map(() => '?').join(',');
    const recentQueues = db.prepare(`
      SELECT COUNT(*) as count
      FROM queue_attempts
      WHERE fingerprint_id IN (${placeholders})
        AND status = 'success'
        AND timestamp > ?
    `).get(...cooldownIds, cooldownWindowStart);
    const recentQueueCount = recentQueues ? recentQueues.count : 0;
    
    if (recentQueueCount >= songsBeforeCooldown) {
      const cooldownExpires = now + cooldownDuration;
      const updatePlaceholders = cooldownIds.map(() => '?').join(',');
      db.prepare(`
        UPDATE fingerprints SET cooldown_expires = ?
        WHERE id IN (${updatePlaceholders})
      `).run(cooldownExpires, ...cooldownIds);
      
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
    
    // Add to Spotify queue
    await addToQueue(trackInfo.uri);
    
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
    
    // Check if we need to apply cooldown after this successful queue (shared across account)
    const cooldownEnabled = getConfig('fingerprinting_enabled') === 'true';
    if (cooldownEnabled && cooldownIds.length > 0) {
      const songsBeforeCooldown = parseInt(getConfig('songs_before_cooldown') || '1');
      const cooldownDuration = parseInt(getConfig('cooldown_duration') || '300');
      const cooldownWindowStart = now - cooldownDuration;
      const placeholders = cooldownIds.map(() => '?').join(',');
      const recentQueues = db.prepare(`
        SELECT COUNT(*) as count
        FROM queue_attempts
        WHERE fingerprint_id IN (${placeholders})
          AND status = 'success'
          AND timestamp > ?
      `).get(...cooldownIds, cooldownWindowStart);
      const recentQueueCount = recentQueues ? recentQueues.count : 0;
      
      if (recentQueueCount >= songsBeforeCooldown) {
        const cooldownExpires = now + cooldownDuration;
        const updatePlaceholders = cooldownIds.map(() => '?').join(',');
        db.prepare(`
          UPDATE fingerprints SET cooldown_expires = ?
          WHERE id IN (${updatePlaceholders})
        `).run(cooldownExpires, ...cooldownIds);
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

// Vote for a track (direction: 1 = upvote, -1 = downvote; omit to toggle off)
router.post('/vote', (req, res) => {
  const votingEnabled = getConfig('voting_enabled') === 'true';
  if (!votingEnabled) {
    return res.status(503).json({ error: 'Voting is currently disabled.' });
  }

  const { track_id, direction: dir } = req.body;
  const fingerprintId = req.body.fingerprint_id || req.cookies.fingerprint_id;
  const downvoteEnabled = getConfig('voting_downvote_enabled') !== 'false';

  if (!track_id || !fingerprintId) {
    return res.status(400).json({ error: 'Track ID and fingerprint required' });
  }

  const direction = dir === -1 ? -1 : 1;
  if (dir === -1 && !downvoteEnabled) {
    return res.status(400).json({ error: 'Downvotes are disabled.' });
  }

  const fingerprint = db.prepare('SELECT * FROM fingerprints WHERE id = ?').get(fingerprintId);
  if (!fingerprint) {
    return res.status(400).json({ error: 'Invalid fingerprint' });
  }

  const authReq = getGuestAuthRequirements(fingerprint);
  if (authReq.authRequired) {
    return sendAuthRequiredResponse(res, authReq);
  }

  const guestQueued = db.prepare("SELECT 1 FROM queue_attempts WHERE track_id = ? AND status = 'success' LIMIT 1").get(track_id);
  if (!guestQueued) {
    return res.status(400).json({ error: 'Voting is only available for songs queued by guests.' });
  }

  try {
    const existing = db.prepare('SELECT id, direction FROM votes WHERE track_id = ? AND fingerprint_id = ?').get(track_id, fingerprintId);

    if (existing) {
      if (existing.direction === direction) {
        db.prepare('DELETE FROM votes WHERE track_id = ? AND fingerprint_id = ?').run(track_id, fingerprintId);
        const net = db.prepare('SELECT COALESCE(SUM(direction), 0) as net FROM votes WHERE track_id = ?').get(track_id);
        if (getConfig('voting_auto_promote') === 'true') queueCacheExpiry = 0;
        return res.json({ userVote: null, votes: net?.net ?? 0 });
      }
      db.prepare('UPDATE votes SET direction = ? WHERE track_id = ? AND fingerprint_id = ?').run(direction, track_id, fingerprintId);
    } else {
      const now = Math.floor(Date.now() / 1000);
      db.prepare('INSERT INTO votes (track_id, fingerprint_id, direction, created_at) VALUES (?, ?, ?, ?)').run(track_id, fingerprintId, direction, now);
    }
    const net = db.prepare('SELECT COALESCE(SUM(direction), 0) as net FROM votes WHERE track_id = ?').get(track_id);
    if (getConfig('voting_auto_promote') === 'true') queueCacheExpiry = 0;
    res.json({ userVote: direction, votes: net?.net ?? 0 });
  } catch (error) {
    console.error('Vote error:', error);
    res.status(500).json({ error: 'Failed to vote' });
  }
});

// Get vote counts (net score per track; userVotes: { track_id: 1|-1 })
router.get('/votes', (req, res) => {
  const fingerprintId = req.query.fingerprint_id || req.cookies.fingerprint_id;
  const votingEnabled = getConfig('voting_enabled') === 'true';
  const downvoteEnabled = getConfig('voting_downvote_enabled') !== 'false';

  if (!votingEnabled) {
    return res.json({ votes: {}, userVotes: {}, enabled: false, downvoteEnabled: false });
  }

  try {
    const voteCounts = db.prepare('SELECT track_id, COALESCE(SUM(direction), 0) as net FROM votes GROUP BY track_id').all();
    const votes = {};
    voteCounts.forEach(row => { votes[row.track_id] = row.net; });

    let userVotes = {};
    if (fingerprintId) {
      const rows = db.prepare('SELECT track_id, direction FROM votes WHERE fingerprint_id = ?').all(fingerprintId);
      rows.forEach(row => { userVotes[row.track_id] = row.direction; });
    }

    res.json({ votes, userVotes, enabled: true, downvoteEnabled });
  } catch (error) {
    console.error('Get votes error:', error);
    res.json({ votes: {}, userVotes: {} });
  }
});

module.exports = router;

