// src/components/VideoPlayer.js
import React, { useState, useRef, useEffect } from 'react';
import ReactPlayer from 'react-player';
import { 
  Play, Pause, SkipBack, SkipForward, Volume2, VolumeX,
  Maximize2, Minimize2, Clock, AlertTriangle, Eye, 
  Scissors, Download, Settings, X, Film, Camera
} from 'lucide-react';
import axios from 'axios';

const API_URL = 'http://localhost:5000/api';

const VideoPlayer = ({ url, thumbnail, duration, onAnalysis, incidentId }) => {
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [playedSeconds, setPlayedSeconds] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [muted, setMuted] = useState(false);
  const [showKeyFrames, setShowKeyFrames] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [keyFrames, setKeyFrames] = useState([]);
  const [aiAnalysis, setAiAnalysis] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [showSettings, setShowSettings] = useState(false);
  
  const playerRef = useRef(null);
  const containerRef = useRef(null);

  // Fetch key frames from backend
  useEffect(() => {
    if (incidentId) {
      fetchKeyFrames();
    }
  }, [incidentId]);

  const fetchKeyFrames = async () => {
    try {
      const response = await axios.get(`${API_URL}/cctv/incidents/${incidentId}/frames`);
      setKeyFrames(response.data.frames || []);
    } catch (error) {
      console.error('Error fetching key frames:', error);
      // Set mock data for demo
      setKeyFrames([
        { timestamp: 5, type: 'Car Detected', confidence: 0.92, thumbnail: null },
        { timestamp: 12, type: 'Person Detected', confidence: 0.87, thumbnail: null },
        { timestamp: 18, type: 'Motion Detected', confidence: 0.76, thumbnail: null },
        { timestamp: 25, type: 'Vehicle Accident', confidence: 0.94, thumbnail: null },
      ]);
    }
  };

  const handleProgress = (state) => {
    setProgress(state.played);
    setPlayedSeconds(state.playedSeconds);
  };

  const handleSeek = (seconds) => {
    playerRef.current.seekTo(seconds);
    setPlaying(true);
  };

  const handlePlayPause = () => {
    setPlaying(!playing);
  };

  const handleVolumeChange = (e) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    setMuted(newVolume === 0);
  };

  const toggleMute = () => {
    setMuted(!muted);
  };

  const toggleFullscreen = () => {
    if (!isFullscreen) {
      if (containerRef.current.requestFullscreen) {
        containerRef.current.requestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
    setIsFullscreen(!isFullscreen);
  };

  const handleSpeedChange = (rate) => {
    setPlaybackRate(rate);
    setShowSettings(false);
  };

  const handleAIAnalysis = async () => {
    setIsAnalyzing(true);
    setShowAnalysis(true);
    
    try {
      // Call AI analysis API
      const response = await axios.post(`${API_URL}/cctv/analyze-video`, {
        videoUrl: url,
        incidentId: incidentId
      });
      setAiAnalysis(response.data);
      onAnalysis && onAnalysis(response.data);
    } catch (error) {
      console.error('AI Analysis error:', error);
      // Mock analysis for demo
      setAiAnalysis({
        summary: 'Video shows a vehicle accident with potential injuries. Emergency services recommended.',
        detections: [
          { type: 'Vehicle', count: 2, confidence: 0.95 },
          { type: 'Person', count: 1, confidence: 0.88 },
          { type: 'Damage', confidence: 0.92 },
        ],
        severity: 'High',
        priority: 'Critical',
        recommendation: 'Immediate dispatch of ambulance and police required.'
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getSeverityColor = (severity) => {
    switch (severity?.toLowerCase()) {
      case 'critical': return 'bg-red-500';
      case 'high': return 'bg-orange-500';
      case 'medium': return 'bg-yellow-500';
      default: return 'bg-green-500';
    }
  };

  return (
    <div ref={containerRef} className="video-player-container bg-black rounded-2xl overflow-hidden shadow-2xl">
      {/* Video Player */}
      <div className="relative group">
        <ReactPlayer
          ref={playerRef}
          url={url}
          playing={playing}
          controls={false}
          width="100%"
          height="auto"
          volume={volume}
          muted={muted}
          playbackRate={playbackRate}
          onProgress={handleProgress}
          light={thumbnail}
          config={{
            file: {
              attributes: {
                controlsList: 'nodownload',
              },
            },
          }}
        />
        
        {/* Custom Controls Overlay */}
        <div className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4 transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
          {/* Progress Bar */}
          <div className="mb-3">
            <div className="relative h-1 bg-zinc-600 rounded-full cursor-pointer group/progress">
              <div 
                className="absolute h-full bg-emerald-500 rounded-full"
                style={{ width: `${progress * 100}%` }}
              />
              <input
                type="range"
                min="0"
                max="1"
                step="0.001"
                value={progress}
                onChange={(e) => playerRef.current.seekTo(parseFloat(e.target.value))}
                className="absolute top-0 left-0 w-full h-full opacity-0 cursor-pointer"
              />
            </div>
          </div>
          
          {/* Controls Row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {/* Play/Pause */}
              <button
                onClick={handlePlayPause}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              >
                {playing ? <Pause size={20} className="text-white" /> : <Play size={20} className="text-white" />}
              </button>
              
              {/* Skip Back 10s */}
              <button
                onClick={() => handleSeek(Math.max(0, playedSeconds - 10))}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              >
                <SkipBack size={18} className="text-white" />
              </button>
              
              {/* Skip Forward 10s */}
              <button
                onClick={() => handleSeek(playedSeconds + 10)}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              >
                <SkipForward size={18} className="text-white" />
              </button>
              
              {/* Time Display */}
              <div className="text-white text-sm font-mono ml-2">
                {formatTime(playedSeconds)} / {formatTime(duration || 0)}
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              {/* Volume Control */}
              <div className="flex items-center gap-2">
                <button
                  onClick={toggleMute}
                  className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                >
                  {muted || volume === 0 ? <VolumeX size={18} className="text-white" /> : <Volume2 size={18} className="text-white" />}
                </button>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={volume}
                  onChange={handleVolumeChange}
                  className="w-20 h-1 bg-zinc-600 rounded-full appearance-none cursor-pointer"
                />
              </div>
              
              {/* Key Frames Button */}
              <button
                onClick={() => setShowKeyFrames(!showKeyFrames)}
                className={`p-2 rounded-lg transition-colors ${showKeyFrames ? 'bg-emerald-600' : 'hover:bg-white/10'}`}
              >
                <Film size={18} className="text-white" />
              </button>
              
              {/* AI Analysis Button */}
              <button
                onClick={handleAIAnalysis}
                disabled={isAnalyzing}
                className={`p-2 rounded-lg transition-colors flex items-center gap-1 ${showAnalysis ? 'bg-emerald-600' : 'hover:bg-white/10'}`}
              >
                {isAnalyzing ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Eye size={18} className="text-white" />
                )}
              </button>
              
              {/* Speed Control */}
              <div className="relative">
                <button
                  onClick={() => setShowSettings(!showSettings)}
                  className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                >
                  <Settings size={18} className="text-white" />
                </button>
                {showSettings && (
                  <div className="absolute bottom-full right-0 mb-2 bg-zinc-800 rounded-lg shadow-xl p-2 min-w-[100px]">
                    {[0.5, 0.75, 1, 1.25, 1.5, 2].map(rate => (
                      <button
                        key={rate}
                        onClick={() => handleSpeedChange(rate)}
                        className={`w-full text-left px-3 py-1.5 text-sm rounded-lg transition-colors ${
                          playbackRate === rate ? 'bg-emerald-600 text-white' : 'text-zinc-300 hover:bg-zinc-700'
                        }`}
                      >
                        {rate}x
                      </button>
                    ))}
                  </div>
                )}
              </div>
              
              {/* Fullscreen */}
              <button
                onClick={toggleFullscreen}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              >
                {isFullscreen ? <Minimize2 size={18} className="text-white" /> : <Maximize2 size={18} className="text-white" />}
              </button>
            </div>
          </div>
        </div>
      </div>
      
      {/* Key Frames Timeline */}
      {showKeyFrames && keyFrames.length > 0 && (
        <div className="bg-zinc-900 p-4 border-t border-zinc-800">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-white flex items-center gap-2">
              <Clock size={14} />
              Key Frames Timeline
            </h4>
            <button onClick={() => setShowKeyFrames(false)} className="text-zinc-400 hover:text-white">
              <X size={14} />
            </button>
          </div>
          <div className="relative h-16 bg-zinc-800 rounded-lg overflow-hidden">
            <div className="absolute inset-0 flex">
              {keyFrames.map((frame, index) => (
                <div
                  key={index}
                  className="relative flex-1 group/frame cursor-pointer"
                  onClick={() => handleSeek(frame.timestamp)}
                >
                  <div className="absolute top-0 left-0 right-0 h-1 bg-emerald-500 opacity-0 group-hover/frame:opacity-100 transition-opacity" />
                  <div className="absolute bottom-0 left-0 right-0 text-center">
                    <div className="text-[10px] text-zinc-500 group-hover/frame:text-emerald-400 transition-colors">
                      {formatTime(frame.timestamp)}
                    </div>
                  </div>
                  <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 opacity-0 group-hover/frame:opacity-100 transition-opacity">
                    <div className="bg-emerald-600 text-white text-xs px-2 py-1 rounded-lg whitespace-nowrap">
                      {frame.type}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-3 flex gap-2 overflow-x-auto">
            {keyFrames.map((frame, index) => (
              <button
                key={index}
                onClick={() => handleSeek(frame.timestamp)}
                className="flex-shrink-0 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-xs text-zinc-300 transition-colors"
              >
                {formatTime(frame.timestamp)} - {frame.type}
              </button>
            ))}
          </div>
        </div>
      )}
      
      {/* AI Analysis Panel */}
      {showAnalysis && aiAnalysis && (
        <div className="bg-zinc-900 p-4 border-t border-zinc-800">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-white flex items-center gap-2">
              <AlertTriangle size={14} className="text-emerald-500" />
              AI Video Analysis
            </h4>
            <button onClick={() => setShowAnalysis(false)} className="text-zinc-400 hover:text-white">
              <X size={14} />
            </button>
          </div>
          
          {/* Severity Badge */}
          <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium mb-3 ${getSeverityColor(aiAnalysis.severity)} text-white`}>
            <AlertTriangle size={12} />
            {aiAnalysis.severity} Priority - {aiAnalysis.priority}
          </div>
          
          {/* Summary */}
          <p className="text-sm text-zinc-300 mb-3">{aiAnalysis.summary}</p>
          
          {/* Detections */}
          {aiAnalysis.detections && (
            <div className="mb-3">
              <p className="text-xs font-semibold text-zinc-400 mb-2">Detected Objects:</p>
              <div className="flex flex-wrap gap-2">
                {aiAnalysis.detections.map((detection, idx) => (
                  <span key={idx} className="px-2 py-1 bg-zinc-800 rounded-lg text-xs text-zinc-300">
                    {detection.type}: {Math.round(detection.confidence * 100)}%
                  </span>
                ))}
              </div>
            </div>
          )}
          
          {/* Recommendation */}
          {aiAnalysis.recommendation && (
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-2">
              <p className="text-xs text-emerald-400">{aiAnalysis.recommendation}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default VideoPlayer;