# Non-Docker Deployment Guide

This guide covers deploying the Spotify Queue App directly on an Ubuntu server without Docker.

## Prerequisites

- Ubuntu 20.04 or later
- Node.js 18+ installed
- npm installed
- Root or sudo access

## Step 1: Install Node.js

```bash
# Install Node.js 18.x
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify installation
node --version
npm --version
```

## Step 2: Clone and Setup

```bash
# Clone repository
git clone <repository-url>
cd SpotifyQueueApp

# Install all dependencies
npm run install:all
```

## Step 3: Build Frontend Applications

```bash
# Build client and admin React apps
npm run build
```

This creates:
- `client/build/` - Public guest UI
- `admin/build/` - Admin panel UI

## Step 4: Configure Environment

```bash
# Copy example env file
cp env.example .env

# Edit .env file
nano .env
```

Configure your `.env`:

```env
# Server Configuration
NODE_ENV=production
PORT=3000
ADMIN_PORT=3001
CLIENT_URL=http://your-domain.com:3000
ADMIN_CLIENT_URL=http://your-domain.com:3001

# Spotify Credentials
SPOTIFY_CLIENT_ID=your_client_id
SPOTIFY_CLIENT_SECRET=your_client_secret
SPOTIFY_REFRESH_TOKEN=
SPOTIFY_USER_ID=

# Database Path
DB_PATH=./data/queue.db
```

## Step 5: Run with PM2 (Recommended)

PM2 is a process manager that keeps your app running and restarts it if it crashes.

### Install PM2

```bash
# PM2 is an npm package, NOT an apt package
# You must install it using npm after installing Node.js
sudo npm install -g pm2

# Verify installation
pm2 --version
```

### Start the Application

```bash
# Start the app
pm2 start server/index.js --name spotify-queue

# Save PM2 configuration
pm2 save

# Setup PM2 to start on boot
pm2 startup
# Follow the instructions it prints
```

### PM2 Useful Commands

```bash
# View status
pm2 status

# View logs
pm2 logs spotify-queue

# Restart app
pm2 restart spotify-queue

# Stop app
pm2 stop spotify-queue

# Monitor
pm2 monit
```

## Step 6: Alternative - Systemd Service

If you prefer systemd over PM2:

### Create Service File

```bash
sudo nano /etc/systemd/system/spotify-queue.service
```

Add:

```ini
[Unit]
Description=Spotify Queue App
After=network.target

[Service]
Type=simple
User=your-username
WorkingDirectory=/path/to/SpotifyQueueApp
Environment=NODE_ENV=production
ExecStart=/usr/bin/node server/index.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

### Enable and Start

```bash
# Reload systemd
sudo systemctl daemon-reload

# Enable service (start on boot)
sudo systemctl enable spotify-queue

# Start service
sudo systemctl start spotify-queue

# Check status
sudo systemctl status spotify-queue

# View logs
sudo journalctl -u spotify-queue -f
```

## Step 7: Configure Firewall

```bash
# Allow ports
sudo ufw allow 3000/tcp
sudo ufw allow 3001/tcp

# Enable firewall
sudo ufw enable
```

## Step 8: Set Up Reverse Proxy (Optional but Recommended)

### Install Nginx

```bash
sudo apt install -y nginx
```

### Create Nginx Configuration

```bash
sudo nano /etc/nginx/sites-available/spotify-queue
```

Add:

```nginx
# Redirect HTTP to HTTPS
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}

# HTTPS Configuration
server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;
    
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

Enable site:

```bash
sudo ln -s /etc/nginx/sites-available/spotify-queue /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

## Step 9: Connect Spotify Account

1. Access admin panel: `http://your-server-ip:3001` or `https://your-domain.com/admin`
2. Enter admin password (default: `admin`)
3. Go to Spotify tab
4. Click "Connect Spotify Account"
5. Authorize on Spotify
6. No restart needed - connection is active immediately

## Updating the Application

```bash
# Pull latest changes
git pull

# Rebuild frontend
npm run build

# Restart application
pm2 restart spotify-queue
# OR
sudo systemctl restart spotify-queue
```

## Troubleshooting

### App won't start

```bash
# Check if ports are in use
sudo netstat -tulpn | grep -E '3000|3001'

# Check logs
pm2 logs spotify-queue
# OR
sudo journalctl -u spotify-queue -n 50
```

### Permission errors

```bash
# Ensure data directory is writable
chmod -R 755 ./data
chown -R $USER:$USER ./data
```

### Build errors

```bash
# Clean and rebuild
rm -rf client/build admin/build node_modules client/node_modules admin/node_modules
npm run install:all
npm run build
```

## Advantages of Non-Docker Deployment

- Simpler setup - no Docker knowledge required
- Easier debugging - direct access to logs and processes
- Lower resource usage - no container overhead
- Faster startup - no container initialization
- Direct file access - easier to backup database

## Disadvantages

- Requires Node.js installed on server
- Manual dependency management
- More setup steps
- No container isolation

