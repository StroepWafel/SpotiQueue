const axios = require('axios');

// Fetch synced lyrics from LRCLib API
async function getLyrics(trackName, artistName, trackId) {
  if (!trackName || !artistName) {
    return null;
  }

  try {
    // Search for lyrics on LRCLib
    const response = await axios.get('https://lrclib.net/api/search', {
      params: {
        track_name: trackName,
        artist_name: artistName
      },
      timeout: 10000
    });

    if (response.data && response.data.length > 0) {
      const result = response.data[0];
      
      // Prioritize synced lyrics
      if (result.syncedLyrics) {
        console.log(`Fetched synced lyrics for: "${trackName}" by "${artistName}"`);
        
        // Parse the LRC format into lines with timestamps
        const lines = result.syncedLyrics
          .split('\n')
          .filter(line => line.trim())
          .map(line => {
            // Parse LRC format: [00:27.93] Text
            const match = line.match(/\[(\d{2}):(\d{2})\.(\d{2})\]\s*(.*)/);
            if (match) {
              const minutes = parseInt(match[1]);
              const seconds = parseInt(match[2]);
              const centiseconds = parseInt(match[3]);
              const totalMs = (minutes * 60 + seconds) * 1000 + centiseconds * 10;
              
              return {
                timeTag: `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(centiseconds).padStart(2, '0')}`,
                words: match[4],
                startTimeMs: totalMs
              };
            }
            return null;
          })
          .filter(line => line !== null);
        
        if (lines.length > 0) {
          return {
            syncType: 'LINE_SYNCED',
            lines: lines
          };
        }
      }
    }

    console.log(`Synced lyrics not found for: "${trackName}" by "${artistName}"`);
    return null;
  } catch (error) {
    console.error(`Error fetching lyrics for "${trackName}" by "${artistName}":`, error.message);
    return null;
  }
}

module.exports = {
  getLyrics
};
