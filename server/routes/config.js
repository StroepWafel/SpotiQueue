const express = require('express');
const basicAuth = require('express-basic-auth');
const { getConfig, setConfig, getAllConfig } = require('../utils/config');

const router = express.Router();

// Basic auth middleware (dynamic password)
const authMiddleware = (req, res, next) => {
  const password = getConfig('admin_password') || 'admin';
  const auth = basicAuth({
    users: { admin: password },
    challenge: true,
    realm: 'Admin Area'
  });
  return auth(req, res, next);
};

// Public config endpoint (no auth required)
router.get('/public/:key', (req, res) => {
  const { key } = req.params;
  const value = getConfig(key);
  
  if (value === null) {
    return res.status(404).json({ error: 'Config key not found' });
  }
  
  res.json({ key, value });
});

// Get all config
router.get('/', authMiddleware, (req, res) => {
  const config = getAllConfig();
  res.json({ config });
});

// Get specific config value
router.get('/:key', authMiddleware, (req, res) => {
  const { key } = req.params;
  const value = getConfig(key);
  
  if (value === null) {
    return res.status(404).json({ error: 'Config key not found' });
  }
  
  res.json({ key, value });
});

// Update config
router.put('/:key', authMiddleware, (req, res) => {
  const { key } = req.params;
  const { value } = req.body;
  
  if (value === undefined) {
    return res.status(400).json({ error: 'Value required' });
  }
  
  setConfig(key, String(value));
  res.json({ success: true, key, value });
});

// Update multiple config values
router.put('/', authMiddleware, (req, res) => {
  const updates = req.body;
  
  if (!updates || typeof updates !== 'object') {
    return res.status(400).json({ error: 'Config object required' });
  }
  
  Object.entries(updates).forEach(([key, value]) => {
    setConfig(key, String(value));
  });
  
  res.json({ success: true, config: getAllConfig() });
});

module.exports = router;

