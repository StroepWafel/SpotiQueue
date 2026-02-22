const express = require('express');
const { getNowPlaying, getQueue } = require('../utils/spotify');
const { getLyrics } = require('../utils/lyrics');

const router = express.Router();
const lyricsCache = new Map();
const lyricsFailureCache = new Map();
const LYRICS_RETRY_AFTER_MS = 5 * 60 * 1000; // Don't retry failed tracks for 5 minutes

function ensureLyricsFetch(track, cacheKey) {
  if (!track || !cacheKey) return;
  if (lyricsCache.has(cacheKey)) return;
  const failedAt = lyricsFailureCache.get(cacheKey);
  if (failedAt && Date.now() - failedAt < LYRICS_RETRY_AFTER_MS) return;

  getLyrics(track.name, track.artists, track.id)
    .then(lyrics => {
      if (lyrics) {
        lyricsCache.set(cacheKey, lyrics);
        lyricsFailureCache.delete(cacheKey);
      } else {
        lyricsFailureCache.set(cacheKey, Date.now());
      }
    })
    .catch(() => {
      lyricsFailureCache.set(cacheKey, Date.now());
    });
}

router.get('/', async (req, res) => {
  try {
    const nowPlaying = await getNowPlaying();

    if (nowPlaying) {
      const cacheKey = nowPlaying.id;
      if (lyricsCache.has(cacheKey)) {
        nowPlaying.lyrics = lyricsCache.get(cacheKey);
      } else {
        ensureLyricsFetch(nowPlaying, cacheKey);
      }
    }

    // Pre-fetch lyrics for the next song(s) in queue so they're ready when the track changes
    try {
      const { queue } = await getQueue();
      if (queue?.length > 0) {
        for (let i = 0; i < Math.min(queue.length, 2); i++) {
          const next = queue[i];
          ensureLyricsFetch(next, next.id);
        }
      }
    } catch {
      // Non-critical; continue with response
    }

    res.json({ track: nowPlaying });
  } catch (error) {
    console.error('Now playing error:', error);
    res.json({ track: null });
  }
});

module.exports = router;

