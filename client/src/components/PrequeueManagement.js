import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './PrequeueManagement.css';

function PrequeueManagement() {
  const [pending, setPending] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionInProgress, setActionInProgress] = useState(null);

  useEffect(() => {
    fetchPending();
    const interval = setInterval(fetchPending, 3000);
    return () => clearInterval(interval);
  }, []);

  const fetchPending = async () => {
    try {
      const response = await axios.get('/api/prequeue/pending');
      setPending(response.data.pending);
      setError(null);
    } catch (err) {
      setError('Failed to fetch pending requests');
      console.error('Prequeue error:', err);
    } finally {
      setLoading(false);
    }
  };

  const approve = async (prequeueId) => {
    setActionInProgress(prequeueId);
    try {
      await axios.post(`/api/prequeue/approve/${prequeueId}`);
      setPending(pending.filter(p => p.id !== prequeueId));
      setError(null);
    } catch (err) {
      setError('Failed to approve track');
      console.error('Approve error:', err);
    } finally {
      setActionInProgress(null);
    }
  };

  const decline = async (prequeueId) => {
    setActionInProgress(prequeueId);
    try {
      await axios.post(`/api/prequeue/decline/${prequeueId}`);
      setPending(pending.filter(p => p.id !== prequeueId));
      setError(null);
    } catch (err) {
      setError('Failed to decline track');
      console.error('Decline error:', err);
    } finally {
      setActionInProgress(null);
    }
  };

  if (loading) {
    return <div className="prequeue-management"><div className="loading">Loading pending requests...</div></div>;
  }

  if (error) {
    return <div className="prequeue-management"><div className="error">{error}</div></div>;
  }

  if (pending.length === 0) {
    return (
      <div className="prequeue-management">
        <h2>Prequeue Requests</h2>
        <div className="empty">No pending requests</div>
      </div>
    );
  }

  return (
    <div className="prequeue-management">
      <h2>Prequeue Requests ({pending.length})</h2>
      <div className="prequeue-list">
        {pending.map((request) => (
          <div key={request.id} className="prequeue-item">
            {request.album_art && (
              <img src={request.album_art} alt={request.track_name} className="item-art" />
            )}
            <div className="item-info">
              <div className="item-name">{request.track_name}</div>
              <div className="item-artist">{request.artist_name}</div>
              <div className="item-id" style={{ fontSize: '11px', color: '#999', marginTop: '4px' }}>
                ID: {request.id}
              </div>
            </div>
            <div className="item-actions">
              <button
                className="approve-btn"
                onClick={() => approve(request.id)}
                disabled={actionInProgress === request.id}
              >
                {actionInProgress === request.id ? '...' : 'Approve'}
              </button>
              <button
                className="decline-btn"
                onClick={() => decline(request.id)}
                disabled={actionInProgress === request.id}
              >
                {actionInProgress === request.id ? '...' : 'Decline'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default PrequeueManagement;
