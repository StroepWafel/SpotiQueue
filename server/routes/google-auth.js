const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
const { getDb } = require('../db');
const { isGoogleOAuthConfigured } = require('../utils/guest-auth');

const router = express.Router();

router.get('/login', (req, res) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;

  if (!clientId) {
    return res.status(400).json({ error: 'Google OAuth not configured' });
  }

  const state = crypto.randomBytes(16).toString('hex');
  res.cookie('google_oauth_state', state, {
    httpOnly: true,
    maxAge: 10 * 60 * 1000,
    sameSite: 'lax'
  });

  const clientUrl = (process.env.CLIENT_URL || 'http://localhost:3000').replace(/\/$/, '');
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || `${clientUrl}/api/google/callback`;

  const authUrl = 'https://accounts.google.com/o/oauth2/v2/auth?' +
    `client_id=${encodeURIComponent(clientId)}&` +
    `redirect_uri=${encodeURIComponent(redirectUri)}&` +
    `response_type=code&` +
    `scope=${encodeURIComponent('openid email profile')}&` +
    `state=${state}&` +
    `access_type=offline&` +
    `prompt=consent`;

  res.json({ authUrl });
});

router.get('/callback', async (req, res) => {
  const { code, state } = req.query;
  const storedState = req.cookies.google_oauth_state;
  res.clearCookie('google_oauth_state');

  if (!state || state !== storedState) {
    return res.status(403).send('State mismatch. Please try again.');
  }
  if (!code) return res.redirect('/?error=google_auth_failed');

  try {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const clientUrl = (process.env.CLIENT_URL || 'http://localhost:3000').replace(/\/$/, '');
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || `${clientUrl}/api/google/callback`;

    const tokenRes = await axios.post('https://oauth2.googleapis.com/token', new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code'
    }), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });

    const accessToken = tokenRes.data.access_token;
    if (!accessToken) return res.redirect('/?error=google_token_failed');

    const userRes = await axios.get('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    const u = userRes.data;
    const googleId = String(u.id);
    const username = u.email || u.name || u.given_name || `google-${googleId}`;
    const avatar = u.picture || null;

    const db = getDb();
    let fingerprintId = req.cookies.fingerprint_id || crypto.randomBytes(16).toString('hex');
    const now = Math.floor(Date.now() / 1000);
    const existing = db.prepare('SELECT * FROM fingerprints WHERE id = ?').get(fingerprintId);

    if (!existing) {
      db.prepare(`
        INSERT INTO fingerprints (id, first_seen, status, username, google_id, google_username, google_avatar)
        VALUES (?, ?, 'active', ?, ?, ?, ?)
      `).run(fingerprintId, now, username, googleId, username, avatar);
    } else {
      db.prepare(`
        UPDATE fingerprints SET username = ?, google_id = ?, google_username = ?, google_avatar = ? WHERE id = ?
      `).run(username, googleId, username, avatar, fingerprintId);
    }

    res.cookie('fingerprint_id', fingerprintId, {
      httpOnly: true,
      maxAge: 365 * 24 * 60 * 60 * 1000,
      sameSite: 'lax'
    });

    const finalClientUrl = (process.env.CLIENT_URL || 'http://localhost:3000').replace(/\/$/, '');
    res.redirect(finalClientUrl + '/?google_auth=success');
  } catch (error) {
    console.error('Google OAuth error:', error.response?.data || error.message);
    res.redirect('/?error=google_auth_failed');
  }
});

router.get('/status', (req, res) => {
  res.json({
    configured: isGoogleOAuthConfigured(),
    google_oauth_configured: isGoogleOAuthConfigured()
  });
});

module.exports = router;
