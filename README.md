<img width="1920" height="960" alt="Main" src="https://github.com/user-attachments/assets/0baf3ff7-c8c8-4bc6-bd3e-55139b7ecb24" />

# A Spotify Queue App

A self-hosted web application that lets guests queue Spotify tracks to your Spotify account during events, with anti-spam controls, live "Now Playing" display, and a comprehensive admin interface.

## Disclaimer~
Artificial Intelligence (AI) assisted in commenting and cleaning the code and in the creation of all documentation. While I am against AIs replacing humans I think that this is a valid use of AI as a tool
## Features

- **Public Guest Interface**: Clean, mobile-friendly UI for queueing songs (Vite + Tailwind, dark mode)
- **Spotify Search**: Search and queue tracks directly
- **URL Input**: Paste Spotify track URLs
- **Live Now Playing**: Auto-updating display with progress bar, play/pause badge, synced lyrics
- **Display Mode** (`/display`): Full-screen party view with now playing, synced lyrics, up-next queue, voting, QR code to queue
- **Song Voting**: Optional up/down voting on queued tracks (admin-configurable)
- **Prequeue**: Optional approval flow before adding tracks to Spotify (admin-configurable)
- **Guest Auth**: Optional GitHub OAuth and/or Google OAuth for queue and voting
- **Anti-Spam Protection**: Device fingerprinting and rate limiting
- **Banned Tracks**: Block specific songs or artists
- **Explicit Content Filtering**: Option to ban explicit songs
- **Admin Panel**: Full control over devices, configuration, banned tracks, prequeue, and Spotify connection
- **Auto-Connect**: Automatic Spotify token refresh - no restart needed
- **Data Management**: Reset all data with one click
- **Process Management**: PM2 or systemd service support

## Architecture

- **Public Web App**: Port 3000 (Guest UI, Vite dev server in development)
- **Admin Panel**: Port 3002 in dev, 3001 in production (Protected admin interface)
- **Backend API**: Express.js server with SQLite (better-sqlite3), public API on port 5000 in dev, 3000 in production
- **Frontend**: React with Vite + Tailwind for both public and admin interfaces

## Prerequisites

- Node.js 18+ (for local development and production)
- Spotify Developer Account
- Spotify Premium account (required for queue functionality)
- (Optional) GitHub OAuth App and/or Google OAuth credentials for guest authentication

## Spotify Setup

### 1. Create a Spotify App

1. Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Click "Create an app"
3. Fill in app details:
   - App name: "Spotify Queue App" (or your choice)
   - App description: "Event queue management"
   - Redirect URI: `http://127.0.0.1:5000/api/auth/callback` (for development)
     - Spotify no longer allows "localhost" - you must use `127.0.0.1`
     - The port (5000) matches the backend API port in development mode
     - For production, use: `http://your-server-ip:3000/api/auth/callback` or `https://yourdomain.com/api/auth/callback` if using reverse proxy
4. Save your Client ID and Client Secret

### 2. Connect Spotify Account

The app needs a refresh token to access your Spotify account. You have two options:

#### Option A: Auto-Connect

1. Add your `SPOTIFY_CLIENT_ID` and `SPOTIFY_CLIENT_SECRET` to `.env`
2. Start the app: `npm run dev`
3. Open the admin panel: http://localhost:3002 (development) or http://localhost:3001 (production)
4. Go to the "Spotify" tab (first tab in the admin panel)
5. Click "Connect Spotify Account" button
6. Authorize the app on Spotify
7. The refresh token and user ID will be automatically saved to `.env`
8. No restart needed - the connection is active immediately

Make sure to add `http://127.0.0.1:5000/api/auth/callback` as a redirect URI in your Spotify app settings for development, or your production URL for production.

#### Option B: Manual Setup (Alternative)

If you prefer to set it up manually, here are the options:

##### Using Spotify OAuth Playground

1. Go to [Spotify OAuth Playground](https://developer.spotify.com/documentation/web-api/tutorials/code-flow)
2. Click "Get Token"
3. Select these scopes:
   - `user-read-playback-state`
   - `user-modify-playback-state`
   - `user-read-currently-playing`
4. Authorize and copy the **Refresh Token**

#### Option B: Using a Simple Script

Create a file `get-token.js`:

```javascript
const express = require('express');
const app = express();

const CLIENT_ID = 'YOUR_CLIENT_ID';
const CLIENT_SECRET = 'YOUR_CLIENT_SECRET';
const REDIRECT_URI = 'http://localhost:8888/callback';

app.get('/login', (req, res) => {
  const scopes = 'user-read-playback-state user-modify-playback-state user-read-currently-playing';
  res.redirect(`https://accounts.spotify.com/authorize?client_id=${CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=${encodeURIComponent(scopes)}`);
});

app.get('/callback', async (req, res) => {
  const code = req.query.code;
  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': 'Basic ' + Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64')
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: REDIRECT_URI
    })
  });
  const data = await response.json();
  res.send(`<h1>Success!</h1><p>Refresh Token: <code>${data.refresh_token}</code></p>`);
});

app.listen(8888, () => console.log('Go to http://localhost:8888/login'));
```

Run it and visit `http://localhost:8888/login` to get your refresh token.

##### Get Your Spotify User ID (if not using auto-connect)

1. Go to [Spotify Web Player](https://open.spotify.com)
2. Right-click on your profile → Copy link
3. The user ID is in the URL: `https://open.spotify.com/user/{USER_ID}`

## Installation

### Option 1: Direct Node.js Deployment (Recommended for Simplicity)

See [DEPLOYMENT.md](DEPLOYMENT.md) for detailed instructions on deploying without Docker.

Quick start:
```bash
# Install Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Clone and setup
git clone https://github.com/StroepWafel/SpotiQueue
cd SpotifyQueueApp
npm run install:all
npm run build

# Configure .env file
cp env.example .env
nano .env

# Run with PM2 (process manager)
sudo npm install -g pm2
pm2 start server/index.js --name spotify-queue
pm2 save
pm2 startup
```

### Option 1b: Cloudflare Tunnel (No Port Forwarding Required)

See [CLOUDFLARE_TUNNEL.md](CLOUDFLARE_TUNNEL.md) for instructions on exposing your app through Cloudflare Tunnel. This allows you to:
- Access your app without opening firewall ports
- Use free SSL certificates
- Work with dynamic IP addresses
- Get DDoS protection automatically

### Option 2: Local Development

1. Install dependencies:
```bash
npm run install:all
```

2. Set up environment variables:
```bash
cp env.example .env
# Edit .env and add SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET
# Then use the "Connect Spotify Account" button in the app to auto-fetch the refresh token
```

3. Start development servers:
```bash
npm run dev
```

This will start:
- Backend API on port 5000 (public API, serves client in production)
- Backend API on port 3001 (admin API, serves admin in production)
- Public client (Vite) on port 3000, proxying `/api` to port 5000
- Admin panel (Vite) on port 3002, proxying `/api` to port 3001

**Development ports**: Public UI 3000, Admin UI 3002, Public API 5000, Admin API 3001  
**Production**: Public API + static client on 3000, Admin API + static admin on 3001.

## Optional: Guest Authentication (GitHub & Google OAuth)

You can require guests to sign in with GitHub or Google before queueing or voting. Configure in admin → Configuration → Guest Authentication.

**GitHub OAuth:**
1. Create an OAuth App at https://github.com/settings/developers
2. Set callback URL: `http://127.0.0.1:5000/api/github/callback` (dev) or `https://your-domain.com/api/github/callback` (prod)
3. Add to `.env`: `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`

**Google OAuth:**
1. Create OAuth 2.0 credentials at https://console.cloud.google.com/apis/credentials
2. Add authorized redirect URI: `http://127.0.0.1:5000/api/google/callback` (dev) or `https://your-domain.com/api/google/callback` (prod)
3. Add to `.env`: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`

Enable the desired provider in admin Configuration. Auth is required only if at least one provider is enabled.

## Configuration

All configuration can be managed through the admin panel:
- Development: http://localhost:3002
- Production: http://localhost:3001

The admin panel has six tabs:

1. **Spotify**: Connect or reconnect your Spotify account (no restart needed)
2. **Prequeue**: Approve or decline track requests when prequeue is enabled
3. **Devices**: View and manage device fingerprints, block/unblock devices, reset cooldowns
4. **Banned Tracks**: Manage list of banned tracks
5. **Configuration**: Adjust settings:
   - Queue Management: Enable queueing, prequeue (approval required)
   - Rate Limiting: Cooldown duration, songs before cooldown
   - Song Voting: Enable/disable voting on queued tracks
   - Display Mode: Enable album aura on `/display`
   - Input Methods: Enable/disable search UI and URL input
   - Content Filtering: Ban explicit songs
   - Guest Auth: Require GitHub or Google sign-in
   - Admin Password: Change admin panel password
   - Reset All Data: Clear all devices, stats, and banned tracks (keeps configuration)
6. **Statistics**: View usage statistics and queue attempt metrics

## Usage

### For Guests

1. Open the public URL (e.g., http://localhost:3000)
2. If GitHub/Google auth is required, sign in first
3. Search for a song or paste a Spotify track URL
4. Click "Queue" to add it (or submit for approval if prequeue is enabled)
5. Wait for the cooldown period before queueing another song
6. Use **Display mode** (`/display`) for a full-screen party view with now playing, lyrics, and QR code

### For Admins

1. Access admin panel:
   - Development: http://localhost:3002
   - Production: http://localhost:3001
2. Enter admin password (default: `admin`)
3. **Spotify Tab**: Connect or reconnect your Spotify account
4. **Devices Tab**: 
   - View all devices and their status
   - Reset cooldowns for specific devices or all devices
   - Block/unblock devices
5. **Banned Tracks Tab**:
   - Add track IDs to ban list
   - Remove tracks from ban list
6. **Configuration Tab**:
   - Adjust cooldown duration
   - Enable/disable features (fingerprinting, search UI, URL input)
   - Enable/disable explicit song banning
   - Change admin password
   - Reset all data (clears devices, stats, and banned tracks)
7. **Statistics Tab**: View usage statistics and metrics

## Security Notes

- Change the default admin password immediately after first setup
- The admin panel uses HTTP Basic Auth - use HTTPS in production
- Device fingerprinting uses cookies - clearing cookies will reset the fingerprint
- Rate limiting prevents spam but can be bypassed by clearing cookies (acceptable for event use)

## Troubleshooting

### "No active Spotify device found"

- Make sure Spotify is open and playing on at least one device
- The device must be active (not paused for too long)

### "Failed to authenticate with Spotify"

- Check that your Client ID and Secret are correct in `.env`
- Verify your refresh token is valid (or reconnect through admin panel)
- Refresh tokens don't expire, but if you revoke access, you'll need to reconnect
- Use the admin panel's Spotify tab to reconnect - no restart needed

### Admin panel shows authentication error

- Default password is `admin`
- Check that you're accessing the correct port:
  - Development: http://localhost:3002
  - Production: http://localhost:3001
- Try clearing browser cache

### Now Playing not updating

- Ensure `SPOTIFY_USER_ID` is set correctly (auto-filled when connecting)
- The user must have an active playback session
- Check browser console for errors

### "Explicit songs are not allowed"

- This means content filtering is enabled in the admin panel
- Go to Configuration → Content Filtering to disable if needed
- Explicit songs are also filtered from search results when enabled

## Production Deployment on Ubuntu Server

This guide covers deploying the Spotify Queue App directly on an Ubuntu server without Docker.

### Server Specifications

#### Minimum Requirements (Small Events - up to 50 concurrent users)

- **CPU**: 1 vCPU / 1 core
- **RAM**: 512 MB - 1 GB
- **Storage**: 5 GB (SSD recommended)
- **Network**: 10 Mbps upload
- **OS**: Ubuntu 20.04 LTS or later

#### Recommended (Medium Events - up to 200 concurrent users)

- **CPU**: 2 vCPUs / 2 cores
- **RAM**: 2 GB
- **Storage**: 10 GB SSD
- **Network**: 25 Mbps upload
- **OS**: Ubuntu 22.04 LTS or later

#### Optimal (Large Events - 200+ concurrent users)

- **CPU**: 4 vCPUs / 4 cores
- **RAM**: 4 GB
- **Storage**: 20 GB SSD
- **Network**: 50+ Mbps upload
- **OS**: Ubuntu 22.04 LTS or later

#### Resource Usage Notes

- **Memory**: The application typically uses 200-400 MB RAM at idle, up to 800 MB under load
- **CPU**: Low CPU usage (5-15% on 1 core) during normal operation, spikes during Spotify API calls
- **Storage**: SQLite database grows slowly (~1 MB per 1000 queue attempts). Application files require ~200 MB
- **Network**: Minimal bandwidth usage. Most traffic is small API requests. Spotify API calls are external and don't consume server bandwidth
- **Concurrent Users**: The app handles concurrent users well due to SQLite's read performance and Express.js's async nature

#### Cloud Provider Examples

**Budget Options:**
- DigitalOcean Droplet: $6/month (1 GB RAM, 1 vCPU)
- Vultr: $6/month (1 GB RAM, 1 vCPU)
- Linode: $5/month (1 GB RAM, 1 vCPU)

**Recommended Options:**
- DigitalOcean Droplet: $12/month (2 GB RAM, 1 vCPU)
- AWS EC2 t3.small: ~$15/month (2 GB RAM, 2 vCPUs)
- Google Cloud e2-small: ~$12/month (2 GB RAM, 2 vCPUs)

**High Performance:**
- DigitalOcean Droplet: $24/month (4 GB RAM, 2 vCPUs)
- AWS EC2 t3.medium: ~$30/month (4 GB RAM, 2 vCPUs)

### Prerequisites

- Ubuntu 20.04 or later
- Root or sudo access
- Domain name (optional, recommended for HTTPS)
- Ports 3000 and 3001 available (or configure custom ports)

### Step 1: Install Node.js and PM2

```bash
# Update package index
sudo apt update

# Install Node.js 18.x
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify installation
node --version
npm --version

# Install PM2 (process manager) - MUST use npm, not apt
sudo npm install -g pm2

# Verify PM2 installation
pm2 --version
```

### Step 2: Clone and Configure the Application

```bash
# Clone the repository
git clone https://github.com/StroepWafel/SpotiQueue
cd SpotifyQueueApp

# Copy environment file
cp env.example .env

# Edit .env file
nano .env
```

Configure your `.env` file:

```env
# Spotify Credentials
SPOTIFY_CLIENT_ID=your_client_id_here
SPOTIFY_CLIENT_SECRET=your_client_secret_here
SPOTIFY_REFRESH_TOKEN=  # Will be auto-filled after connecting
SPOTIFY_USER_ID=  # Will be auto-filled after connecting

# For production, update these URLs to your domain
CLIENT_URL=http://your-domain.com:3000
ADMIN_CLIENT_URL=http://your-domain.com:3001

# Or if using reverse proxy with HTTPS:
# CLIENT_URL=https://your-domain.com
# ADMIN_CLIENT_URL=https://your-domain.com/admin

# Database path
DB_PATH=./data/queue.db

# Node environment
NODE_ENV=production
PORT=3000
ADMIN_PORT=3001
```

Update your Spotify app's redirect URI in the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard):
- For direct access: `http://your-server-ip:3000/api/auth/callback`
- For reverse proxy with HTTPS: `https://your-domain.com/api/auth/callback`

### Step 3: Build and Start the Application

```bash
# Install all dependencies
npm run install:all

# Build React applications
npm run build

# Start with PM2
pm2 start server/index.js --name spotify-queue

# Save PM2 configuration
pm2 save

# Setup PM2 to start on boot
pm2 startup
# Follow the instructions it prints

# View logs
pm2 logs spotify-queue

# Check status
pm2 status
```

### Step 4: Connect Spotify Account

1. Access the admin panel: `http://your-server-ip:3001` or `http://your-domain.com/admin`
2. Enter admin password (default: `admin`)
3. Go to the "Spotify" tab (first tab in the admin panel)
4. Click "Connect Spotify Account"
5. Authorize the app on Spotify
6. The refresh token will be automatically saved to `.env`
7. No restart needed - the connection is active immediately

### Step 5: Configure Firewall (UFW)

```bash
# Allow SSH
sudo ufw allow 22/tcp

# Allow HTTP/HTTPS (if using reverse proxy)
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Allow direct access to app ports (if not using reverse proxy)
sudo ufw allow 3000/tcp
sudo ufw allow 3001/tcp

# Enable firewall
sudo ufw enable

# Check status
sudo ufw status
```

### Step 6: Set Up Reverse Proxy with Nginx

Using a reverse proxy provides HTTPS, better security, and cleaner URLs.

#### Install Nginx

```bash
sudo apt install -y nginx
```

#### Create Nginx Configuration

```bash
sudo nano /etc/nginx/sites-available/spotify-queue
```

Add the following configuration:

```nginx
# Redirect HTTP to HTTPS
server {
    listen 80;
    server_name your-domain.com;
    
    location / {
        return 301 https://$server_name$request_uri;
    }
}

# HTTPS Configuration
server {
    listen 443 ssl http2;
    server_name your-domain.com;

    # SSL Certificate paths (see Step 7 for Let's Encrypt)
    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;
    
    # SSL Configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Public Guest UI
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Admin Panel
    location /admin {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # API endpoints
    location /api {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable the site:

```bash
sudo ln -s /etc/nginx/sites-available/spotify-queue /etc/nginx/sites-enabled/
sudo nginx -t  # Test configuration
sudo systemctl restart nginx
```

If you're using the admin panel through the reverse proxy, update your `.env`:
```env
CLIENT_URL=https://your-domain.com
ADMIN_CLIENT_URL=https://your-domain.com/admin
```

### Step 7: Set Up SSL Certificate with Let's Encrypt

```bash
# Install Certbot
sudo apt install -y certbot python3-certbot-nginx

# Obtain certificate (replace with your domain)
sudo certbot --nginx -d your-domain.com

# Certbot will automatically configure Nginx and set up auto-renewal
```

Certificates auto-renew via cron. Verify renewal:

```bash
sudo certbot renew --dry-run
```

### Step 8: Set Up Automatic Backups

Create a backup script:

```bash
sudo nano /usr/local/bin/backup-spotify-queue.sh
```

Add:

```bash
#!/bin/bash
BACKUP_DIR="/backups/spotify-queue"
SOURCE_DIR="/home/your-username/SpotifyQueueApp/data"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR
tar -czf $BACKUP_DIR/queue-db-$DATE.tar.gz -C $SOURCE_DIR queue.db

# Keep only last 30 days of backups
find $BACKUP_DIR -name "queue-db-*.tar.gz" -mtime +30 -delete

echo "Backup completed: queue-db-$DATE.tar.gz"
```

Make it executable:

```bash
sudo chmod +x /usr/local/bin/backup-spotify-queue.sh
```

Add to crontab (daily at 2 AM):

```bash
sudo crontab -e
```

Add:

```
0 2 * * * /usr/local/bin/backup-spotify-queue.sh
```

### Step 9: Useful PM2 Commands

```bash
# View logs
pm2 logs spotify-queue

# Restart the application
pm2 restart spotify-queue

# Stop the application
pm2 stop spotify-queue

# Start the application
pm2 start spotify-queue

# View status
pm2 status

# Monitor resources
pm2 monit

# View detailed info
pm2 show spotify-queue
```

### Step 11: Security Checklist

- [ ] Changed default admin password
- [ ] Set up HTTPS with valid SSL certificate
- [ ] Configured firewall (UFW) properly
- [ ] Set up automatic backups
- [ ] Updated Spotify redirect URIs to production URLs
- [ ] PM2 configured to start on boot
- [ ] Regularly update application: `git pull && npm run build && pm2 restart spotify-queue`

### Troubleshooting Production Issues

#### Application won't start

```bash
# Check PM2 logs
pm2 logs spotify-queue

# Check if ports are in use
sudo netstat -tulpn | grep -E '3000|3001'

# Verify .env file
cat .env

# Check PM2 status
pm2 status

# Try starting manually to see errors
node server/index.js
```

#### Database permissions

```bash
# Ensure data directory is writable
sudo chown -R $USER:$USER ./data
chmod -R 755 ./data
```

#### Nginx 502 Bad Gateway

- Verify application is running: `pm2 status`
- Check Nginx can reach the app: `curl http://localhost:3000`
- Verify proxy_pass URLs in Nginx config
- Check application logs: `pm2 logs spotify-queue`

#### Spotify OAuth not working

- Verify redirect URI matches exactly in Spotify Developer Dashboard
- For development: `http://127.0.0.1:5000/api/auth/callback`
- For production: `http://your-server-ip:3000/api/auth/callback` or `https://yourdomain.com/api/auth/callback`
- Check `.env` has correct `CLIENT_URL` and `ADMIN_CLIENT_URL`
- Ensure ports are accessible (or use reverse proxy)
- Use the admin panel's Spotify tab to connect - no restart needed after connecting

### Alternative: Using IP Address Instead of Domain

If you don't have a domain name:

1. Skip Nginx reverse proxy setup
2. Access directly via IP: `http://your-server-ip:3000` (public) and `http://your-server-ip:3001` (admin)
3. Update Spotify redirect URI to: `http://your-server-ip:3000/api/auth/callback`
4. HTTPS won't be available without a domain
5. Update `.env` file:
   ```env
   CLIENT_URL=http://your-server-ip:3000
   ADMIN_CLIENT_URL=http://your-server-ip:3001
   ```

### Production Deployment Checklist

1. Node.js 18+ installed
2. PM2 installed and configured
3. Application cloned and configured
4. Dependencies installed (`npm run install:all`)
5. React apps built (`npm run build`)
6. `.env` file configured with Spotify credentials
7. Application started with PM2
8. PM2 configured to start on boot
9. Spotify account connected
10. Firewall configured
11. Reverse proxy set up (optional)
12. SSL certificate installed (if using domain)
13. Backups configured
14. Admin password changed
15. Tested all functionality

## License

MIT

## Support

For issues or questions, please open an issue on GitHub.


## Gallery:

queue page with no song:

<img width="773" height="714" alt="no song" src="https://github.com/user-attachments/assets/58cc4236-92bd-41b7-9610-7a79b5942f4a" />

queue page with song and search:

<img width="764" height="1268" alt="song+search" src="https://github.com/user-attachments/assets/bb494c9c-657d-4e6f-bfe8-e96beafa8ef8" />

admin panel on spotify page:

<img width="1110" height="638" alt="admin-main" src="https://github.com/user-attachments/assets/3e3e1df0-2d99-4537-8045-8d7c420584d7" />

admin panel on devices page:

<img width="1097" height="399" alt="admin-devices" src="https://github.com/user-attachments/assets/1b21f8b0-6702-4cfe-8259-c0697a4c5041" />

admin panel on banned tracks page:

<img width="1105" height="674" alt="admin-tracks" src="https://github.com/user-attachments/assets/513295cf-4b67-4aaa-815a-cb60cddc1b3c" />

admin panel on config page:

<img width="1108" height="1278" alt="admin-conf" src="https://github.com/user-attachments/assets/e90a255f-0cc4-471c-8ef0-29d64e96bd62" />

admin panel on statistics page:

<img width="1107" height="624" alt="admin-stats" src="https://github.com/user-attachments/assets/39dc0432-3712-402a-854f-2ebc3df11fea" />
