const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
const { getDb } = require('../db');

const router = express.Router();

// Redirect to GitHub OAuth
router.get('/login', (req, res) => {
  const clientId = process.env.GITHUB_CLIENT_ID;

  if (!clientId) {
    return res.status(400).json({ error: 'GitHub OAuth not configured' });
  }

  const state = crypto.randomBytes(16).toString('hex');

  // Store state in cookie for CSRF protection
  res.cookie('github_oauth_state', state, {
    httpOnly: true,
    maxAge: 10 * 60 * 1000, // 10 minutes
    sameSite: 'lax'
  });

  const redirectUri = process.env.GITHUB_REDIRECT_URI ||
    (process.env.NODE_ENV === 'production'
      ? `${process.env.CLIENT_URL || 'http://localhost:3000'}/api/github/callback`
      : 'http://localhost:8000/api/github/callback');

  const authUrl = `https://github.com/login/oauth/authorize?` +
    `client_id=${encodeURIComponent(clientId)}&` +
    `redirect_uri=${encodeURIComponent(redirectUri)}&` +
    `scope=read:user&` +
    `state=${state}`;

  res.json({ authUrl });
});

// GitHub OAuth callback
router.get('/callback', async (req, res) => {
  const { code, state } = req.query;
  const storedState = req.cookies.github_oauth_state;

  // Clear state cookie
  res.clearCookie('github_oauth_state');

  if (!state || state !== storedState) {
    return res.status(403).send('State mismatch. Please try again.');
  }

  if (!code) {
    return res.redirect('/?error=github_auth_failed');
  }

  try {
    const clientId = process.env.GITHUB_CLIENT_ID;
    const clientSecret = process.env.GITHUB_CLIENT_SECRET;

    // Exchange code for access token
    const tokenResponse = await axios.post('https://github.com/login/oauth/access_token', {
      client_id: clientId,
      client_secret: clientSecret,
      code: code
    }, {
      headers: { 'Accept': 'application/json' }
    });

    const accessToken = tokenResponse.data.access_token;

    if (!accessToken) {
      return res.redirect('/?error=github_token_failed');
    }

    // Get user info
    const userResponse = await axios.get('https://api.github.com/user', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'User-Agent': 'SpotiQueue'
      }
    });

    const githubUser = userResponse.data;
    const username = githubUser.login;
    const githubId = String(githubUser.id);
    const avatar = githubUser.avatar_url;

    // Create or update fingerprint
    const db = getDb();
    let fingerprintId = req.cookies.fingerprint_id || crypto.randomBytes(16).toString('hex');

    const existing = db.prepare('SELECT * FROM fingerprints WHERE id = ?').get(fingerprintId);
    const now = Math.floor(Date.now() / 1000);

    if (!existing) {
      db.prepare(`
        INSERT INTO fingerprints (id, first_seen, status, username, github_id, github_avatar)
        VALUES (?, ?, 'active', ?, ?, ?)
      `).run(fingerprintId, now, username, githubId, avatar);
    } else {
      db.prepare(`
        UPDATE fingerprints SET username = ?, github_id = ?, github_avatar = ? WHERE id = ?
      `).run(username, githubId, avatar, fingerprintId);
    }

    // Set fingerprint cookie
    res.cookie('fingerprint_id', fingerprintId, {
      httpOnly: true,
      maxAge: 365 * 24 * 60 * 60 * 1000,
      sameSite: 'lax'
    });

    // Redirect back to app
    const clientUrl = process.env.NODE_ENV === 'production'
      ? (process.env.CLIENT_URL || '/')
      : 'http://localhost:3000';

    res.redirect(clientUrl + '?github_auth=success');
  } catch (error) {
    console.error('GitHub OAuth error:', error.response?.data || error.message);
    res.redirect('/?error=github_auth_failed');
  }
});

// Check if GitHub OAuth is configured
router.get('/status', (req, res) => {
  const configured = !!(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET);
  res.json({ configured });
});

module.exports = router;
