import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import './App.css';

// Client components
import NowPlaying from './components/NowPlaying';
import QueueForm from './components/QueueForm';
import Queue from './components/Queue';

// Admin components
import DeviceManagement from './components/DeviceManagement';
import BannedTracks from './components/BannedTracks';
import Configuration from './components/Configuration';
import Stats from './components/Stats';
import SpotifyConnect from './components/SpotifyConnect';
import QueueManagement from './components/QueueManagement';
import PrequeueManagement from './components/PrequeueManagement';

axios.defaults.withCredentials = true;

// Client page
function ClientPage() {
  const [fingerprintId, setFingerprintId] = useState(null);
  const [nowPlaying, setNowPlaying] = useState(null);
  const [loading, setLoading] = useState(true);
  const [requiresUsername, setRequiresUsername] = useState(false);
  const [username, setUsername] = useState('');
  const [usernameError, setUsernameError] = useState('');

  useEffect(() => {
    // Generate fingerprint on mount
    axios.post('/api/fingerprint/generate')
      .then(response => {
        setFingerprintId(response.data.fingerprint_id);
        setRequiresUsername(response.data.requires_username || false);
        setLoading(false);
      })
      .catch(error => {
        if (error.response?.data?.requires_username) {
          setRequiresUsername(true);
          setLoading(false);
        } else {
          console.error('Error generating fingerprint:', error);
          setLoading(false);
        }
      });

    // Poll for now playing
    const updateNowPlaying = () => {
      axios.get('/api/now-playing')
        .then(response => {
          setNowPlaying(response.data.track);
        })
        .catch(error => {
          console.error('Error fetching now playing:', error);
        });
    };

    updateNowPlaying();
    const interval = setInterval(updateNowPlaying, 3000);

    return () => clearInterval(interval);
  }, []);

  const handleUsernameSubmit = async (e) => {
    e.preventDefault();
    setUsernameError('');

    if (!username.trim()) {
      setUsernameError('Please enter a username');
      return;
    }

    if (username.length > 50) {
      setUsernameError('Username must be 50 characters or less');
      return;
    }

    try {
      const response = await axios.post('/api/fingerprint/generate', {
        username: username.trim()
      });
      setFingerprintId(response.data.fingerprint_id);
      setRequiresUsername(false);
    } catch (error) {
      setUsernameError(error.response?.data?.error || 'Failed to set username');
    }
  };

  if (loading) {
    return (
      <div className="app">
        <div className="loading">Loading...</div>
      </div>
    );
  }

  if (requiresUsername) {
    return (
      <div className="app">
        <div className="container">
          <div className="username-modal">
            <h1 className="title">Welcome!</h1>
            <p className="username-prompt">Please enter your name to continue:</p>
            <form onSubmit={handleUsernameSubmit} className="username-form">
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Your name"
                className="username-input"
                maxLength={50}
                autoFocus
              />
              {usernameError && (
                <div className="username-error">{usernameError}</div>
              )}
              <button type="submit" className="username-submit">
                Continue
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app client-page">
      <div className="container">
        <div className="main-content">
          <div className="left-section">
            <h1 className="title">Queue a Song</h1>
            <NowPlaying track={nowPlaying} />
            <QueueForm fingerprintId={fingerprintId} />
          </div>
          <div className="right-section">
            <Queue />
          </div>
        </div>
      </div>
    </div>
  );
}

// Admin page
function AdminPage() {
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
    <div className="app admin-page">
      <div className="admin-container">
        <header className="admin-header">
          <h1>SpotiQueue Admin</h1>
          <Link to="/" className="back-link">← Back to Queue</Link>
        </header>

        <nav className="admin-nav">
          <button
            className={activeTab === 'spotify' ? 'active' : ''}
            onClick={() => setActiveTab('spotify')}
          >
            Spotify
          </button>
          <button
            className={activeTab === 'prequeue' ? 'active' : ''}
            onClick={() => setActiveTab('prequeue')}
          >
            Prequeue
          </button>
          <button
            className={activeTab === 'queue' ? 'active' : ''}
            onClick={() => setActiveTab('queue')}
          >
            Queue
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
          {activeTab === 'prequeue' && <PrequeueManagement />}
          {activeTab === 'queue' && <QueueManagement />}
          {activeTab === 'devices' && <DeviceManagement />}
          {activeTab === 'banned' && <BannedTracks />}
          {activeTab === 'config' && <Configuration />}
          {activeTab === 'stats' && <Stats />}
        </main>
      </div>
    </div>
  );
}

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<ClientPage />} />
        <Route path="/admin" element={<AdminPage />} />
      </Routes>
    </Router>
  );
}

export default App;

