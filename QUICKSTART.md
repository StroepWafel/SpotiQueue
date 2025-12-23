# Quick Start Guide

## Prerequisites

- Node.js 18+ installed
- Spotify Premium account
- Spotify Developer account

## 5-Minute Setup

### 1. Get Spotify Credentials (2 minutes)

1. Go to https://developer.spotify.com/dashboard
2. Create a new app
3. Copy your Client ID and Client Secret
4. Add redirect URI: `http://127.0.0.1:5000/api/auth/callback`
   - Spotify no longer allows "localhost" - you must use `127.0.0.1`
5. Add these to your `.env` file:
   ```
   SPOTIFY_CLIENT_ID=your_client_id
   SPOTIFY_CLIENT_SECRET=your_client_secret
   ```

The refresh token will be auto-fetched when you click "Connect Spotify Account" in the app.

### 2. Install and Configure

**Windows:**
```bash
setup.bat
```

**Mac/Linux:**
```bash
chmod +x setup.sh
./setup.sh
```

Then edit `.env` and add your credentials.

### 3. Run

**Development:**
```bash
npm run dev
```

This starts:
- Backend API servers on ports 3000 (public) and 3001 (admin)
- Public UI on port 3000 (via React dev server proxy)
- Admin panel on port 3002 (proxies API calls to port 3001)

In development, admin panel runs on port 3002. In production, it's on port 3001.

**Production (Docker):**
```bash
docker-compose up -d
```

Access:
- Public: http://localhost:3000
- Admin: http://localhost:3001 (password: `admin`)

## First Use

1. Open the public UI (http://localhost:3000)
2. Click "Connect Spotify Account" if you haven't already
   - Authorize the app on Spotify
   - The refresh token will be automatically saved
   - Restart the server after connecting
3. Start Spotify on any device (phone, computer, etc.)
4. Play a song to activate a device
5. Search and queue a song
6. Check admin panel (http://localhost:3002 in dev, http://localhost:3001 in production) to see devices and manage settings

## Common Issues

**"No active device found"**
→ Make sure Spotify is playing on at least one device

**"Failed to authenticate"**
→ Check your Client ID, Secret, and Refresh Token in `.env`

**Admin panel won't load**
→ Default password is `admin`
→ Development: http://localhost:3002
→ Production: http://localhost:3001

## Next Steps

- Change admin password in admin panel → Configuration
- Adjust cooldown duration (default: 5 minutes)
- Add banned tracks to prevent troll songs
- Customize the UI colors/styles if desired

