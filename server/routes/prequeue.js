const express = require('express');
const { getDb } = require('../db');
const { getConfig } = require('../utils/config');
const { getTrack, addToQueue } = require('../utils/spotify');
const { sendPrequeueMessage } = require('../utils/slack');
const crypto = require('crypto');
const basicAuth = require('express-basic-auth');

const router = express.Router();

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

// Submit track for prequeue approval
router.post('/submit', userAuthMiddleware, async (req, res) => {
  const db = getDb();
  console.log('Prequeue submit called');
  const prequeueEnabled = getConfig('prequeue_enabled') === 'true';
  console.log('Prequeue enabled:', prequeueEnabled);
  
  if (!prequeueEnabled) {
    return res.status(503).json({ error: 'Prequeue is currently disabled.' });
  }

  const fingerprintId = req.body.fingerprint_id || req.cookies.fingerprint_id;
  let trackId = req.body.track_id;

  if (!fingerprintId) {
    return res.status(400).json({ error: 'Missing fingerprint' });
  }

  // Handle URL input
  if (!trackId && req.body.track_url) {
    const { parseSpotifyUrl } = require('../utils/spotify');
    trackId = parseSpotifyUrl(req.body.track_url);
    if (!trackId) {
      return res.status(400).json({ 
        error: 'Invalid Spotify URL. Use format: https://open.spotify.com/track/TRACK_ID or spotify:track:TRACK_ID' 
      });
    }
  }

  if (!trackId) {
    return res.status(400).json({ error: 'Missing track ID or URL' });
  }

  try {
    // Get track info
    const trackInfo = await getTrack(trackId);

    // Create prequeue entry
    const prequeueId = crypto.randomBytes(8).toString('hex');
    const now = Math.floor(Date.now() / 1000);

    db.prepare(`
      INSERT INTO prequeue (id, fingerprint_id, track_id, track_name, artist_name, album_art, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      prequeueId,
      fingerprintId,
      trackId,
      trackInfo.name,
      trackInfo.artists,
      trackInfo.album_art,
      'pending',
      now
    );

    // Send to Slack
    const slackEnabled = process.env.SLACK_WEBHOOK_URL && process.env.SLACK_PREQUEUE_ENABLED === 'true';
    if (slackEnabled) {
      await sendPrequeueMessage(trackInfo, prequeueId);
    }

    res.json({
      success: true,
      prequeue_id: prequeueId,
      message: 'Track submitted for approval'
    });
  } catch (error) {
    console.error('Prequeue error:', error);
    res.status(500).json({ error: error.message || 'Failed to submit track' });
  }
});

// Approve prequeue track
router.post('/approve/:prequeueId', async (req, res) => {
  const { prequeueId } = req.params;

  try {
    const prequeue = db.prepare('SELECT * FROM prequeue WHERE id = ?').get(prequeueId);

    if (!prequeue) {
      return res.status(404).json({ error: 'Prequeue entry not found' });
    }

    if (prequeue.status !== 'pending') {
      return res.status(400).json({ error: 'Track already processed' });
    }

    // Add to Spotify queue
    const trackInfo = await getTrack(prequeue.track_id);
    await addToQueue(trackInfo.uri);

    // Update prequeue status
    db.prepare('UPDATE prequeue SET status = ? WHERE id = ?').run('approved', prequeueId);

    // Log queue attempt
    const now = Math.floor(Date.now() / 1000);
    db.prepare(`
      INSERT INTO queue_attempts (fingerprint_id, track_id, track_name, artist_name, status, timestamp)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(prequeue.fingerprint_id, prequeue.track_id, prequeue.track_name, prequeue.artist_name, 'success', now);

    res.json({
      success: true,
      message: `Approved: ${prequeue.track_name}`
    });
  } catch (error) {
    console.error('Approve error:', error);
    res.status(500).json({ error: error.message || 'Failed to approve track' });
  }
});

// Decline prequeue track
router.post('/decline/:prequeueId', async (req, res) => {
  const { prequeueId } = req.params;

  try {
    const prequeue = db.prepare('SELECT * FROM prequeue WHERE id = ?').get(prequeueId);

    if (!prequeue) {
      return res.status(404).json({ error: 'Prequeue entry not found' });
    }

    if (prequeue.status !== 'pending') {
      return res.status(400).json({ error: 'Track already processed' });
    }

    // Update prequeue status
    db.prepare('UPDATE prequeue SET status = ? WHERE id = ?').run('declined', prequeueId);

    res.json({
      success: true,
      message: `Declined: ${prequeue.track_name}`
    });
  } catch (error) {
    console.error('Decline error:', error);
    res.status(500).json({ error: error.message || 'Failed to decline track' });
  }
});

// Get prequeue status
router.get('/status/:prequeueId', (req, res) => {
  const { prequeueId } = req.params;

  try {
    const prequeue = db.prepare('SELECT * FROM prequeue WHERE id = ?').get(prequeueId);

    if (!prequeue) {
      return res.status(404).json({ error: 'Prequeue entry not found' });
    }

    res.json(prequeue);
  } catch (error) {
    console.error('Status error:', error);
    res.status(500).json({ error: 'Failed to get status' });
  }
});

// Get pending prequeue requests
router.get('/pending', (req, res) => {
  try {
    const pending = db.prepare(`
      SELECT * FROM prequeue 
      WHERE status = 'pending' 
      ORDER BY created_at DESC
    `).all();
    
    res.json({ pending });
  } catch (error) {
    console.error('Pending error:', error);
    res.status(500).json({ error: 'Failed to get pending requests' });
  }
});

module.exports = router;
