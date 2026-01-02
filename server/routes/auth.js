const express = require('express');
const axios = require('axios');
const basicAuth = require('express-basic-auth');
const { setConfig, getConfig } = require('../utils/config');
const fs = require('fs');
const path = require('path');

const router = express.Router();

// Basic auth middleware for admin endpoints
const authMiddleware = (req, res, next) => {
  const password = getConfig('admin_password') || 'admin';
  const auth = basicAuth({
    users: { admin: password },
    challenge: true,
    realm: 'Admin Area'
  });
  return auth(req, res, next);
};

// Get OAuth authorization URL
router.get('/authorize', (req, res) => {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  
  // Determine redirect URI
  // In development: backend runs on 5000, so use 5000
  // In production: backend runs on 3000, so use 3000
  // Spotify no longer allows "localhost" - must use 127.0.0.1
  // Or use SPOTIFY_REDIRECT_URI from env if explicitly set
  let redirectUri = process.env.SPOTIFY_REDIRECT_URI;
  if (!redirectUri) {
    const isProduction = process.env.NODE_ENV === 'production';
    const backendPort = isProduction ? 3000 : 5000;
    redirectUri = `http://127.0.0.1:${backendPort}/api/auth/callback`;
  }
  
  if (!clientId) {
    return res.status(400).json({ error: 'SPOTIFY_CLIENT_ID not configured' });
  }
  
  const scopes = 'user-read-playback-state user-modify-playback-state user-read-currently-playing';
  const authUrl = `https://accounts.spotify.com/authorize?` +
    `client_id=${encodeURIComponent(clientId)}&` +
    `response_type=code&` +
    `redirect_uri=${encodeURIComponent(redirectUri)}&` +
    `scope=${encodeURIComponent(scopes)}`;
  
  console.log(`OAuth redirect URI: ${redirectUri}`);
  res.json({ authUrl, redirectUri }); // Also return redirectUri for debugging
});

// OAuth callback handler
router.get('/callback', async (req, res) => {
  const { code, error } = req.query;
  
  if (error) {
    return res.send(`
      <html>
        <head><title>Authorization Failed</title></head>
        <body style="font-family: Arial; padding: 40px; text-align: center;">
          <h1 style="color: #d32f2f;">Authorization Failed</h1>
          <p>Error: ${error}</p>
          <p><a href="/">Return to app</a></p>
        </body>
      </html>
    `);
  }
  
  if (!code) {
    return res.send(`
      <html>
        <head><title>Authorization Failed</title></head>
        <body style="font-family: Arial; padding: 40px; text-align: center;">
          <h1 style="color: #d32f2f;">Authorization Failed</h1>
          <p>No authorization code received.</p>
          <p><a href="/">Return to app</a></p>
        </body>
      </html>
    `);
  }
  
  try {
    const clientId = process.env.SPOTIFY_CLIENT_ID;
    const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
    
    // Use same redirect URI logic as authorize endpoint
    // Spotify no longer allows "localhost" - must use 127.0.0.1
    let redirectUri = process.env.SPOTIFY_REDIRECT_URI;
    if (!redirectUri) {
      const isProduction = process.env.NODE_ENV === 'production';
      const backendPort = isProduction ? 3000 : 5000;
      redirectUri = `http://127.0.0.1:${backendPort}/api/auth/callback`;
    }
    
    if (!clientId || !clientSecret) {
      throw new Error('Spotify credentials not configured');
    }
    
    console.log(`OAuth callback - Using redirect URI: ${redirectUri}`);
    
    // Exchange code for tokens
    const authHeader = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const tokenResponse = await axios.post('https://accounts.spotify.com/api/token',
      new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: redirectUri
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${authHeader}`
        }
      }
    );
    
    const { access_token, refresh_token, expires_in } = tokenResponse.data;
    
    // Get user info to extract user ID
    const userResponse = await axios.get('https://api.spotify.com/v1/me', {
      headers: {
        'Authorization': `Bearer ${access_token}`
      }
    });
    
    const userId = userResponse.data.id;
    
    // Save tokens to .env file
    const envPath = path.join(__dirname, '../../.env');
    let envContent = '';
    
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, 'utf8');
    }
    
    // Update or add refresh token
    if (envContent.includes('SPOTIFY_REFRESH_TOKEN=')) {
      envContent = envContent.replace(
        /SPOTIFY_REFRESH_TOKEN=.*/g,
        `SPOTIFY_REFRESH_TOKEN=${refresh_token}`
      );
    } else {
      envContent += `\nSPOTIFY_REFRESH_TOKEN=${refresh_token}\n`;
    }
    
    // Update or add user ID
    if (envContent.includes('SPOTIFY_USER_ID=')) {
      envContent = envContent.replace(
        /SPOTIFY_USER_ID=.*/g,
        `SPOTIFY_USER_ID=${userId}`
      );
    } else {
      envContent += `\nSPOTIFY_USER_ID=${userId}\n`;
    }
    
    // Write back to .env
    fs.writeFileSync(envPath, envContent);
    
    // Update in-memory environment variables immediately (no restart needed)
    process.env.SPOTIFY_REFRESH_TOKEN = refresh_token;
    process.env.SPOTIFY_USER_ID = userId;
    
    // Clear any cached Spotify access token to force refresh with new token
    // This ensures the new refresh token is used immediately
    const spotifyUtils = require('../utils/spotify');
    if (spotifyUtils.clearTokenCache) {
      spotifyUtils.clearTokenCache();
    }
    
    // Update config in database
    setConfig('spotify_connected', 'true');
    
    // Get admin panel URL from config, default to placeholder if not set
    const adminPanelUrl = getConfig('admin_panel_url');
    let redirectUrl = (adminPanelUrl && adminPanelUrl.trim() !== '') ? adminPanelUrl : 'ChangeURLInSettings.com';
    
    // Ensure URL is absolute (starts with http:// or https://)
    // If it doesn't start with a protocol, prepend https://
    if (redirectUrl !== 'ChangeURLInSettings.com' && !redirectUrl.match(/^https?:\/\//i)) {
      redirectUrl = 'https://' + redirectUrl;
    }
    
    res.send(`
      <html>
        <head><title>Authorization Successful</title></head>
        <body style="font-family: Arial; padding: 40px; text-align: center; background: #f5f5f5; color: #212121; min-height: 100vh; display: flex; align-items: center; justify-content: center; margin: 0;">
          <div style="background: white; color: #212121; padding: 40px; border-radius: 4px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); max-width: 500px; border: 1px solid #e0e0e0;">
            <h1 style="color: #212121; margin-bottom: 20px;">Authorization Successful</h1>
            <p style="margin-bottom: 10px;">Your Spotify account has been connected.</p>
            <p style="margin-bottom: 30px; color: #666;">Refresh token and user ID have been saved and are now active.</p>
            <p style="margin-bottom: 20px; color: #424242;"><strong>No restart needed.</strong> Your connection is ready to use immediately.</p>
            <a href="/" style="display: inline-block; padding: 12px 24px; background: #212121; color: white; text-decoration: none; border-radius: 4px; font-weight: 500; margin-right: 10px;">Return to App</a>
            <a href="${redirectUrl}" style="display: inline-block; padding: 12px 24px; background: #616161; color: white; text-decoration: none; border-radius: 4px; font-weight: 500;">Go to Admin Panel</a>
          </div>
        </body>
      </html>
    `);
  } catch (error) {
    console.error('Token exchange error:', error.response?.data || error.message);
    res.send(`
      <html>
        <head><title>Authorization Failed</title></head>
        <body style="font-family: Arial; padding: 40px; text-align: center;">
          <h1 style="color: #d32f2f;">Authorization Failed</h1>
          <p>Error: ${error.response?.data?.error_description || error.message}</p>
          <p><a href="/">Return to app</a></p>
        </body>
      </html>
    `);
  }
});

// Check if Spotify is connected
router.get('/status', (req, res) => {
  const refreshToken = process.env.SPOTIFY_REFRESH_TOKEN;
  // Check if refresh token exists and is not a placeholder
  const hasRefreshToken = !!refreshToken && 
    refreshToken.trim() !== '' && 
    !refreshToken.includes('your_refresh_token') &&
    !refreshToken.includes('placeholder');
  const hasClientId = !!process.env.SPOTIFY_CLIENT_ID && 
    process.env.SPOTIFY_CLIENT_ID.trim() !== '';
  const hasClientSecret = !!process.env.SPOTIFY_CLIENT_SECRET && 
    process.env.SPOTIFY_CLIENT_SECRET.trim() !== '';
  
  res.json({
    connected: hasRefreshToken && hasClientId && hasClientSecret,
    hasRefreshToken,
    hasClientId,
    hasClientSecret
  });
});

// Disconnect Spotify account (requires admin auth)
router.post('/disconnect', authMiddleware, (req, res) => {
  try {
    const envPath = path.join(__dirname, '../../.env');
    let envContent = '';
    
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, 'utf8');
    }
    
    // Remove refresh token from .env
    if (envContent.includes('SPOTIFY_REFRESH_TOKEN=')) {
      envContent = envContent.replace(/SPOTIFY_REFRESH_TOKEN=.*\n?/g, '');
    }
    
    // Remove user ID from .env
    if (envContent.includes('SPOTIFY_USER_ID=')) {
      envContent = envContent.replace(/SPOTIFY_USER_ID=.*\n?/g, '');
    }
    
    // Write back to .env
    fs.writeFileSync(envPath, envContent);
    
    // Clear in-memory environment variables
    delete process.env.SPOTIFY_REFRESH_TOKEN;
    delete process.env.SPOTIFY_USER_ID;
    
    // Clear any cached Spotify access token
    const spotifyUtils = require('../utils/spotify');
    if (spotifyUtils.clearTokenCache) {
      spotifyUtils.clearTokenCache();
    }
    
    // Update config in database
    setConfig('spotify_connected', 'false');
    
    res.json({ success: true, message: 'Spotify account disconnected successfully' });
  } catch (error) {
    console.error('Disconnect error:', error);
    res.status(500).json({ error: 'Failed to disconnect Spotify account' });
  }
});

module.exports = router;

