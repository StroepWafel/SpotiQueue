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

  useEffect(() => {
    // Generate fingerprint on mount
    axios.post('/api/fingerprint/generate')
      .then(response => {
        setFingerprintId(response.data.fingerprint_id);
        setLoading(false);
      })
      .catch(error => {
        console.error('Error generating fingerprint:', error);
        setLoading(false);
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

  if (loading) {
    return (
      <div className="app">
        <div className="loading">Loading...</div>
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

