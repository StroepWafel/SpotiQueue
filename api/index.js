const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
require('dotenv').config();

const fingerprintRouter = require('../server/routes/fingerprint');
const queueRouter = require('../server/routes/queue');
const prequeueRouter = require('../server/routes/prequeue');
const nowPlayingRouter = require('../server/routes/nowPlaying');
const adminRouter = require('../server/routes/admin');
const configRouter = require('../server/routes/config');
const authRouter = require('../server/routes/auth');
const { initDatabase } = require('../server/db');
const { initSlackSocketMode } = require('../server/utils/slack');

const app = express();

// Disable strict host checking for Cloudflare Tunnel
app.set('trust proxy', true);

// Middleware
app.use(cors({
  origin: process.env.CLIENT_URL || '*',
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());

// Initialize database
initDatabase();

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

module.exports = app;
