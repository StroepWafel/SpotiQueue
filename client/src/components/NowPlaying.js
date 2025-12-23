import React from 'react';
import './NowPlaying.css';

function NowPlaying({ track }) {
  if (!track) {
    return (
      <div className="now-playing">
      <div className="no-track">
        <div className="no-track-icon">—</div>
        <div className="no-track-text">Nothing playing</div>
      </div>
      </div>
    );
  }

  return (
    <div className="now-playing">
      <div className="album-art-container">
        {track.album_art ? (
          <img src={track.album_art} alt={track.album} className="album-art" />
        ) : (
          <div className="album-art-placeholder">—</div>
        )}
      </div>
      <div className="track-info">
        <div className="track-name">{track.name}</div>
        <div className="track-artist">{track.artists}</div>
        <div className="track-album">{track.album}</div>
      </div>
    </div>
  );
}

export default NowPlaying;

