const express = require('express');
const { getNowPlaying } = require('../utils/spotify');
const { getLyrics } = require('../utils/lyrics');

const router = express.Router();

// Cache for lyrics to avoid repeated fetches
const lyricsCache = new Map();

// Get currently playing track
router.get('/', async (req, res) => {
  try {
    const nowPlaying = await getNowPlaying();
    
    if (nowPlaying) {
      // Check if we have cached lyrics for this track
      const cacheKey = `${nowPlaying.id}`;
      if (lyricsCache.has(cacheKey)) {
        nowPlaying.lyrics = lyricsCache.get(cacheKey);
      } else {
        // Fetch lyrics in background (don't wait for it)
        getLyrics(nowPlaying.name, nowPlaying.artists, nowPlaying.id)
          .then(lyrics => {
            if (lyrics) {
              lyricsCache.set(cacheKey, lyrics);
              console.log(`Cached lyrics for: ${nowPlaying.name}`);
            }
          })
          .catch(error => {
            console.error(`Background lyrics fetch failed: ${error.message}`);
          });
      }
    }
    
    res.json({ track: nowPlaying });
  } catch (error) {
    console.error('Now playing error:', error);
    res.json({ track: null });
  }
});

module.exports = router;
