import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './DeviceManagement.css';

function DeviceManagement() {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [sortBy, setSortBy] = useState('last_queue_attempt');
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [queueHistory, setQueueHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  useEffect(() => {
    loadDevices();
    
    // Auto-refresh devices every 5 seconds
    const interval = setInterval(() => {
      loadDevices();
    }, 5000);
    
    return () => clearInterval(interval);
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

  const viewQueueHistory = async (deviceId) => {
    setHistoryLoading(true);
    setShowHistoryModal(true);
    
    try {
      const response = await axios.get(`/api/admin/devices/${deviceId}`, {
        params: { limit: 100 }
      });
      setSelectedDevice({
        ...response.data.device,
        display_id: response.data.device.id.substring(0, 8) + '...'
      });
      setQueueHistory(response.data.attempts || []);
    } catch (error) {
      console.error('Error loading queue history:', error);
      alert('Failed to load queue history');
      setShowHistoryModal(false);
    } finally {
      setHistoryLoading(false);
    }
  };

  const closeHistoryModal = () => {
    setShowHistoryModal(false);
    setSelectedDevice(null);
    setQueueHistory([]);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'success':
        return '#2e7d32';
      case 'error':
        return '#c62828';
      case 'blocked':
        return '#d32f2f';
      case 'rate_limited':
        return '#f57c00';
      case 'banned':
        return '#c62828';
      default:
        return '#666';
    }
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
                <th>Username</th>
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
                  <td className="device-username">{device.username || '-'}</td>
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
                    <button
                      className="action-button history-button"
                      onClick={() => viewQueueHistory(device.id)}
                      title="View queue history"
                    >
                      History
                    </button>
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

      {showHistoryModal && (
        <div className="history-modal-overlay" onClick={closeHistoryModal}>
          <div className="history-modal" onClick={(e) => e.stopPropagation()}>
            <div className="history-modal-header">
              <h2>Queue History</h2>
              <button className="history-modal-close" onClick={closeHistoryModal}>×</button>
            </div>
            {selectedDevice && (
              <div className="history-device-info">
                <div><strong>Device ID:</strong> {selectedDevice.display_id}</div>
                {selectedDevice.username && (
                  <div><strong>Username:</strong> {selectedDevice.username}</div>
                )}
                <div><strong>Status:</strong> {selectedDevice.status}</div>
                <div><strong>First Seen:</strong> {formatTime(selectedDevice.first_seen)}</div>
              </div>
            )}
            <div className="history-content">
              {historyLoading ? (
                <div className="loading">Loading history...</div>
              ) : queueHistory.length === 0 ? (
                <div className="no-history">No queue history found</div>
              ) : (
                <table className="history-table">
                  <thead>
                    <tr>
                      <th>Time</th>
                      <th>Track</th>
                      <th>Artist</th>
                      <th>Status</th>
                      <th>Error</th>
                    </tr>
                  </thead>
                  <tbody>
                    {queueHistory.map((attempt) => (
                      <tr key={attempt.id}>
                        <td>{formatTime(attempt.timestamp)}</td>
                        <td>{attempt.track_name || '-'}</td>
                        <td>{attempt.artist_name || '-'}</td>
                        <td>
                          <span 
                            className="history-status-badge"
                            style={{ color: getStatusColor(attempt.status) }}
                          >
                            {attempt.status.toUpperCase()}
                          </span>
                        </td>
                        <td className="history-error">
                          {attempt.error_message || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default DeviceManagement;

