const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');
require('dotenv').config();

const fingerprintRouter = require('./routes/fingerprint');
const queueRouter = require('./routes/queue');
const prequeueRouter = require('./routes/prequeue');
const nowPlayingRouter = require('./routes/nowPlaying');
const adminRouter = require('./routes/admin');
const configRouter = require('./routes/config');
const authRouter = require('./routes/auth');
const githubAuthRouter = require('./routes/github-auth');
const { initDatabase } = require('./db');
const { initSlackSocketMode } = require('./utils/slack');

const app = express();

// Disable strict host checking for Cloudflare Tunnel
app.set('trust proxy', true);

// In development, use port 8000 for backend API
// In production, use port 3000
const isProduction = process.env.NODE_ENV === 'production';

let PORT;
if (isProduction) {
  PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;
} else {
  PORT = 8000;
  delete process.env.PORT;
}

console.log(`Server mode: ${isProduction ? 'production' : 'development'}, Port: ${PORT}`);

// Middleware to handle Cloudflare Tunnel Host header
app.use((req, res, next) => {
  next();
});

// Middleware
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());

// Initialize database and start server
async function startServer() {
  try {
    await initDatabase();
    
    // Initialize Slack Socket Mode
    initSlackSocketMode();

    // Routes
    app.use('/api/fingerprint', fingerprintRouter);
    app.use('/api/queue', queueRouter);
    app.use('/api/prequeue', prequeueRouter);
    app.use('/api/now-playing', nowPlayingRouter);
    app.use('/api/admin', adminRouter);
    app.use('/api/config', configRouter);
    app.use('/api/auth', authRouter);
    app.use('/api/github', githubAuthRouter);

    // Root route - helpful message in development
    if (!isProduction) {
      app.get('/', (req, res) => {
        res.send(`
          <html>
            <head>
              <title>Spotify Queue API</title>
              <style>
                body {
                  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  min-height: 100vh;
                  margin: 0;
                  background: #f5f5f5;
                  color: #212121;
                }
                .container {
                  text-align: center;
                  padding: 40px;
                  background: white;
                  border-radius: 8px;
                  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                  max-width: 500px;
                }
                h1 { margin-top: 0; }
                code {
                  background: #f5f5f5;
                  padding: 2px 6px;
                  border-radius: 4px;
                  font-family: monospace;
                }
              </style>
            </head>
            <body>
              <div class="container">
                <h1>Spotify Queue API</h1>
                <p>This is the backend API server running on port ${PORT}.</p>
                <p>In development, access the frontend at:</p>
                <p><code>http://localhost:3000</code></p>
                <p>API endpoints are available at <code>/api/*</code></p>
              </div>
            </body>
          </html>
        `);
      });
    }

    // Serve static files in production only
    if (isProduction) {
      app.use(express.static(path.join(__dirname, '../client/dist')));
      app.get('*', (req, res) => {
        res.sendFile(path.join(__dirname, '../client/dist/index.html'));
      });
    }

    // Start server
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

