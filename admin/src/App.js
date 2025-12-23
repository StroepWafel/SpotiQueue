import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css';
import DeviceManagement from './components/DeviceManagement';
import BannedTracks from './components/BannedTracks';
import Configuration from './components/Configuration';
import Stats from './components/Stats';
import SpotifyConnect from './components/SpotifyConnect';

axios.defaults.withCredentials = true;

function App() {
  const [activeTab, setActiveTab] = useState('spotify');
  const [authError, setAuthError] = useState(false);

  useEffect(() => {
    // Test auth on mount
    axios.get('/api/admin/stats')
      .catch(error => {
        if (error.response?.status === 401) {
          setAuthError(true);
        }
      });
  }, []);

  if (authError) {
    return (
      <div className="app">
        <div className="auth-error">
          <h2>Authentication Required</h2>
          <p>Please enter your admin credentials when prompted.</p>
          <button onClick={() => window.location.reload()}>Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <div className="admin-container">
        <header className="admin-header">
          <h1>Spotify Queue Admin</h1>
        </header>

        <nav className="admin-nav">
          <button
            className={activeTab === 'spotify' ? 'active' : ''}
            onClick={() => setActiveTab('spotify')}
          >
            Spotify
          </button>
          <button
            className={activeTab === 'devices' ? 'active' : ''}
            onClick={() => setActiveTab('devices')}
          >
            Devices
          </button>
          <button
            className={activeTab === 'banned' ? 'active' : ''}
            onClick={() => setActiveTab('banned')}
          >
            Banned Tracks
          </button>
          <button
            className={activeTab === 'config' ? 'active' : ''}
            onClick={() => setActiveTab('config')}
          >
            Configuration
          </button>
          <button
            className={activeTab === 'stats' ? 'active' : ''}
            onClick={() => setActiveTab('stats')}
          >
            Statistics
          </button>
        </nav>

        <main className="admin-content">
          {activeTab === 'spotify' && <SpotifyConnect />}
          {activeTab === 'devices' && <DeviceManagement />}
          {activeTab === 'banned' && <BannedTracks />}
          {activeTab === 'config' && <Configuration />}
          {activeTab === 'stats' && <Stats />}
        </main>
      </div>
    </div>
  );
}

export default App;

