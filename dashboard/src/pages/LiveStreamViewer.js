import React, { useState, useEffect, useRef } from 'react';
import AdminSidebar from '../layout/AdminSidebar';
import { Radio, Eye, MapPin, X, AlertTriangle, Users, Clock, RefreshCw } from 'lucide-react';
import axios from 'axios';

const API_URL = 'http://localhost:5000/api';
const WS_URL = 'ws://localhost:5000';

const LiveStreamViewer = () => {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const [streams, setStreams] = useState([]);
  const [selectedStream, setSelectedStream] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [streamFrames, setStreamFrames] = useState({});
  const [currentStreamId, setCurrentStreamId] = useState(null);
  
  const wsRef = useRef(null);

  useEffect(() => {
    fetchStreams();
    connectWebSocket();
    
    const interval = setInterval(fetchStreams, 5000);
    return () => {
      clearInterval(interval);
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  const connectWebSocket = () => {
    try {
      const ws = new WebSocket(WS_URL);
      
      ws.onopen = () => {
        console.log('✅ WebSocket connected');
        setIsConnected(true);
        ws.send(JSON.stringify({ type: 'get-streams' }));
      };
      
      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        console.log('📡 Received:', data.type, data.streamId);
        
        if (data.type === 'streams-list') {
          setStreams(data.streams);
          setLoading(false);
        } else if (data.type === 'stream-started') {
          setStreams(prev => [...prev, {
            streamId: data.streamId,
            cameraName: data.cameraName,
            location: data.location,
            viewerCount: 0,
            startTime: data.startTime,
            duration: 0
          }]);
        } else if (data.type === 'stream-ended') {
          setStreams(prev => prev.filter(s => s.streamId !== data.streamId));
          if (selectedStream?.streamId === data.streamId) {
            setSelectedStream(null);
            setCurrentStreamId(null);
          }
          setStreamFrames(prev => {
            const newFrames = { ...prev };
            delete newFrames[data.streamId];
            return newFrames;
          });
        } else if (data.type === 'stream-updated') {
          setStreams(prev => prev.map(s => 
            s.streamId === data.streamId 
              ? { ...s, viewerCount: data.viewerCount }
              : s
          ));
        } else if (data.type === 'stream-frame') {
          console.log(`🎥 Frame received for ${data.streamId}, length: ${data.frame?.length}`);
          
          setStreamFrames(prev => ({
            ...prev,
            [data.streamId]: data.frame
          }));
          
          // Update thumbnail in list
          const videoElement = document.getElementById(`video-${data.streamId}`);
          if (videoElement) {
            videoElement.src = `data:image/jpeg;base64,${data.frame}`;
            videoElement.style.display = 'block';
            const placeholder = document.getElementById(`placeholder-${data.streamId}`);
            if (placeholder) placeholder.style.display = 'none';
          }
          
          // Update modal if this is the current stream
          if (currentStreamId === data.streamId) {
            const modalVideo = document.getElementById('modal-video');
            if (modalVideo) {
              modalVideo.src = `data:image/jpeg;base64,${data.frame}`;
              modalVideo.style.display = 'block';
              const modalPlaceholder = document.getElementById('modal-placeholder');
              if (modalPlaceholder) modalPlaceholder.style.display = 'none';
            }
          }
        }
      };
      
      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };
      
      ws.onclose = () => {
        console.log('WebSocket disconnected, reconnecting...');
        setIsConnected(false);
        setTimeout(connectWebSocket, 3000);
      };
      
      wsRef.current = ws;
    } catch (error) {
      console.error('WebSocket connection error:', error);
    }
  };

  const fetchStreams = async () => {
    try {
      const response = await axios.get(`${API_URL}/streams`);
      setStreams(response.data);
    } catch (error) {
      console.error('Error fetching streams:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchStreams();
  };

  const watchStream = (stream) => {
    console.log(`🎬 Watching stream: ${stream.streamId}`);
    setSelectedStream(stream);
    setCurrentStreamId(stream.streamId);
    
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'join-stream',
        streamId: stream.streamId
      }));
      console.log(`📡 Sent join-stream for ${stream.streamId}`);
    }
  };

  const closeStream = () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && currentStreamId) {
      wsRef.current.send(JSON.stringify({
        type: 'leave-stream',
        streamId: currentStreamId
      }));
    }
    setSelectedStream(null);
    setCurrentStreamId(null);
  };

  const formatTime = (dateString) => {
    if (!dateString) return 'Just now';
    const date = new Date(dateString);
    const now = new Date();
    const diff = Math.floor((now - date) / 1000);
    if (diff < 60) return `${diff} seconds ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)} minutes ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} hours ago`;
    return `${Math.floor(diff / 86400)} days ago`;
  };

  if (loading) {
    return (
      <div className="flex h-screen bg-zinc-50">
        <AdminSidebar user={user} />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-red-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-zinc-600">Loading live streams...</p>
          </div>
        </div>
      </div>
    );
  }

  const activeStreams = streams.length;

  return (
    <div className="flex h-screen bg-zinc-50">
      <AdminSidebar user={user} />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 bg-white border-b border-zinc-200 px-8 flex items-center justify-between shadow-sm">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Live Stream Viewer</h1>
            <p className="text-sm text-zinc-500">Watch real-time mobile broadcasts</p>
          </div>
          <div className="flex items-center gap-3">
            <div className={`flex items-center gap-2 ${isConnected ? 'text-emerald-500' : 'text-red-500'}`}>
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`}></div>
              <span className="text-xs">{isConnected ? 'Connected' : 'Disconnected'}</span>
            </div>
            <button
              onClick={handleRefresh}
              className={`p-2 hover:bg-zinc-100 rounded-xl transition-colors ${refreshing ? 'animate-spin' : ''}`}
            >
              <RefreshCw size={18} className="text-zinc-600" />
            </button>
          </div>
        </header>
        
        <div className="flex-1 overflow-auto p-8">
          <div className="bg-gradient-to-r from-red-500 to-red-600 rounded-2xl p-6 mb-8 text-white">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold">{activeStreams} Active Live {activeStreams === 1 ? 'Stream' : 'Streams'}</h2>
                <p className="text-red-100 mt-1">Watch real-time broadcasts from mobile users</p>
              </div>
              <div className="bg-white/20 rounded-full p-4">
                <Radio className="w-8 h-8" />
              </div>
            </div>
          </div>

          {activeStreams === 0 ? (
            <div className="text-center py-20">
              <div className="w-24 h-24 bg-zinc-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Radio className="w-12 h-12 text-zinc-400" />
              </div>
              <h3 className="text-lg font-medium text-zinc-600">No active live streams</h3>
              <p className="text-zinc-400 mt-1">Wait for someone to start a live broadcast</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {streams.map(stream => (
                <div
                  key={stream.streamId}
                  onClick={() => watchStream(stream)}
                  className="group bg-white rounded-2xl border-2 border-red-500 overflow-hidden shadow-lg hover:shadow-xl transition-all cursor-pointer hover:-translate-y-1"
                >
                  <div className="relative aspect-video bg-gradient-to-br from-zinc-900 to-zinc-800 overflow-hidden">
                    <img
                      id={`video-${stream.streamId}`}
                      className="w-full h-full object-cover absolute inset-0"
                      style={{ display: streamFrames[stream.streamId] ? 'block' : 'none' }}
                      alt="Live stream"
                    />
                    <div 
                      id={`placeholder-${stream.streamId}`}
                      className="absolute inset-0 flex flex-col items-center justify-center"
                      style={{ display: streamFrames[stream.streamId] ? 'none' : 'flex' }}
                    >
                      <Radio className="w-12 h-12 text-red-500 mb-2 animate-pulse" />
                      <p className="text-white text-xs">Loading stream...</p>
                    </div>
                    <div className="absolute top-3 left-3 flex items-center gap-2 z-10">
                      <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                      <span className="text-white text-xs font-medium bg-black/50 px-2 py-0.5 rounded">LIVE</span>
                    </div>
                    <div className="absolute top-3 right-3 bg-black/50 text-white text-xs px-2 py-0.5 rounded flex items-center gap-1 z-10">
                      <Eye className="w-3 h-3" />
                      {stream.viewerCount || 0}
                    </div>
                  </div>
                  <div className="p-4">
                    <h3 className="font-semibold text-zinc-900">{stream.cameraName}</h3>
                    <p className="text-sm text-zinc-500 mt-1 flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {stream.location}
                    </p>
                    <div className="mt-3 flex items-center gap-4 text-xs text-zinc-400">
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatTime(stream.startTime)}
                      </div>
                      <div className="flex items-center gap-1">
                        <Eye className="w-3 h-3" />
                        {stream.viewerCount || 0} watching
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {selectedStream && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4" onClick={closeStream}>
          <div className="bg-white rounded-3xl max-w-5xl w-full max-h-[90vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-zinc-200 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                  <h2 className="text-xl font-bold text-zinc-900">LIVE: {selectedStream.cameraName}</h2>
                </div>
                <p className="text-sm text-zinc-500 flex items-center gap-1 mt-1">
                  <MapPin className="w-3 h-3" />
                  {selectedStream.location}
                </p>
              </div>
              <button onClick={closeStream} className="p-2 hover:bg-zinc-100 rounded-xl transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="relative bg-black aspect-video">
              <img
                id="modal-video"
                className="w-full h-full object-contain"
                style={{ display: streamFrames[selectedStream.streamId] ? 'block' : 'none' }}
                alt="Live stream"
              />
              <div id="modal-placeholder" className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="text-center">
                  <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
                    <Radio className="w-10 h-10 text-red-500" />
                  </div>
                  <p className="text-white text-lg font-medium">Waiting for stream...</p>
                  <p className="text-zinc-400 text-sm mt-2">Please wait while we connect</p>
                </div>
              </div>
            </div>
            
            <div className="p-4 border-t border-zinc-200 flex gap-3">
              <button className="flex-1 py-3 bg-red-500 text-white rounded-xl font-medium hover:bg-red-600 transition-colors flex items-center justify-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                Report Incident
              </button>
              <button className="flex-1 py-3 bg-zinc-500 text-white rounded-xl font-medium hover:bg-zinc-600 transition-colors" onClick={closeStream}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LiveStreamViewer;