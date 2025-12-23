# Project Structure

```
SpotifyQueueApp/
├── server/                 # Backend Express.js server
│   ├── index.js           # Main server file (runs both public & admin servers)
│   ├── db.js              # SQLite database setup and initialization
│   ├── routes/
│   │   ├── fingerprint.js # Fingerprint generation and validation
│   │   ├── queue.js       # Queue management (search, add tracks)
│   │   ├── nowPlaying.js  # Current track information
│   │   ├── admin.js       # Admin panel API (devices, banned tracks, stats)
│   │   └── config.js      # Configuration management API
│   └── utils/
│       ├── config.js      # Config read/write utilities
│       └── spotify.js     # Spotify API integration
│
├── client/                 # Public guest UI (React)
│   ├── public/
│   ├── src/
│   │   ├── App.js         # Main app component
│   │   ├── components/
│   │   │   ├── NowPlaying.js  # Now playing display
│   │   │   └── QueueForm.js  # Search and queue interface
│   │   └── index.js
│   └── package.json
│
├── admin/                  # Admin panel UI (React)
│   ├── public/
│   ├── src/
│   │   ├── App.js         # Main admin app
│   │   ├── components/
│   │   │   ├── DeviceManagement.js  # Device/fingerprint management
│   │   │   ├── BannedTracks.js      # Banned tracks management
│   │   │   ├── Configuration.js     # Settings management
│   │   │   └── Stats.js             # Statistics dashboard
│   │   └── index.js
│   └── package.json
│
├── data/                   # SQLite database (created at runtime)
│   └── queue.db           # Database file
│
├── Dockerfile              # Docker container definition
├── docker-compose.yml     # Docker Compose configuration
├── package.json           # Root package.json with scripts
├── .env                   # Environment variables (create from env.example)
├── env.example            # Example environment file
├── README.md              # Full documentation
├── QUICKSTART.md          # Quick start guide
└── setup.sh / setup.bat   # Setup scripts
```

## Key Features Implemented

### Backend (Express.js)
- Dual server setup (public port 3000, admin port 3001)
- SQLite database with fingerprint tracking
- Spotify API integration (search, queue, now playing)
- Device fingerprinting system
- Rate limiting with configurable cooldowns
- Device blocking/unblocking
- Banned tracks management
- Runtime configuration management
- Basic auth for admin panel

### Public UI (React)
- Modern, mobile-friendly design
- Live "Now Playing" display with album art
- Spotify search interface
- URL input for direct track links
- User feedback for queue status
- Auto-updating now playing (3s polling)

### Admin Panel (React)
- Device management (view, block, reset cooldowns)
- Banned tracks management
- Configuration interface
- Statistics dashboard
- Protected with HTTP Basic Auth

### Docker Support
- Multi-stage Dockerfile
- Docker Compose configuration
- Volume mounting for database persistence
- Environment variable configuration

## API Endpoints

### Public API (Port 3000)
- `POST /api/fingerprint/generate` - Generate device fingerprint
- `POST /api/fingerprint/validate` - Validate fingerprint
- `POST /api/queue/search` - Search Spotify tracks
- `POST /api/queue/add` - Queue a track
- `GET /api/now-playing` - Get currently playing track

### Admin API (Port 3001, requires auth)
- `GET /api/admin/devices` - List all devices
- `POST /api/admin/devices/:id/reset-cooldown` - Reset device cooldown
- `POST /api/admin/devices/:id/block` - Block device
- `POST /api/admin/devices/:id/unblock` - Unblock device
- `GET /api/admin/banned-tracks` - List banned tracks
- `POST /api/admin/banned-tracks` - Ban a track
- `DELETE /api/admin/banned-tracks/:trackId` - Unban a track
- `GET /api/admin/stats` - Get statistics
- `GET /api/config` - Get all configuration
- `PUT /api/config/:key` - Update configuration value

## Database Schema

### fingerprints
- `id` (TEXT PRIMARY KEY) - Unique fingerprint ID
- `first_seen` (INTEGER) - First seen timestamp
- `last_queue_attempt` (INTEGER) - Last queue attempt timestamp
- `cooldown_expires` (INTEGER) - Cooldown expiry timestamp
- `status` (TEXT) - 'active' or 'blocked'

### queue_attempts
- `id` (INTEGER PRIMARY KEY)
- `fingerprint_id` (TEXT) - Foreign key to fingerprints
- `track_id` (TEXT) - Spotify track ID
- `track_name` (TEXT) - Track name
- `artist_name` (TEXT) - Artist name
- `status` (TEXT) - 'success', 'error', 'blocked', 'rate_limited', 'banned'
- `error_message` (TEXT) - Error message if failed
- `timestamp` (INTEGER) - Attempt timestamp

### banned_tracks
- `id` (INTEGER PRIMARY KEY)
- `track_id` (TEXT UNIQUE) - Spotify track ID
- `artist_id` (TEXT) - Optional artist ID
- `reason` (TEXT) - Ban reason
- `created_at` (INTEGER) - Ban timestamp

### config
- `key` (TEXT PRIMARY KEY) - Config key
- `value` (TEXT) - Config value
- `updated_at` (INTEGER) - Last update timestamp

