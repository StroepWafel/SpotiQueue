const axios = require('axios');

/**
 * Parse LRC synced text: [offset:±ms], [mm:ss.xx] / [m:ss.xxx] (2 = centiseconds, 3 = milliseconds).
 */
function parseSyncedLyrics(syncedLyricsText) {
  const rawLines = syncedLyricsText.split(/\r?\n/)
  let globalOffsetMs = 0
  const rows = []

  for (const line of rawLines) {
    const trimmed = line.trim()
    if (!trimmed) continue

    const offsetMatch = trimmed.match(/^\[offset:([+-]?\d+)\]/i)
    if (offsetMatch) {
      globalOffsetMs = parseInt(offsetMatch[1], 10)
      continue
    }

    const match = trimmed.match(/^\[(\d{1,2}):(\d{2})(?:\.(\d{2,3}))?\]\s*(.*)$/)
    if (!match) continue

    const minutes = parseInt(match[1], 10)
    const seconds = parseInt(match[2], 10)
    const fracPart = match[3]
    const text = (match[4] || '').trim()
    if (!text) continue

    let fracMs = 0
    if (fracPart != null && fracPart.length > 0) {
      if (fracPart.length === 3) {
        fracMs = parseInt(fracPart, 10)
      } else {
        fracMs = parseInt(fracPart, 10) * 10
      }
    }

    const totalMs = (minutes * 60 + seconds) * 1000 + fracMs + globalOffsetMs

    rows.push({
      timeTag: `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${fracPart ? String(fracPart).padStart(fracPart.length === 3 ? 3 : 2, '0') : '00'}`,
      words: text,
      startTimeMs: totalMs
    })
  }

  rows.sort((a, b) => a.startTimeMs - b.startTimeMs)
  return rows
}

async function getLyrics(trackName, artistName, trackId) {
  if (!trackName || !artistName) {
    return null
  }

  try {
    const response = await axios.get('https://lrclib.net/api/search', {
      params: {
        track_name: trackName,
        artist_name: artistName
      },
      timeout: 10000
    })

    if (response.data && response.data.length > 0) {
      const result = response.data[0]

      if (result.syncedLyrics) {
        const lines = parseSyncedLyrics(result.syncedLyrics)
        if (lines.length > 0) {
          return {
            syncType: 'LINE_SYNCED',
            lines
          }
        }
      }
    }

    return null
  } catch (error) {
    return null
  }
}

module.exports = {
  getLyrics
}
