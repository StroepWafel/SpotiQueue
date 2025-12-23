import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './DeviceManagement.css';

function DeviceManagement() {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [sortBy, setSortBy] = useState('last_queue_attempt');

  useEffect(() => {
    loadDevices();
  }, [filter, sortBy]);

  const loadDevices = async () => {
    try {
      const params = {};
      if (filter !== 'all') {
        params.status = filter;
      }
      params.sort = sortBy;

      const response = await axios.get('/api/admin/devices', { params });
      setDevices(response.data.devices);
      setLoading(false);
    } catch (error) {
      console.error('Error loading devices:', error);
      setLoading(false);
    }
  };

  const resetCooldown = async (deviceId) => {
    try {
      await axios.post(`/api/admin/devices/${deviceId}/reset-cooldown`);
      loadDevices();
    } catch (error) {
      alert('Failed to reset cooldown');
    }
  };

  const blockDevice = async (deviceId) => {
    if (!window.confirm('Are you sure you want to block this device?')) return;

    try {
      await axios.post(`/api/admin/devices/${deviceId}/block`);
      loadDevices();
    } catch (error) {
      alert('Failed to block device');
    }
  };

  const unblockDevice = async (deviceId) => {
    try {
      await axios.post(`/api/admin/devices/${deviceId}/unblock`);
      loadDevices();
    } catch (error) {
      alert('Failed to unblock device');
    }
  };

  const resetAllCooldowns = async () => {
    if (!window.confirm('Reset cooldowns for all devices?')) return;

    try {
      await axios.post('/api/admin/devices/reset-all-cooldowns');
      loadDevices();
    } catch (error) {
      alert('Failed to reset cooldowns');
    }
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return 'Never';
    const date = new Date(timestamp * 1000);
    return date.toLocaleString();
  };

  const formatDuration = (seconds) => {
    if (!seconds) return '0s';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  if (loading) {
    return <div className="loading">Loading devices...</div>;
  }

  return (
    <div className="device-management">
      <div className="device-controls">
        <div className="filters">
          <label>Filter:</label>
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="all">All Devices</option>
            <option value="active">Active</option>
            <option value="blocked">Blocked</option>
          </select>

          <label>Sort by:</label>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
            <option value="last_queue_attempt">Last Activity</option>
            <option value="first_seen">First Seen</option>
            <option value="cooldown_expires">Cooldown Expiry</option>
          </select>
        </div>

        <button className="reset-all-button" onClick={resetAllCooldowns}>
          Reset All Cooldowns
        </button>
      </div>

      <div className="device-list">
        {devices.length === 0 ? (
          <div className="no-devices">No devices found</div>
        ) : (
          <table className="devices-table">
            <thead>
              <tr>
                <th>Device ID</th>
                <th>Status</th>
                <th>First Seen</th>
                <th>Last Activity</th>
                <th>Cooldown</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {devices.map((device) => (
                <tr key={device.id}>
                  <td className="device-id">{device.display_id}</td>
                  <td>
                    <span className={`status-badge status-${device.status}`}>
                      {device.status === 'blocked' ? 'BLOCKED' : 'ACTIVE'}
                    </span>
                    {device.is_cooling_down && (
                      <span className="cooldown-badge">COOLING DOWN</span>
                    )}
                  </td>
                  <td>{formatTime(device.first_seen)}</td>
                  <td>{formatTime(device.last_queue_attempt)}</td>
                  <td>
                    {device.is_cooling_down
                      ? formatDuration(device.cooldown_remaining)
                      : 'None'}
                  </td>
                  <td className="actions">
                    {device.status === 'blocked' ? (
                      <button
                        className="action-button unblock-button"
                        onClick={() => unblockDevice(device.id)}
                      >
                        Unblock
                      </button>
                    ) : (
                      <>
                        <button
                          className="action-button reset-button"
                          onClick={() => resetCooldown(device.id)}
                          disabled={!device.is_cooling_down}
                        >
                          Reset Cooldown
                        </button>
                        <button
                          className="action-button block-button"
                          onClick={() => blockDevice(device.id)}
                        >
                          Block
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export default DeviceManagement;

