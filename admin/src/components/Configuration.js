import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './Configuration.css';

function Configuration() {
  const [config, setConfig] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [messageType, setMessageType] = useState('success');

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const response = await axios.get('/api/config');
      setConfig(response.data.config);
      setLoading(false);
    } catch (error) {
      console.error('Error loading config:', error);
      setLoading(false);
    }
  };

  const updateConfig = async (key, value) => {
    try {
      await axios.put(`/api/config/${key}`, { value });
      setConfig({ ...config, [key]: value });
      setMessage('Configuration updated successfully!');
      setMessageType('success');
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      alert('Failed to update configuration');
    }
  };

  const saveAll = async () => {
    setSaving(true);
    try {
      await axios.put('/api/config', config);
      setMessage('All configuration saved successfully!');
      setMessageType('success');
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      alert('Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (key, value) => {
    setConfig({ ...config, [key]: value });
  };

  if (loading) {
    return <div className="loading">Loading configuration...</div>;
  }

  return (
    <div className="configuration">
      {message && (
        <div className={`message ${messageType === 'success' ? 'message-success' : 'message-error'}`}>{message}</div>
      )}

      <div className="config-section" style={{ border: '2px solid #1a1a1a', backgroundColor: '#fafafa' }}>
        <h2 style={{ color: '#1a1a1a', marginBottom: '10px' }}>Queue Management</h2>
        <div className="config-item">
          <label>
            <input
              type="checkbox"
              checked={config.queueing_enabled !== 'false'}
              onChange={(e) => handleChange('queueing_enabled', e.target.checked ? 'true' : 'false')}
            />
            Enable Queueing
          </label>
          <button
            onClick={() => updateConfig('queueing_enabled', config.queueing_enabled || 'true')}
            className="save-button"
          >
            Save
          </button>
        </div>
        <p style={{ marginTop: '10px', fontSize: '0.9rem', color: '#666', fontStyle: 'italic' }}>
          When disabled, all queue requests and search functionality will be blocked. This is useful for temporarily pausing the queue system.
        </p>
      </div>

      <div className="config-section">
        <h2>Rate Limiting</h2>
        <div className="config-item">
          <label>
            Cooldown Duration (seconds):
            <input
              type="number"
              value={config.cooldown_duration || '300'}
              onChange={(e) => handleChange('cooldown_duration', e.target.value)}
              min="0"
              className="config-input"
            />
          </label>
          <button
            onClick={() => updateConfig('cooldown_duration', config.cooldown_duration)}
            className="save-button"
          >
            Save
          </button>
        </div>

        <div className="config-item">
          <label>
            Songs Before Cooldown:
            <input
              type="number"
              value={config.songs_before_cooldown || '1'}
              onChange={(e) => handleChange('songs_before_cooldown', e.target.value)}
              min="1"
              className="config-input"
            />
          </label>
          <button
            onClick={() => updateConfig('songs_before_cooldown', config.songs_before_cooldown || '1')}
            className="save-button"
          >
            Save
          </button>
        </div>
        <p style={{ marginTop: '10px', fontSize: '0.9rem', color: '#666', fontStyle: 'italic' }}>
          Number of songs a user can queue before the cooldown period starts. For example, if set to 3, users can queue 3 songs before needing to wait for the cooldown duration.
        </p>

        <div className="config-item">
          <label>
            <input
              type="checkbox"
              checked={config.fingerprinting_enabled === 'true'}
              onChange={(e) => handleChange('fingerprinting_enabled', e.target.checked ? 'true' : 'false')}
            />
            Enable Fingerprinting & Cooldown
          </label>
          <button
            onClick={() => updateConfig('fingerprinting_enabled', config.fingerprinting_enabled)}
            className="save-button"
          >
            Save
          </button>
        </div>
      </div>

      <div className="config-section">
        <h2>Input Methods</h2>
        <div className="config-item">
          <label>
            <input
              type="checkbox"
              checked={config.search_ui_enabled === 'true'}
              onChange={(e) => handleChange('search_ui_enabled', e.target.checked ? 'true' : 'false')}
            />
            Enable Search UI
          </label>
          <button
            onClick={() => updateConfig('search_ui_enabled', config.search_ui_enabled)}
            className="save-button"
          >
            Save
          </button>
        </div>

        <div className="config-item">
          <label>
            <input
              type="checkbox"
              checked={config.url_input_enabled === 'true'}
              onChange={(e) => handleChange('url_input_enabled', e.target.checked ? 'true' : 'false')}
            />
            Enable URL Input
          </label>
          <button
            onClick={() => updateConfig('url_input_enabled', config.url_input_enabled)}
            className="save-button"
          >
            Save
          </button>
        </div>
      </div>

      <div className="config-section">
        <h2>Content Filtering</h2>
        <div className="config-item">
          <label>
            <input
              type="checkbox"
              checked={config.ban_explicit === 'true'}
              onChange={(e) => handleChange('ban_explicit', e.target.checked ? 'true' : 'false')}
            />
            Ban Explicit Songs
          </label>
          <button
            onClick={() => updateConfig('ban_explicit', config.ban_explicit)}
            className="save-button"
          >
            Save
          </button>
        </div>
        <p style={{ marginTop: '10px', fontSize: '0.9rem', color: '#666', fontStyle: 'italic' }}>
          When enabled, songs marked as explicit by Spotify will be blocked from being queued.
        </p>
      </div>

      <div className="config-section">
        <h2>User Identification</h2>
        <div className="config-item">
          <label>
            <input
              type="checkbox"
              checked={config.require_username === 'true'}
              onChange={(e) => handleChange('require_username', e.target.checked ? 'true' : 'false')}
            />
            Require Username on First Visit
          </label>
          <button
            onClick={() => updateConfig('require_username', config.require_username || 'false')}
            className="save-button"
          >
            Save
          </button>
        </div>
        <p style={{ marginTop: '10px', fontSize: '0.9rem', color: '#666', fontStyle: 'italic' }}>
          When enabled, users will be prompted to enter a username before they can queue songs. This helps identify users in the device management panel.
        </p>
      </div>

      <div className="config-section">
        <h2>Security</h2>
        <div className="config-item">
          <label>
            Admin Password:
            <input
              type="password"
              value={config.admin_password || ''}
              onChange={(e) => handleChange('admin_password', e.target.value)}
              className="config-input"
              placeholder="Enter new password"
            />
          </label>
          <button
            onClick={() => updateConfig('admin_password', config.admin_password)}
            className="save-button"
          >
            Save
          </button>
        </div>
        <div className="config-item">
          <label>
            Admin Panel Redirect URL:
            <input
              type="text"
              value={config.admin_panel_url || ''}
              onChange={(e) => handleChange('admin_panel_url', e.target.value)}
              className="config-input"
              placeholder="https://admin.url.com"
            />
          </label>
          <button
            onClick={() => updateConfig('admin_panel_url', config.admin_panel_url || '')}
            className="save-button"
          >
            Save
          </button>
        </div>
        <p style={{ marginTop: '10px', fontSize: '0.9rem', color: '#666', fontStyle: 'italic' }}>
          Full URL for the "Go to Admin Panel" button after Spotify authorization (e.g., https://admin.url.com). If left empty, it will redirect to "ChangeURLInSettings.com" as a placeholder.
        </p>
      </div>

      <div className="config-actions">
        <button
          onClick={saveAll}
          className="save-all-button"
          disabled={saving}
        >
          {saving ? 'Saving...' : 'Save All Changes'}
        </button>
      </div>

      <div className="config-section" style={{ borderTop: '2px solid #e0e0e0', marginTop: '40px', paddingTop: '30px' }}>
        <h2 style={{ color: '#c62828' }}>Danger Zone</h2>
        <div className="config-item">
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', marginBottom: '10px', fontWeight: 500 }}>
              Reset All Data
            </label>
            <p style={{ fontSize: '0.9rem', color: '#666', marginBottom: '15px' }}>
              This will permanently delete all devices, statistics, and banned tracks. 
              Configuration settings will be preserved. This action cannot be undone.
            </p>
          </div>
          <button
            onClick={async () => {
              if (!window.confirm('Are you sure you want to reset all data? This will delete all devices, stats, and banned tracks. This action cannot be undone.')) {
                return;
              }
              if (!window.confirm('This is your final warning. All data will be permanently deleted. Continue?')) {
                return;
              }
              
              try {
                await axios.post('/api/admin/reset-all-data');
                setMessage('All data has been reset successfully.');
                setMessageType('success');
                setTimeout(() => setMessage(null), 5000);
              } catch (error) {
                alert('Failed to reset data: ' + (error.response?.data?.error || error.message));
              }
            }}
            className="reset-all-data-button"
          >
            Reset All Data
          </button>
        </div>
      </div>
    </div>
  );
}

export default Configuration;

