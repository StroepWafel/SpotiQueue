const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
const { getDb } = require('../db');
const { isGithubOAuthConfigured } = require('../utils/guest-auth');

const router = express.Router();

router.get('/login', (req, res) => {
  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return res.status(400).json({ error: 'GitHub OAuth not configured' });
  }

  const state = crypto.randomBytes(16).toString('hex');
  res.cookie('github_oauth_state', state, {
    httpOnly: true,
    maxAge: 10 * 60 * 1000,
    sameSite: 'lax'
  });

  const clientUrl = (process.env.CLIENT_URL || 'http://localhost:3000').replace(/\/$/, '');
  const redirectUri = process.env.GITHUB_REDIRECT_URI || `${clientUrl}/api/github/callback`;

  const authUrl = `https://github.com/login/oauth/authorize?` +
    `client_id=${encodeURIComponent(clientId)}&` +
    `redirect_uri=${encodeURIComponent(redirectUri)}&` +
    `scope=read:user&` +
    `state=${state}`;

  res.json({ authUrl });
});

router.get('/callback', async (req, res) => {
  const { code, state } = req.query;
  const storedState = req.cookies.github_oauth_state;
  res.clearCookie('github_oauth_state');

  if (!state || state !== storedState) {
    return res.status(403).send('State mismatch. Please try again.');
  }
  if (!code) return res.redirect('/?error=github_auth_failed');

  try {
    const clientId = process.env.GITHUB_CLIENT_ID;
    const clientSecret = process.env.GITHUB_CLIENT_SECRET;
    const clientUrl = (process.env.CLIENT_URL || 'http://localhost:3000').replace(/\/$/, '');
    const redirectUri = process.env.GITHUB_REDIRECT_URI || `${clientUrl}/api/github/callback`;

    const tokenRes = await axios.post('https://github.com/login/oauth/access_token', {
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri
    }, { headers: { Accept: 'application/json' } });

    const accessToken = tokenRes.data.access_token;
    if (!accessToken) return res.redirect('/?error=github_token_failed');

    const userRes = await axios.get('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${accessToken}`, 'User-Agent': 'SpotiQueue' }
    });

    const u = userRes.data;
    const db = getDb();
    let fingerprintId = req.cookies.fingerprint_id || crypto.randomBytes(16).toString('hex');
    const now = Math.floor(Date.now() / 1000);
    const existing = db.prepare('SELECT * FROM fingerprints WHERE id = ?').get(fingerprintId);

    if (!existing) {
      db.prepare(`
        INSERT INTO fingerprints (id, first_seen, status, username, github_id, github_username, github_avatar)
        VALUES (?, ?, 'active', ?, ?, ?, ?)
      `).run(fingerprintId, now, u.login, String(u.id), u.login, u.avatar_url);
    } else {
      db.prepare(`
        UPDATE fingerprints SET username = ?, github_id = ?, github_username = ?, github_avatar = ? WHERE id = ?
      `).run(u.login, String(u.id), u.login, u.avatar_url, fingerprintId);
    }

    res.cookie('fingerprint_id', fingerprintId, {
      httpOnly: true,
      maxAge: 365 * 24 * 60 * 60 * 1000,
      sameSite: 'lax'
    });

    const finalClientUrl = (process.env.CLIENT_URL || 'http://localhost:3000').replace(/\/$/, '');
    res.redirect(finalClientUrl + '/?github_auth=success');
  } catch (error) {
    console.error('GitHub OAuth error:', error.response?.data || error.message);
    res.redirect('/?error=github_auth_failed');
  }
});

router.get('/status', (req, res) => {
  res.json({
    configured: isGithubOAuthConfigured(),
    github_oauth_configured: isGithubOAuthConfigured()
  });
});

module.exports = router;
