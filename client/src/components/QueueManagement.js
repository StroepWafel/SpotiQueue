import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './QueueManagement.css';

function QueueManagement() {
  const [queue, setQueue] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchQueue();
    const interval = setInterval(fetchQueue, 30000); // Update every 30 seconds instead of 5
    return () => clearInterval(interval);
  }, []);

  const fetchQueue = async () => {
    try {
      const response = await axios.get('/api/queue/current');
      setQueue(response.data);
      setError(null);
    } catch (err) {
      setError('Failed to fetch queue');
      console.error('Queue error:', err);
    } finally {
      setLoading(false);
    }
  };

  const deleteFromQueue = async (trackUri) => {
    try {
      // Spotify doesn't have a direct delete endpoint, so we'll need to use the player API
      // For now, we'll show a message that this requires manual removal
      alert('To remove this track, you need to manually remove it from Spotify or use the Spotify app.');
    } catch (err) {
      setError('Failed to delete track');
      console.error('Delete error:', err);
    }
  };

  if (loading) {
    return <div className="queue-management"><div className="loading">Loading queue...</div></div>;
  }

  if (error) {
    return <div className="queue-management"><div className="error">{error}</div></div>;
  }

  if (!queue || queue.queue.length === 0) {
    return (
      <div className="queue-management">
        <h2>Queue Management</h2>
        <div className="empty">No songs in queue</div>
      </div>
    );
  }

  return (
    <div className="queue-management">
      <h2>Queue Management</h2>
      
      {queue.currently_playing && (
        <div className="now-playing-section">
          <h3>Now Playing</h3>
          <div className="now-playing-item">
            {queue.currently_playing.album_art && (
              <img src={queue.currently_playing.album_art} alt={queue.currently_playing.album} />
            )}
            <div className="item-info">
              <div className="item-name">{queue.currently_playing.name}</div>
              <div className="item-artist">{queue.currently_playing.artists}</div>
            </div>
          </div>
        </div>
      )}

      <div className="queue-section">
        <h3>Upcoming ({queue.queue.length})</h3>
        <div className="queue-list">
          {queue.queue.map((track, index) => (
            <div key={`${track.uri}-${index}`} className="queue-item">
              <div className="item-number">{index + 1}</div>
              {track.album_art && (
                <img src={track.album_art} alt={track.album} className="item-art" />
              )}
              <div className="item-info">
                <div className="item-name">{track.name}</div>
                <div className="item-artist">{track.artists}</div>
              </div>
              <div className="item-duration">
                {Math.floor(track.duration_ms / 60000)}:
                {String(Math.floor((track.duration_ms % 60000) / 1000)).padStart(2, '0')}
              </div>
              <button
                className="delete-btn"
                onClick={() => deleteFromQueue(track.uri)}
                title="Remove from queue"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default QueueManagement;
