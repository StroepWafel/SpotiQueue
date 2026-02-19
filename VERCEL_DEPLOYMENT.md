# Vercel Deployment Guide

## Prerequisites
- Vercel account (https://vercel.com)
- Git repository (GitHub, GitLab, or Bitbucket)

## Environment Variables

Set these in your Vercel project settings:

```
NODE_ENV=production
SPOTIFY_CLIENT_ID=your_client_id
SPOTIFY_CLIENT_SECRET=your_client_secret
SPOTIFY_REDIRECT_URI=https://your-domain.vercel.app/api/auth/callback
SPOTIFY_REFRESH_TOKEN=your_refresh_token (optional, set after first auth)
SPOTIFY_USER_ID=your_user_id (optional, set after first auth)
CLIENT_URL=https://your-domain.vercel.app
SLACK_WEBHOOK_URL=your_webhook_url (optional)
SLACK_APP_TOKEN=your_app_token (optional)
SLACK_BOT_TOKEN=your_bot_token (optional)
DB_PATH=/tmp/queue.db
```

## Deployment Steps

1. Push your code to GitHub/GitLab/Bitbucket
2. Go to https://vercel.com/new
3. Import your repository
4. Select "Other" as the framework
5. Set build command: `npm run build`
6. Set output directory: `client/build`
7. Add environment variables from above
8. Deploy

## Important Notes

- The database will be stored in `/tmp/queue.db` on Vercel (ephemeral storage)
- For persistent database, consider using a cloud database service
- The app serves the React frontend and API from the same domain
- Admin panel is at `/admin` route
- User queue page is at `/` route

## Local Development

```bash
npm install:all
npm run dev
```

- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- Admin: http://localhost:3000/admin

## Production Build

```bash
npm run build
npm start
```

Server will run on port 3000 (or PORT env variable).
