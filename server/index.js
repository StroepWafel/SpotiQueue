const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');
require('dotenv').config();

const fingerprintRouter = require('./routes/fingerprint');
const queueRouter = require('./routes/queue');
const nowPlayingRouter = require('./routes/nowPlaying');
const adminRouter = require('./routes/admin');
const configRouter = require('./routes/config');
const authRouter = require('./routes/auth');
const { initDatabase } = require('./db');

const app = express();
// In development, use port 5000 for backend API (React dev server uses 3000)
// In production, use port 3000
// Check if we're in production by checking if NODE_ENV is explicitly set to 'production'
const isProduction = process.env.NODE_ENV === 'production';

// In development, ALWAYS use 5000 to avoid conflict with React dev server on 3000
// Force override any PORT from .env file in development
let PORT;
if (isProduction) {
  PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;
} else {
  // Development mode - FORCE port 5000, ignore any PORT from .env
  PORT = 5000;
  // Explicitly delete PORT from env to prevent any other code from using it
  delete process.env.PORT;
}
const ADMIN_PORT = process.env.ADMIN_PORT || 3001;

console.log(`Server mode: ${isProduction ? 'production' : 'development'}, Public port: ${PORT}, Admin port: ${ADMIN_PORT}`);

// Middleware
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());

// Initialize database
initDatabase();

// Routes
app.use('/api/fingerprint', fingerprintRouter);
app.use('/api/queue', queueRouter);
app.use('/api/now-playing', nowPlayingRouter);
app.use('/api/admin', adminRouter);
app.use('/api/config', configRouter);
app.use('/api/auth', authRouter);

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
  app.use(express.static(path.join(__dirname, '../client/build')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/build/index.html'));
  });
}

// Start public server
app.listen(PORT, () => {
  console.log(`Public server running on port ${PORT}`);
});

// Start admin server
const adminApp = express();
adminApp.use(cors({
  origin: process.env.ADMIN_CLIENT_URL || 'http://localhost:3001',
  credentials: true
}));
adminApp.use(express.json());
adminApp.use(cookieParser());

adminApp.use('/api/fingerprint', fingerprintRouter);
adminApp.use('/api/queue', queueRouter);
adminApp.use('/api/now-playing', nowPlayingRouter);
adminApp.use('/api/admin', adminRouter);
adminApp.use('/api/config', configRouter);
adminApp.use('/api/auth', authRouter);

// Root route - helpful message in development
if (!isProduction) {
  adminApp.get('/', (req, res) => {
    res.send(`
      <html>
        <head>
          <title>Spotify Queue Admin API</title>
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
            <h1>Spotify Queue Admin API</h1>
            <p>This is the admin backend API server running on port ${ADMIN_PORT}.</p>
            <p>In development, access the admin panel at:</p>
            <p><code>http://localhost:3002</code></p>
            <p>API endpoints are available at <code>/api/*</code></p>
          </div>
        </body>
      </html>
    `);
  });
}

// Serve admin panel static files in production only
if (isProduction) {
  adminApp.use(express.static(path.join(__dirname, '../admin/build')));
  adminApp.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../admin/build/index.html'));
  });
}

adminApp.listen(ADMIN_PORT, () => {
  console.log(`Admin server running on port ${ADMIN_PORT}`);
});

