import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './SpotifyConnect.css';

function SpotifyConnect() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkStatus();
  }, []);

  const checkStatus = async () => {
    try {
      const response = await axios.get('/api/auth/status');
      setStatus(response.data);
      setLoading(false);
    } catch (error) {
      console.error('Error checking auth status:', error);
      // Set default status if API fails
      setStatus({
        connected: false,
        hasRefreshToken: false,
        hasClientId: false,
        hasClientSecret: false
      });
      setLoading(false);
    }
  };

  const handleConnect = async () => {
    try {
      const response = await axios.get('/api/auth/authorize');
      // Redirect to Spotify authorization
      window.location.href = response.data.authUrl;
    } catch (error) {
      console.error('Error getting auth URL:', error);
      alert('Failed to start authorization. Please check your Spotify credentials in .env file.');
    }
  };

  if (loading) {
    return (
      <div className="spotify-connect">
        <div className="connect-content">
          <p>Checking connection status...</p>
        </div>
      </div>
    );
  }

  // Show connect/reconnect option if credentials are configured
  const showConnectButton = status?.hasClientId && status?.hasClientSecret;
  const isConnected = status?.connected;

  return (
    <div className="spotify-connect">
      <div className="connect-content">
        <div className="connect-icon">🎵</div>
        {isConnected ? (
          <>
            <h2>Spotify Connected ✅</h2>
            <p>Your Spotify account is connected. You can reconnect to refresh your token.</p>
          </>
        ) : (
          <>
            <h2>Connect Your Spotify Account</h2>
            <p>To queue songs, you need to connect your Spotify account.</p>
          </>
        )}
        {!status?.hasClientId && (
          <div className="warning">
            ⚠️ SPOTIFY_CLIENT_ID not configured. Please add it to your .env file.
          </div>
        )}
        {!status?.hasClientSecret && (
          <div className="warning">
            ⚠️ SPOTIFY_CLIENT_SECRET not configured. Please add it to your .env file.
          </div>
        )}
        {showConnectButton && (
          <button onClick={handleConnect} className="connect-button">
            {isConnected ? 'Reconnect Spotify Account' : 'Connect Spotify Account'}
          </button>
        )}
        {!showConnectButton && status && (
          <div className="warning">
            Please configure SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET in your .env file.
          </div>
        )}
      </div>
    </div>
  );
}

export default SpotifyConnect;

