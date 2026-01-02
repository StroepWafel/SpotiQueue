import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './QueueForm.css';

function QueueForm({ fingerprintId }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [urlInput, setUrlInput] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isQueueing, setIsQueueing] = useState(false);
  const [message, setMessage] = useState(null);
  const [messageType, setMessageType] = useState(null);
  const [inputMethod, setInputMethod] = useState('search'); // 'search' or 'url'
  const [config] = useState({ search_ui_enabled: 'true', url_input_enabled: 'true' });

  useEffect(() => {
    // Fetch config to determine available input methods
    // Note: This endpoint requires auth, so we'll default to both enabled
    // In production, you might want a public config endpoint
  }, []);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setMessage(null);

    try {
      const response = await axios.post('/api/queue/search', {
        query: searchQuery
      });
      setSearchResults(response.data.tracks);
    } catch (error) {
      setMessage(error.response?.data?.error || 'Failed to search tracks');
      setMessageType('error');
    } finally {
      setIsSearching(false);
    }
  };

  const handleQueueTrack = async (trackId) => {
    setIsQueueing(true);
    setMessage(null);
    // Keep search results and query - don't clear them

    try {
      const response = await axios.post('/api/queue/add', {
        fingerprint_id: fingerprintId,
        track_id: trackId
      });

      setMessage(response.data.message || 'Track queued successfully!');
      setMessageType('success');
    } catch (error) {
      const errorMsg = error.response?.data?.error || 'Failed to queue track';
      setMessage(errorMsg);
      setMessageType('error');
    } finally {
      setIsQueueing(false);
    }
  };

  const handleQueueUrl = async (e) => {
    e.preventDefault();
    if (!urlInput.trim()) return;

    setIsQueueing(true);
    setMessage(null);

    try {
      const response = await axios.post('/api/queue/add', {
        fingerprint_id: fingerprintId,
        track_url: urlInput
      });

      setMessage(response.data.message || 'Track queued successfully!');
      setMessageType('success');
      setUrlInput('');
    } catch (error) {
      const errorMsg = error.response?.data?.error || 'Failed to queue track';
      setMessage(errorMsg);
      setMessageType('error');
    } finally {
      setIsQueueing(false);
    }
  };

  return (
    <div className="queue-form">
      {message && (
        <div className={`message message-${messageType}`}>
          {message}
        </div>
      )}

      <div className="input-tabs">
        {config.search_ui_enabled !== 'false' && (
          <button
            className={`tab ${inputMethod === 'search' ? 'active' : ''}`}
            onClick={() => setInputMethod('search')}
          >
            Search
          </button>
        )}
        {config.url_input_enabled !== 'false' && (
          <button
            className={`tab ${inputMethod === 'url' ? 'active' : ''}`}
            onClick={() => setInputMethod('url')}
          >
            Paste URL
          </button>
        )}
      </div>

      {inputMethod === 'search' && (
        <div className="search-section">
          <form onSubmit={handleSearch} className="search-form">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search for a song..."
              className="search-input"
              disabled={isSearching || isQueueing}
            />
            <button
              type="submit"
              className="search-button"
              disabled={isSearching || isQueueing || !searchQuery.trim()}
            >
              {isSearching ? 'Searching...' : 'Search'}
            </button>
          </form>

          {searchResults.length > 0 && (
            <div className="search-results">
              {searchResults.map((track) => (
                <div
                  key={track.id}
                  className="search-result-item"
                  onClick={() => handleQueueTrack(track.id)}
                >
                  {track.album_art && (
                    <img
                      src={track.album_art}
                      alt={track.album}
                      className="result-album-art"
                    />
                  )}
                  <div className="result-info">
                    <div className="result-name">
                      <span>{track.name}</span>
                      {track.explicit && <span className="explicit-badge">E</span>}
                    </div>
                    <div className="result-artist">{track.artists}</div>
                  </div>
                  <button
                    className="queue-button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleQueueTrack(track.id);
                    }}
                    disabled={isQueueing}
                  >
                    Queue
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {inputMethod === 'url' && (
        <form onSubmit={handleQueueUrl} className="url-form">
          <input
            type="text"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder="Paste Spotify track URL (e.g., https://open.spotify.com/track/...)"
            className="url-input"
            disabled={isQueueing}
          />
          <div className="url-examples">
            <small>Examples:</small>
            <div className="url-example-list">
              <code>https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC</code>
              <code>spotify:track:4uLU6hMCjMI75M1A2tKUQC</code>
            </div>
          </div>
          <button
            type="submit"
            className="url-submit-button"
            disabled={isQueueing || !urlInput.trim()}
          >
            {isQueueing ? 'Queueing...' : 'Queue Track'}
          </button>
        </form>
      )}
    </div>
  );
}

export default QueueForm;

