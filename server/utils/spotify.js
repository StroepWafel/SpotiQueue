const axios = require('axios');
const { getConfig } = require('./config');

let accessToken = null;
let tokenExpiresAt = 0;

// Clear token cache when refresh token changes
function clearTokenCache() {
  accessToken = null;
  tokenExpiresAt = 0;
}

// Spotify API base URL
const SPOTIFY_API_BASE = 'https://api.spotify.com/v1';

// Get access token using client credentials flow
async function getAccessToken() {
  const now = Math.floor(Date.now() / 1000);
  
  // Return cached token if still valid
  if (accessToken && tokenExpiresAt > now + 60) {
    return accessToken;
  }
  
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  const refreshToken = process.env.SPOTIFY_REFRESH_TOKEN;
  
  if (!clientId || !clientSecret) {
    throw new Error('Spotify credentials not configured');
  }
  
  try {
    // Use refresh token if available, otherwise client credentials
    if (refreshToken) {
      const authHeader = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
      const response = await axios.post('https://accounts.spotify.com/api/token', 
        new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: refreshToken
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': `Basic ${authHeader}`
          }
        }
      );
      
      accessToken = response.data.access_token;
      tokenExpiresAt = now + response.data.expires_in;
      
      // Update refresh token if provided
      if (response.data.refresh_token) {
        process.env.SPOTIFY_REFRESH_TOKEN = response.data.refresh_token;
      }
    } else {
      // Client credentials flow (limited scope)
      const response = await axios.post('https://accounts.spotify.com/api/token',
        new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: clientId,
          client_secret: clientSecret
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );
      
      accessToken = response.data.access_token;
      tokenExpiresAt = now + response.data.expires_in;
    }
    
    return accessToken;
  } catch (error) {
    console.error('Error getting Spotify access token:', error.response?.data || error.message);
    const errorData = error.response?.data;
    if (errorData?.error === 'invalid_client') {
      throw new Error('Invalid Spotify credentials. Please check your CLIENT_ID and CLIENT_SECRET in .env');
    } else if (errorData?.error === 'invalid_grant') {
      throw new Error('Invalid refresh token. Please get a new refresh token and update .env');
    }
    throw new Error(`Failed to authenticate with Spotify: ${errorData?.error_description || error.message}`);
  }
}

// Search for tracks
async function searchTracks(query, limit = 10) {
  const token = await getAccessToken();
  
  try {
    const response = await axios.get(`${SPOTIFY_API_BASE}/search`, {
      params: {
        q: query,
        type: 'track',
        limit: limit
      },
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    return response.data.tracks.items.map(track => ({
      id: track.id,
      name: track.name,
      artists: track.artists.map(a => a.name).join(', '),
      album: track.album.name,
      album_art: track.album.images[0]?.url || null,
      duration_ms: track.duration_ms,
      uri: track.uri,
      explicit: track.explicit || false
    }));
  } catch (error) {
    console.error('Error searching tracks:', error.response?.data || error.message);
    const errorMsg = error.response?.data?.error?.message || error.message;
    if (error.response?.status === 401) {
      throw new Error('Spotify authentication failed. Please check your credentials.');
    } else if (error.response?.status === 400) {
      throw new Error(`Invalid search request: ${errorMsg}`);
    }
    throw new Error(`Failed to search tracks: ${errorMsg || 'Unknown error'}`);
  }
}

// Get track by ID
async function getTrack(trackId) {
  const token = await getAccessToken();
  
  try {
    const response = await axios.get(`${SPOTIFY_API_BASE}/tracks/${trackId}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    const track = response.data;
    return {
      id: track.id,
      name: track.name,
      artists: track.artists.map(a => a.name).join(', '),
      album: track.album.name,
      album_art: track.album.images[0]?.url || null,
      duration_ms: track.duration_ms,
      uri: track.uri,
      explicit: track.explicit || false
    };
  } catch (error) {
    console.error('Error getting track:', error.response?.data || error.message);
    throw new Error('Failed to get track');
  }
}

// Parse Spotify URL to get track ID
function parseSpotifyUrl(url) {
  if (!url || typeof url !== 'string') {
    return null;
  }
  
  // Handle spotify:track: URI format
  if (url.startsWith('spotify:track:')) {
    return url.replace('spotify:track:', '').split('?')[0];
  }
  
  // Handle web URLs
  try {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/');
    const trackIndex = pathParts.indexOf('track');
    
    if (trackIndex !== -1 && pathParts[trackIndex + 1]) {
      return pathParts[trackIndex + 1].split('?')[0];
    }
    
    return null;
  } catch (error) {
    // If URL parsing fails, try to extract track ID directly
    // Handle formats like: https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC
    const trackMatch = url.match(/track\/([a-zA-Z0-9]+)/);
    if (trackMatch && trackMatch[1]) {
      return trackMatch[1];
    }
    
    return null;
  }
}

// Get currently playing track (requires user authorization)
async function getNowPlaying() {
  const token = await getAccessToken();
  const userId = process.env.SPOTIFY_USER_ID;
  
  if (!userId) {
    return null;
  }
  
  try {
    // Try to get currently playing track
    const response = await axios.get(`${SPOTIFY_API_BASE}/me/player/currently-playing`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (response.status === 204 || !response.data) {
      return null;
    }
    
    const track = response.data.item;
    return {
      id: track.id,
      name: track.name,
      artists: track.artists.map(a => a.name).join(', '),
      album: track.album.name,
      album_art: track.album.images[0]?.url || null,
      duration_ms: track.duration_ms,
      progress_ms: response.data.progress_ms,
      is_playing: response.data.is_playing
    };
  } catch (error) {
    // If 401, token might need refresh
    if (error.response?.status === 401) {
      // Clear token cache to force refresh
      accessToken = null;
      tokenExpiresAt = 0;
    }
    return null;
  }
}

// Add track to queue (requires user authorization)
async function addToQueue(trackUri) {
  const token = await getAccessToken();
  
  try {
    await axios.post(`${SPOTIFY_API_BASE}/me/player/queue`, null, {
      params: {
        uri: trackUri
      },
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    return true;
  } catch (error) {
    console.error('Error adding to queue:', error.response?.data || error.message);
    
    if (error.response?.status === 404) {
      throw new Error('No active Spotify device found. Please start playing music on a device.');
    }
    
    throw new Error('Failed to add track to queue');
  }
}

// Get current queue
async function getQueue() {
  const token = await getAccessToken();

  try {
    const response = await axios.get(`${SPOTIFY_API_BASE}/me/player/queue`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    return {
      currently_playing: response.data.currently_playing ? {
        id: response.data.currently_playing.id,
        name: response.data.currently_playing.name,
        artists: response.data.currently_playing.artists.map(a => a.name).join(', '),
        album: response.data.currently_playing.album.name,
        album_art: response.data.currently_playing.album.images[0]?.url || null,
        duration_ms: response.data.currently_playing.duration_ms,
        uri: response.data.currently_playing.uri
      } : null,
      queue: (response.data.queue || []).map(track => ({
        id: track.id,
        name: track.name,
        artists: track.artists.map(a => a.name).join(', '),
        album: track.album.name,
        album_art: track.album.images[0]?.url || null,
        duration_ms: track.duration_ms,
        uri: track.uri
      }))
    };
  } catch (error) {
    console.error('Error getting queue:', error.response?.data || error.message);
    throw new Error('Failed to get queue');
  }
}

module.exports = {
  searchTracks,
  getTrack,
  parseSpotifyUrl,
  getNowPlaying,
  addToQueue,
  getQueue,
  getAccessToken,
  clearTokenCache
};

