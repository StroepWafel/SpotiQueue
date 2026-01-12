import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css';
import NowPlaying from './components/NowPlaying';
import QueueForm from './components/QueueForm';

axios.defaults.withCredentials = true;

function App() {
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
    const interval = setInterval(updateNowPlaying, 3000); // Update every 3 seconds

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
    <div className="app">
      <div className="container">
        <h1 className="title">Queue a Song</h1>
        <NowPlaying track={nowPlaying} />
        <QueueForm fingerprintId={fingerprintId} />
      </div>
    </div>
  );
}

export default App;

