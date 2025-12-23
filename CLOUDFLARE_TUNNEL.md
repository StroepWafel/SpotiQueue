# Cloudflare Tunnel Setup Guide

Cloudflare Tunnel (formerly Argo Tunnel) allows you to expose your Spotify Queue App to the internet through Cloudflare's network without opening ports on your firewall or dealing with dynamic IP addresses.

## Benefits

- No port forwarding required
- Works behind NAT/firewall
- Free SSL/TLS certificates
- DDoS protection
- Works with dynamic IP addresses
- No need to expose your server's IP

## Prerequisites

- Cloudflare account (free tier works)
- Domain name added to Cloudflare
- Server running the Spotify Queue App

## Setup Methods

You can set up Cloudflare Tunnel using either:
- **Web Interface** (Easier, recommended) - See Option A below
- **Command Line** (More control) - See Option B below

---

## Option A: Web Interface Setup (Recommended)

This method uses Cloudflare's Zero Trust dashboard, which is easier and doesn't require editing config files.

### Step 1: Install cloudflared on Your Server

On your Ubuntu server:

```bash
# Download cloudflared
wget https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb

# Install
sudo dpkg -i cloudflared-linux-amd64.deb

# Verify installation
cloudflared --version
```

### Step 2: Create Tunnel via Web Interface

1. **Go to Cloudflare Zero Trust Dashboard:**
   - Visit: https://one.dash.cloudflare.com/
   - Or: Cloudflare Dashboard → Zero Trust → Networks → Tunnels

2. **Create a Tunnel:**
   - Click "Create a tunnel"
   - Select "Cloudflared" as the connector
   - Name it: `spotify-queue`
   - Click "Save tunnel"

3. **Copy the Installation Command:**
   - After creating the tunnel, you'll see a command like:
     ```bash
     cloudflared service install <token>
     ```
   - Copy this entire command

4. **Run the Installation Command on Your Server:**
   ```bash
   # Paste the command from Cloudflare dashboard
   sudo cloudflared service install <your-token>
   ```
   
   This will:
   - Install cloudflared as a systemd service
   - Configure it to connect to your tunnel
   - Start the service automatically

### Step 3: Configure Public Routes (Public Guest UI)

1. **In the Cloudflare Tunnel dashboard:**
   - Click on your `spotify-queue` tunnel
   - Go to the "Published Application routes" tab
   - Click "Add a published application route"

2. **Configure Public UI Route:**
   - **Subdomain:** `@` (or leave blank for root domain)
   - **Domain:** Select your domain
   - **Service:** `http://localhost:3000` (if cloudflared runs on host) OR `http://192.168.1.101:3000` (if cloudflared runs in Docker)
   - Click "Save"
   
   **Important:** If cloudflared is running in Docker, use your server's IP address (`192.168.1.101`) instead of `localhost`. See troubleshooting section below.

### Step 4: Configure Admin Panel Route

1. **Add Another Public Hostname:**
   - Still in the "Published application route" tab
   - Click "Add a published application route" again

2. **Configure Admin Route:**
   - **Subdomain:** `admin`
   - **Domain:** Select your domain
   - **Service:** `http://localhost:3001` (if cloudflared runs on host) OR `http://192.168.1.101:3001` (if cloudflared runs in Docker)
   - Click "Save"
   
   **Important:** If cloudflared is running in Docker, use your server's IP address (`192.168.1.101`) instead of `localhost`.

   **Alternative - Path-Based Routing (Single Domain):**
   - If you prefer `your-domain.com/admin` instead of `admin.your-domain.com`:
   - **Subdomain:** `@` (root domain)
   - **Path:** `/admin*`
   - **Service:** `http://localhost:3001`
   - Then add another route for API:
     - **Subdomain:** `@`
     - **Path:** `/api/*`
     - **Service:** `http://localhost:3001`

### Step 5: Verify Tunnel is Running

On your server:

```bash
# Check if cloudflared service is running
sudo systemctl status cloudflared

# View logs
sudo journalctl -u cloudflared -f
```

You should see the tunnel connecting successfully.

### Step 6: Update Application Configuration

Update your `.env` file:

```bash
nano ~/SpotifyQueueApp/.env
```

Set:

```env
NODE_ENV=production
PORT=3000
ADMIN_PORT=3001

# Use your Cloudflare domain
CLIENT_URL=https://your-domain.com
ADMIN_CLIENT_URL=https://admin.your-domain.com
# Or if using path-based routing:
# ADMIN_CLIENT_URL=https://your-domain.com/admin

# Update Spotify redirect URI
SPOTIFY_REDIRECT_URI=https://your-domain.com/api/auth/callback
```

### Step 7: Update Spotify Redirect URI

**IMPORTANT:** The redirect URI in your `.env` file (`SPOTIFY_REDIRECT_URI`) must exactly match one of the redirect URIs registered in your Spotify Developer Dashboard.

In your [Spotify Developer Dashboard](https://developer.spotify.com/dashboard):

1. Go to your app settings
2. Click "Edit Settings"
3. Under "Redirect URIs", add: `https://your-domain.com/api/auth/callback`
   - Replace `your-domain.com` with your actual Cloudflare domain
   - Make sure it matches exactly what's in your `.env` file
4. Click "Add"
5. Click "Save"

**Common Issues:**
- If you get "INVALID_CLIENT: Invalid redirect URI", the URI in your `.env` doesn't match what's registered in Spotify
- The redirect URI must match exactly (including `https://` vs `http://`, domain name, and path)
- You can register multiple redirect URIs if needed

### Step 8: Restart Your Application

```bash
# Restart PM2 to pick up new environment variables
pm2 restart spotify-queue

# Or if using systemd
sudo systemctl restart spotify-queue
```

### Step 9: Test Access

1. **Public UI:** `https://your-domain.com`
2. **Admin Panel:** `https://admin.your-domain.com` (or `https://your-domain.com/admin`)

---

## Option B: Command Line Setup (Advanced)

This method gives you more control but requires editing config files manually.

### Step 1: Install cloudflared

## Step 9: Verify Everything Works

1. **Check tunnel status:**
   ```bash
   sudo systemctl status cloudflared
   ```

2. **Access your app:**
   - Public UI: `https://your-domain.com`
   - Admin Panel: `https://admin.your-domain.com` (or `https://your-domain.com/admin`)

3. **Test Spotify connection:**
   - Go to admin panel
   - Navigate to Spotify tab
   - Click "Connect Spotify Account"
   - Should redirect to Spotify and back

## Troubleshooting

### Tunnel won't start

```bash
# Check logs
sudo journalctl -u cloudflared -n 50

# Verify config file syntax
cloudflared tunnel --config /etc/cloudflared/config.yml ingress validate

# Test tunnel manually
cloudflared tunnel --config /etc/cloudflared/config.yml run
```

### DNS not resolving

- Verify DNS records in Cloudflare dashboard
- Ensure CNAME points to `<tunnel-id>.cfargotunnel.com`
- Check proxy status is enabled (orange cloud)
- Wait a few minutes for DNS propagation

### 502 Bad Gateway / Connection Refused

- Verify your app is running: `pm2 status`
- Check app is listening on localhost: `netstat -tulpn | grep -E '3000|3001'`
- Verify tunnel config service URLs are correct
- Check app logs: `pm2 logs spotify-queue`

### "Connection Refused" Error (Docker)

If cloudflared is running in Docker and you see `dial tcp [::1]:3000: connect: connection refused`:

**Problem:** Docker containers can't access `localhost` on the host. `localhost` inside a container refers to the container itself, not the host machine.

**Solution:** Use your server's IP address instead of `localhost`:

1. **In Cloudflare Tunnel dashboard:**
   - Go to your tunnel → Published Application routes
   - Edit the route for `queue.stroepwafel.au`
   - Change Service from `http://localhost:3000` to `http://192.168.1.101:3000`
   - Edit the route for `admin.stroepwafel.au`
   - Change Service from `http://localhost:3001` to `http://192.168.1.101:3001`
   - Save both changes

2. **Verify your app is listening on all interfaces:**
   ```bash
   # Check if app is listening on 0.0.0.0 (all interfaces) or just 127.0.0.1
   netstat -tulpn | grep -E '3000|3001'
   ```
   
   If it shows `127.0.0.1:3000`, you may need to configure your app to listen on `0.0.0.0` instead. However, Express.js by default listens on all interfaces, so this should already be the case.

**Alternative Solutions:**

- **Use Host Network Mode:** Run cloudflared container with `--network host` (reduces container isolation)
- **Use Docker Bridge Gateway:** Use `172.17.0.1` (Docker's default bridge IP) instead of localhost

**Recommended:** Use the host IP address (`192.168.1.101`) - it's the simplest and most reliable solution.

### SSL Certificate Issues

- Cloudflare Tunnel automatically provides SSL certificates
- No manual certificate setup needed
- If you see SSL errors, check DNS is properly configured

## Updating Tunnel Configuration

After changing `/etc/cloudflared/config.yml`:

```bash
# Restart the service
sudo systemctl restart cloudflared

# Verify it's running
sudo systemctl status cloudflared
```

## Security Considerations

1. **Admin Panel Access:**
   - Consider using Cloudflare Access (Zero Trust) to protect admin panel
   - Or use a strong admin password
   - Or restrict admin subdomain to specific IPs via Cloudflare firewall rules

2. **Firewall:**
   - You don't need to open ports 3000/3001 on your firewall
   - The tunnel connects outbound to Cloudflare
   - Only SSH port needs to be open (if accessing remotely)

3. **Rate Limiting:**
   - Cloudflare provides DDoS protection automatically
   - Consider enabling rate limiting in Cloudflare dashboard for additional protection

## Cloudflare Access (Optional - Additional Security)

To add authentication to your admin panel:

1. Go to Cloudflare Dashboard → Zero Trust
2. Create an Access application
3. Set application URL: `https://admin.your-domain.com`
4. Configure authentication (email, Google, etc.)
5. Add policy rules

This adds an extra authentication layer before users can access the admin panel.

## Useful Commands

```bash
# List tunnels
cloudflared tunnel list

# View tunnel info
cloudflared tunnel info spotify-queue

# Delete tunnel (if needed)
cloudflared tunnel delete spotify-queue

# View tunnel logs
sudo journalctl -u cloudflared -f
```

## Advantages Over Direct Port Forwarding

- No need to configure router/firewall
- Works with dynamic IP addresses
- Free SSL certificates
- DDoS protection included
- Can hide your server's real IP
- Easy to set up multiple services

