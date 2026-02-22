# Project Structure

```
SpotifyQueueApp/
├── server/                 # Backend Express.js server
│   ├── index.js           # Main server file (runs both public & admin servers)
│   ├── db.js              # SQLite database (better-sqlite3)
│   ├── routes/
│   │   ├── fingerprint.js # Fingerprint generation and validation
│   │   ├── queue.js       # Queue management (search, add, vote, current)
│   │   ├── nowPlaying.js  # Current track with lyrics
│   │   ├── admin.js       # Admin panel API (devices, banned tracks, stats)
│   │   ├── config.js      # Configuration management API
│   │   ├── auth.js        # Spotify OAuth
│   │   ├── github-auth.js # GitHub OAuth (optional)
│   │   ├── google-auth.js # Google OAuth (optional)
│   │   └── prequeue.js    # Prequeue moderation
│   └── utils/
│       ├── config.js      # Config read/write utilities
│       ├── spotify.js     # Spotify API integration
│       ├── lyrics.js      # LRCLib API, LRC parsing
│       └── guest-auth.js  # Guest OAuth requirements
│
├── client/                 # Public guest UI (React + Vite + Tailwind)
│   ├── src/
│   │   ├── App.jsx        # Main app (queue UI, auth gate)
│   │   ├── main.jsx       # Entry, routes / and /display
│   │   ├── components/
│   │   │   ├── NowPlaying.jsx   # Now playing with progress, lyrics
│   │   │   ├── QueueForm.jsx   # Search and queue interface
│   │   │   ├── Queue.jsx       # Up next list with voting
│   │   │   ├── Display.jsx     # Full-screen party view (/display)
│   │   │   └── ui/             # Button, Card, Input, etc.
│   │   └── hooks/
│   │       └── useAuraColor.js # Album art dominant color
│   └── package.json
│
├── admin/                  # Admin panel UI (React + Vite + Tailwind)
│   ├── src/
│   │   ├── App.jsx        # Main admin app
│   │   ├── components/
│   │   │   ├── DeviceManagement.jsx
│   │   │   ├── BannedTracks.jsx
│   │   │   ├── Configuration.jsx
│   │   │   ├── PrequeueManagement.jsx
│   │   │   └── Stats.js
│   │   └── ui/            # Shared UI primitives
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

### Public UI (React + Vite + Tailwind)
- Modern, mobile-friendly design with dark mode
- Live "Now Playing" with progress bar, play/pause badge, synced lyrics
- Display mode (`/display`): Full-screen party view, lyrics, up next, vote counts, QR code
- Spotify search and URL input
- Song voting when enabled
- Optional GitHub/Google OAuth gate
- Vite dev server, static build in `client/build`

### Admin Panel (React + Vite + Tailwind)
- Device management (view, block, reset cooldowns)
- Prequeue management (approve/decline when prequeue enabled)
- Banned tracks management
- Configuration (prequeue, voting, OAuth, aura, etc.)
- Statistics dashboard
- Protected with HTTP Basic Auth

### Docker Support
- Multi-stage Dockerfile
- Docker Compose configuration
- Volume mounting for database persistence
- Environment variable configuration

## API Endpoints

### Public API (Port 5000 dev, 3000 prod)
- `POST /api/fingerprint/generate` - Generate device fingerprint
- `POST /api/queue/search` - Search Spotify tracks
- `POST /api/queue/add` - Queue a track (or prequeue submit when enabled)
- `GET /api/queue/current` - Queue with now playing (cached)
- `GET /api/queue/votes` - Vote counts when voting enabled
- `POST /api/queue/vote` - Toggle vote on a track
- `GET /api/now-playing` - Currently playing track with lyrics
- `GET /api/config/public` - Public config (prequeue_enabled, voting_enabled, aura_enabled)
- `GET /api/github/login`, `/api/github/callback`, `/api/github/status`
- `GET /api/google/login`, `/api/google/callback`, `/api/google/status`

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

### prequeue
- `id` (TEXT PRIMARY KEY)
- `fingerprint_id`, `track_id`, `track_name`, `artist_name`, `album_art`
- `status` (TEXT) - 'pending', 'approved', 'declined'
- `approved_by` (TEXT) - Admin who approved/declined
- `created_at` (INTEGER)

### votes
- `id` (INTEGER PRIMARY KEY)
- `track_id` (TEXT), `fingerprint_id` (TEXT)
- `created_at` (INTEGER)

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

