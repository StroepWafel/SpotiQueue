import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './Stats.css';

function Stats() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
    const interval = setInterval(loadStats, 5000); // Refresh every 5 seconds
    return () => clearInterval(interval);
  }, []);

  const loadStats = async () => {
    try {
      const response = await axios.get('/api/admin/stats');
      setStats(response.data);
      setLoading(false);
    } catch (error) {
      console.error('Error loading stats:', error);
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="loading">Loading statistics...</div>;
  }

  if (!stats) {
    return <div className="error">Failed to load statistics</div>;
  }

  const successRate = stats.queue_attempts.total > 0
    ? ((stats.queue_attempts.successful / stats.queue_attempts.total) * 100).toFixed(1)
    : 0;

  return (
    <div className="stats">
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon">DEVICES</div>
          <div className="stat-value">{stats.devices.total}</div>
          <div className="stat-label">Total Devices</div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">ACTIVE</div>
          <div className="stat-value">{stats.devices.active}</div>
          <div className="stat-label">Active Devices</div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">BLOCKED</div>
          <div className="stat-value">{stats.devices.blocked}</div>
          <div className="stat-label">Blocked Devices</div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">COOLDOWN</div>
          <div className="stat-value">{stats.devices.cooling_down}</div>
          <div className="stat-label">In Cooldown</div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">ATTEMPTS</div>
          <div className="stat-value">{stats.queue_attempts.total}</div>
          <div className="stat-label">Total Queue Attempts</div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">SUCCESS</div>
          <div className="stat-value">{stats.queue_attempts.successful}</div>
          <div className="stat-label">Successful Queues</div>
        </div>

        <div className="stat-card stat-card-wide">
          <div className="stat-icon">RATE</div>
          <div className="stat-value">{successRate}%</div>
          <div className="stat-label">Success Rate</div>
        </div>
      </div>
    </div>
  );
}

export default Stats;

