const express = require('express');
const { getNowPlaying } = require('../utils/spotify');

const router = express.Router();

// Get currently playing track
router.get('/', async (req, res) => {
  try {
    const nowPlaying = await getNowPlaying();
    res.json({ track: nowPlaying });
  } catch (error) {
    console.error('Now playing error:', error);
    res.json({ track: null });
  }
});

module.exports = router;

