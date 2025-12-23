# Troubleshooting Guide

## Search Not Working

### "Failed to search tracks" Error

**Possible Causes:**

1. **Missing or Invalid Spotify Credentials**
   - Check your `.env` file has:
     - `SPOTIFY_CLIENT_ID`
     - `SPOTIFY_CLIENT_SECRET`
   - Verify credentials are correct (no extra spaces, quotes, etc.)

2. **Invalid Refresh Token**
   - If you see "Invalid refresh token" error:
     - Get a new refresh token (see README.md)
     - Update `SPOTIFY_REFRESH_TOKEN` in `.env`
     - Restart the server

3. **Server Not Running**
   - Make sure the backend server is running
   - Check console for error messages

**How to Debug:**
1. Check server console logs for detailed error messages
2. Verify `.env` file exists and has correct values
3. Test Spotify API credentials manually:
   ```bash
   curl -X POST "https://accounts.spotify.com/api/token" \
     -H "Content-Type: application/x-www-form-urlencoded" \
     -d "grant_type=client_credentials&client_id=YOUR_CLIENT_ID&client_secret=YOUR_CLIENT_SECRET"
   ```

## URL Format Issues

### What URL Format to Use

The app accepts these Spotify URL formats:

1. **Web URL:**
   ```
   https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC
   ```

2. **Spotify URI:**
   ```
   spotify:track:4uLU6hMCjMI75M1A2tKUQC
   ```

3. **Short URL (also works):**
   ```
   https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC?si=...
   ```

**How to Get a Track URL:**
1. Open Spotify (web or app)
2. Right-click on a track
3. Select "Share" → "Copy link" or "Copy Spotify URI"
4. Paste into the URL input field

**Common Issues:**
- Album URLs won't work (only track URLs)
- Playlist URLs won't work (only track URLs)
- Track URLs from web player work
- Track URIs from mobile app work

## Authentication Errors

### "Spotify authentication failed"

**Check:**
1. `.env` file exists in project root
2. All required variables are set:
   - `SPOTIFY_CLIENT_ID`
   - `SPOTIFY_CLIENT_SECRET`
   - `SPOTIFY_REFRESH_TOKEN` (optional but recommended)
3. No quotes around values in `.env`:
   ```
   SPOTIFY_CLIENT_ID=abc123
   SPOTIFY_CLIENT_ID="abc123"  # Don't use quotes
   ```
4. Restart server after changing `.env`

## Queue Not Working

### "No active Spotify device found"

**Solution:**
1. Open Spotify on any device (phone, computer, web player)
2. **Start playing a song** (don't just have it paused)
3. Keep Spotify open and playing
4. Try queueing again

### "This device is blocked"

**Solution:**
1. Go to admin panel
2. Find your device in the Devices list
3. Click "Unblock Device"

### "Please wait before queueing another song!"

**Solution:**
- Wait for the cooldown period to expire (default: 5 minutes)
- Or go to admin panel and reset cooldown for your device

## Admin Panel Issues

### Can't Access Admin Panel

**Development:**
- URL: http://localhost:3002
- Default password: `admin`

**Production:**
- URL: http://localhost:3001
- Default password: `admin`

**If password doesn't work:**
- Check server logs for authentication errors
- Verify admin password in database/config

## General Debugging Tips

1. **Check Server Logs:**
   - Look at the terminal where `npm run dev` is running
   - Error messages will show what's wrong

2. **Check Browser Console:**
   - Open browser DevTools (F12)
   - Look at Console tab for errors
   - Check Network tab for failed API calls

3. **Verify Environment Variables:**
   ```bash
   # Windows PowerShell
   Get-Content .env
   
   # Linux/Mac
   cat .env
   ```

4. **Test API Endpoints:**
   ```bash
   # Test search (replace with your server URL)
   curl -X POST http://localhost:3000/api/queue/search \
     -H "Content-Type: application/json" \
     -d '{"query":"test"}'
   ```

## Still Having Issues?

1. Check the main README.md for setup instructions
2. Verify all prerequisites are installed
3. Make sure Spotify Premium account is active
4. Check that ports 3000, 3001, and 3002 are not in use by other apps

