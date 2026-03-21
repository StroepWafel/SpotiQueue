const express = require('express');
const { getConfig, setConfig, getAllConfig } = require('../utils/config');
const { requireAdminSession } = require('../middleware/adminSession');

const router = express.Router();

// Public config (no auth) - for client to know prequeue, voting, aura, etc.
router.get('/public', (req, res) => {
  const queueUrl = getConfig('queue_url') || process.env.CLIENT_URL || '';
  res.json({
    prequeue_enabled: getConfig('prequeue_enabled') === 'true',
    voting_enabled: getConfig('voting_enabled') === 'true',
    voting_auto_promote: getConfig('voting_auto_promote') === 'true',
    voting_downvote_enabled: getConfig('voting_downvote_enabled') !== 'false',
    aura_enabled: getConfig('aura_enabled') === 'true',
    queue_url: queueUrl
  });
});

// Get all config
router.get('/', requireAdminSession, (req, res) => {
  const config = getAllConfig();
  res.json({ config });
});

// Get specific config value
router.get('/:key', requireAdminSession, (req, res) => {
  const { key } = req.params;
  const value = getConfig(key);
  
  if (value === null) {
    return res.status(404).json({ error: 'Config key not found' });
  }
  
  res.json({ key, value });
});

// Update config
router.put('/:key', requireAdminSession, (req, res) => {
  const { key } = req.params;
  const { value } = req.body;
  
  if (value === undefined) {
    return res.status(400).json({ error: 'Value required' });
  }
  
  setConfig(key, String(value));
  res.json({ success: true, key, value });
});

// Update multiple config values
router.put('/', requireAdminSession, (req, res) => {
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

