import React, { useState, useRef } from 'react';
import ReactPlayer from 'react-player';

const VideoPlayer = ({ url, thumbnail, duration, onAnalysis }) => {
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [showKeyFrames, setShowKeyFrames] = useState(false);
  const playerRef = useRef(null);

  const handleProgress = (state) => {
    setProgress(state.played);
  };

  const seekTo = (seconds) => {
    playerRef.current.seekTo(seconds);
    setPlaying(true);
  };

  return (
    <div className="video-player">
      <ReactPlayer
        ref={playerRef}
        url={url}
        playing={playing}
        controls
        width="100%"
        height="auto"
        onProgress={handleProgress}
        light={thumbnail}
      />
      
      <div className="video-controls">
        <button onClick={() => setPlaying(!playing)}>
          {playing ? 'Pause' : 'Play'}
        </button>
        <button onClick={() => setShowKeyFrames(!showKeyFrames)}>
          Show Key Frames
        </button>
        <button onClick={onAnalysis}>
          AI Analysis
        </button>
      </div>

      {showKeyFrames && (
        <div className="keyframes-timeline">
          <h4>Key Frames Timeline</h4>
          <div className="timeline">
            {/* Key frames would be populated from backend */}
            <div 
              className="timeline-marker"
              style={{ left: '25%' }}
              onClick={() => seekTo(5)}
            >
              🚗 Car Detected
            </div>
            <div 
              className="timeline-marker"
              style={{ left: '50%' }}
              onClick={() => seekTo(10)}
            >
              👤 Person Detected
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VideoPlayer;