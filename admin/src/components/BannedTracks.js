import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './BannedTracks.css';

function BannedTracks() {
  const [tracks, setTracks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newTrackId, setNewTrackId] = useState('');
  const [newReason, setNewReason] = useState('');

  useEffect(() => {
    loadBannedTracks();
  }, []);

  const loadBannedTracks = async () => {
    try {
      const response = await axios.get('/api/admin/banned-tracks');
      setTracks(response.data.tracks);
      setLoading(false);
    } catch (error) {
      console.error('Error loading banned tracks:', error);
      setLoading(false);
    }
  };

  const addBannedTrack = async (e) => {
    e.preventDefault();
    if (!newTrackId.trim()) return;

    try {
      await axios.post('/api/admin/banned-tracks', {
        track_id: newTrackId,
        reason: newReason || null
      });
      setNewTrackId('');
      setNewReason('');
      loadBannedTracks();
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to ban track');
    }
  };

  const removeBannedTrack = async (trackId) => {
    if (!window.confirm('Remove this track from the ban list?')) return;

    try {
      await axios.delete(`/api/admin/banned-tracks/${trackId}`);
      loadBannedTracks();
    } catch (error) {
      alert('Failed to remove banned track');
    }
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return 'Unknown';
    const date = new Date(timestamp * 1000);
    return date.toLocaleString();
  };

  if (loading) {
    return <div className="loading">Loading banned tracks...</div>;
  }

  return (
    <div className="banned-tracks">
      <div className="add-ban-section">
        <h2>Ban a Track</h2>
        <form onSubmit={addBannedTrack} className="ban-form">
          <div className="form-group">
            <label>Spotify Track ID:</label>
            <input
              type="text"
              value={newTrackId}
              onChange={(e) => setNewTrackId(e.target.value)}
              placeholder="e.g., 4uLU6hMCjMI75M1A2tKUQC"
              className="track-id-input"
            />
          </div>
          <div className="form-group">
            <label>Reason (optional):</label>
            <input
              type="text"
              value={newReason}
              onChange={(e) => setNewReason(e.target.value)}
              placeholder="e.g., Meme song"
              className="reason-input"
            />
          </div>
          <button type="submit" className="ban-button">
            Ban Track
          </button>
        </form>
      </div>

      <div className="banned-list">
        <h2>Banned Tracks ({tracks.length})</h2>
        {tracks.length === 0 ? (
          <div className="no-tracks">No banned tracks</div>
        ) : (
          <table className="banned-table">
            <thead>
              <tr>
                <th>Track ID</th>
                <th>Reason</th>
                <th>Banned At</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {tracks.map((track) => (
                <tr key={track.id}>
                  <td className="track-id">{track.track_id}</td>
                  <td>{track.reason || '-'}</td>
                  <td>{formatTime(track.created_at)}</td>
                  <td>
                    <button
                      className="unban-button"
                      onClick={() => removeBannedTrack(track.track_id)}
                    >
                      Unban
                    </button>
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

export default BannedTracks;

