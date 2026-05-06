import React, { useState, useEffect, useRef } from "react";
import AdminSidebar from "../layout/AdminSidebar";
import { 
  Play, Volume2, Maximize2, RefreshCw, Settings, Camera, 
  AlertTriangle, Eye, Video, Radio, Wifi, WifiOff, X, 
  Circle, Users, MapPin
} from "lucide-react";
import axios from "axios";
import io from 'socket.io-client';  // Add this import

const API_URL = "http://localhost:5000/api";
const SOCKET_URL = "http://localhost:5000";  // Change from ws:// to http://

const AdminCCTV = () => {
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const [cameras, setCameras] = useState([]);
  const [selectedCamera, setSelectedCamera] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    offline: 0,
    viewers: 0,
    liveStreams: 0
  });
  const [alerts, setAlerts] = useState([]);
  const [showAlerts, setShowAlerts] = useState(false);
  const [liveStreams, setLiveStreams] = useState([]);
  const [selectedStream, setSelectedStream] = useState(null);
  const [showStreamModal, setShowStreamModal] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [streamFrames, setStreamFrames] = useState({});
  const [streamInitialized, setStreamInitialized] = useState({});
  const selectedStreamRef = useRef(null);
  
  const socketRef = useRef(null);

  useEffect(() => {
    fetchCameras();
    fetchAlerts();
    fetchLiveStreams();
    connectSocket();  // Changed from connectWebSocket
    
    const interval = setInterval(() => {
      fetchCameras();
      fetchAlerts();
    }, 10000);
    
    return () => {
      clearInterval(interval);
      if (socketRef.current) socketRef.current.disconnect();
    };
  }, []);

  const connectSocket = () => {
    try {
      // Create Socket.IO connection
      const socket = io(SOCKET_URL, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 3000,
        timeout: 10000
      });
      
      socket.on('connect', () => {
        console.log('✅ Socket.IO connected:', socket.id);
        setIsConnected(true);
        
        // Request streams list
        socket.emit('get-streams');
      });
      
      socket.on('connect_error', (error) => {
        console.error('❌ Socket.IO connection error:', error);
        setIsConnected(false);
      });
      
      socket.on('disconnect', (reason) => {
        console.log('🔌 Socket.IO disconnected:', reason);
        setIsConnected(false);
      });
      
      socket.on('streams-list', (streams) => {
        console.log('📡 Received streams list:', streams.length);
        setLiveStreams(streams);
        setStats(prev => ({ ...prev, liveStreams: streams.length }));
      });
      
      socket.on('stream-started', (data) => {
        console.log('🎥 Stream started:', data);
        setLiveStreams(prev => [...prev, {
          streamId: data.streamId,
          cameraName: data.cameraName,
          location: data.location,
          viewerCount: data.viewerCount || 0,
          startTime: data.startTime,
          duration: data.duration || 0
        }]);
        setStats(prev => ({ ...prev, liveStreams: prev.liveStreams + 1 }));
        addAlert(`🎥 New live stream started: ${data.cameraName}`);
      });
      
      socket.on('stream-ended', (data) => {
        console.log('🛑 Stream ended:', data);
        setLiveStreams(prev => prev.filter(s => s.streamId !== data.streamId));
        setStats(prev => ({ ...prev, liveStreams: prev.liveStreams - 1 }));
        
        if (selectedStream?.streamId === data.streamId) {
          setShowStreamModal(false);
          setSelectedStream(null);
        }
        
        // Clean up frame data
        setStreamFrames(prev => {
          const newFrames = { ...prev };
          delete newFrames[data.streamId];
          return newFrames;
        });
        setStreamInitialized(prev => {
          const newInit = { ...prev };
          delete newInit[data.streamId];
          return newInit;
        });
        addAlert(`🛑 Live stream ended: ${data.cameraName}`);
      });
      
      socket.on('stream-updated', (data) => {
        console.log('📊 Stream updated:', data);
        setLiveStreams(prev => prev.map(s => 
          s.streamId === data.streamId 
            ? { ...s, viewerCount: data.viewerCount }
            : s
        ));
      });
      
     // In AdminCCTV.js, update the socket event handlers
socket.on('stream-frame', (data) => {
  console.log('📡 Received frame for stream:', data.streamId, 'size:', data.frame?.length);
  
  // Update frame data
  setStreamFrames(prev => ({
    ...prev,
    [data.streamId]: data.frame
  }));
  
  setStreamInitialized(prev => {
    if (!prev[data.streamId]) {
      console.log('🎬 Stream initialized:', data.streamId);
      return { ...prev, [data.streamId]: true };
    }
    return prev;
  });
  
  // Update the video element directly
  const videoElement = document.getElementById(`video-${data.streamId}`);
  if (videoElement) {
    const imageUrl = `data:image/jpeg;base64,${data.frame}`;
    videoElement.src = imageUrl;
    videoElement.style.display = 'block';
    
    // Hide placeholder
    const placeholder = document.getElementById(`placeholder-${data.streamId}`);
    if (placeholder) {
      placeholder.style.display = 'none';
    }
    
    console.log('🎬 Updated video element for stream:', data.streamId);
  } else {
    console.warn('Video element not found for stream:', data.streamId);
  }
  
  // Also update modal video if it's the selected stream (use ref for current value)
  if (selectedStreamRef.current?.streamId === data.streamId) {
    const modalVideo = document.getElementById('modal-video');
    if (modalVideo) {
      modalVideo.src = `data:image/jpeg;base64,${data.frame}`;
      modalVideo.style.display = 'block';
      const modalPlaceholder = document.getElementById('modal-placeholder');
      if (modalPlaceholder) {
        modalPlaceholder.style.display = 'none';
      }
    }
  }
});
      
      socketRef.current = socket;
    } catch (error) {
      console.error('Socket.IO connection error:', error);
    }
  };

  const addAlert = (message) => {
    const newAlert = {
      id: Date.now(),
      message,
      time: new Date().toISOString(),
      read: false
    };
    setAlerts(prev => [newAlert, ...prev].slice(0, 20));
  };

  const fetchCameras = async () => {
    try {
      const response = await axios.get(`${API_URL}/cctv/cameras`);
      const data = response.data;
      setCameras(Array.isArray(data) ? data : []);
      
      const activeCount = data.filter(c => c.status === 'active').length;
      const offlineCount = data.filter(c => c.status === 'inactive' || c.status === 'maintenance').length;
      
      setStats(prev => ({
        ...prev,
        total: data.length,
        active: activeCount,
        offline: offlineCount,
        viewers: data.reduce((sum, c) => sum + (c.viewers || 0), 0)
      }));
    } catch (error) {
      console.error('Error fetching cameras:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchAlerts = async () => {
    try {
      const response = await axios.get(`${API_URL}/cctv/alerts`);
      const data = response.data;
      setAlerts(Array.isArray(data) ? data.slice(0, 10) : []);
    } catch (error) {
      console.error('Error fetching alerts:', error);
    }
  };

  const fetchLiveStreams = async () => {
    try {
      const response = await axios.get(`${API_URL}/streams`);
      const data = response.data;
      setLiveStreams(Array.isArray(data) ? data : []);
      setStats(prev => ({ ...prev, liveStreams: data.length }));
    } catch (error) {
      console.error('Error fetching live streams:', error);
    }
  };

  const updateCameraStatus = async (cameraId, status) => {
    try {
      await axios.put(`${API_URL}/cctv/cameras/${cameraId}/status`, { status });
      fetchCameras();
      addAlert(`Camera ${cameraId} status changed to ${status}`);
    } catch (error) {
      console.error('Error updating camera:', error);
    }
  };

  const startRecording = async (cameraId) => {
    try {
      await axios.post(`${API_URL}/cctv/cameras/${cameraId}/record`);
      addAlert(`Started recording on camera ${cameraId}`);
      fetchCameras();
    } catch (error) {
      console.error('Error starting recording:', error);
    }
  };

  const markAlertRead = async (alertId) => {
    try {
      await axios.put(`${API_URL}/cctv/alerts/${alertId}/view`);
      fetchAlerts();
    } catch (error) {
      console.error('Error marking alert:', error);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchCameras();
    fetchAlerts();
    fetchLiveStreams();
  };

  const watchLiveStream = (stream) => {
    setSelectedStream(stream);
    selectedStreamRef.current = stream;
    setShowStreamModal(true);
    
    // Join the stream via Socket.IO
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('join-stream', stream.streamId);
    }
    
    // Reset modal video state and display existing frames if available
    setTimeout(() => {
      const modalVideo = document.getElementById('modal-video');
      if (modalVideo && streamFrames[stream.streamId]) {
        modalVideo.src = `data:image/jpeg;base64,${streamFrames[stream.streamId]}`;
        modalVideo.style.display = 'block';
        const modalPlaceholder = document.getElementById('modal-placeholder');
        if (modalPlaceholder) {
          modalPlaceholder.style.display = 'none';
        }
      }
    }, 100);
  };

  // Add this to leave stream when modal closes
  const closeStreamModal = () => {
    if (selectedStreamRef.current && socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('leave-stream', selectedStreamRef.current.streamId);
    }
    setShowStreamModal(false);
    setSelectedStream(null);
    selectedStreamRef.current = null;
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return 'bg-emerald-500';
      case 'maintenance': return 'bg-amber-500';
      default: return 'bg-red-500';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'active': return 'ACTIVE';
      case 'maintenance': return 'MAINTENANCE';
      default: return 'OFFLINE';
    }
  };

  const formatTime = (dateString) => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    const now = new Date();
    const diff = Math.floor((now - date) / 1000 / 60);
    if (diff < 60) return `${diff} min ago`;
    if (diff < 1440) return `${Math.floor(diff / 60)} hours ago`;
    return `${Math.floor(diff / 1440)} days ago`;
  };

  const formatDuration = (seconds) => {
    if (!seconds) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="flex h-screen bg-zinc-50">
        <AdminSidebar user={user} />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-zinc-600">Loading CCTV feeds...</p>
          </div>
        </div>
      </div>
    );
  }

  const unreadAlerts = alerts.filter(a => !a.is_viewed).length;
  const activeLiveStreams = liveStreams.length;

  return (
    <div className="flex h-screen bg-zinc-50 text-zinc-900 overflow-hidden">
      <AdminSidebar user={user} />

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 bg-white border-b border-zinc-200 px-8 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-4">
            <div className="relative">
              <Camera className="w-7 h-7 text-emerald-600" />
              {activeLiveStreams > 0 && (
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
              )}
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">CCTV Surveillance</h1>
              <p className="text-sm text-zinc-500">Live monitoring & incident detection</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {!isConnected && (
              <div className="flex items-center gap-2 bg-amber-50 px-3 py-1.5 rounded-full">
                <div className="w-2 h-2 bg-amber-500 rounded-full"></div>
                <span className="text-xs font-medium text-amber-600">Reconnecting...</span>
              </div>
            )}
            {activeLiveStreams > 0 && (
              <div className="flex items-center gap-2 bg-red-50 px-3 py-1.5 rounded-full">
                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                <span className="text-xs font-medium text-red-600">{activeLiveStreams} Live Streams</span>
              </div>
            )}
            <div className="relative">
              <button 
                onClick={() => setShowAlerts(!showAlerts)}
                className="relative p-2 hover:bg-zinc-100 rounded-xl transition-all"
              >
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                {unreadAlerts > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                    {unreadAlerts}
                  </span>
                )}
              </button>
              {showAlerts && (
                <div className="absolute right-0 top-12 w-80 bg-white rounded-2xl shadow-xl border border-zinc-200 z-50">
                  <div className="p-4 border-b border-zinc-100">
                    <h3 className="font-semibold">Recent Alerts</h3>
                  </div>
                  <div className="max-h-96 overflow-y-auto">
                    {alerts.length === 0 ? (
                      <p className="p-4 text-center text-zinc-500">No alerts</p>
                    ) : (
                      alerts.map(alert => (
                        <div 
                          key={alert.id} 
                          className={`p-3 border-b border-zinc-100 hover:bg-zinc-50 cursor-pointer ${!alert.is_viewed ? 'bg-amber-50' : ''}`}
                          onClick={() => markAlertRead(alert.id)}
                        >
                          <p className="text-sm font-medium">{alert.incident_type || 'System Alert'}</p>
                          <p className="text-xs text-zinc-500 mt-1">{alert.alert_message || alert.message}</p>
                          <p className="text-xs text-zinc-400 mt-1">{formatTime(alert.created_at)}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
            <button 
              onClick={handleRefresh}
              className={`flex items-center gap-2 px-5 py-2 bg-white border border-zinc-300 hover:border-emerald-300 rounded-2xl text-sm font-medium transition-all hover:shadow ${refreshing ? 'opacity-50' : ''}`}
            >
              <RefreshCw size={18} className={`text-emerald-600 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </header>

        <main className="flex-1 p-6 md:p-8 overflow-auto bg-zinc-50">
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-4 mb-8">
            <div className="bg-white p-4 rounded-2xl border border-zinc-200 shadow-sm">
              <div className="flex items-center justify-between">
                <div><p className="text-zinc-500 text-sm">Total Cameras</p><p className="text-2xl font-bold text-zinc-900">{stats.total}</p></div>
                <Camera className="w-8 h-8 text-emerald-500 opacity-50" />
              </div>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-zinc-200 shadow-sm">
              <div className="flex items-center justify-between">
                <div><p className="text-zinc-500 text-sm">Active Cameras</p><p className="text-2xl font-bold text-emerald-600">{stats.active}</p></div>
                <Video className="w-8 h-8 text-emerald-500 opacity-50" />
              </div>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-zinc-200 shadow-sm">
              <div className="flex items-center justify-between">
                <div><p className="text-zinc-500 text-sm">Live Streams</p><p className="text-2xl font-bold text-red-500">{stats.liveStreams}</p></div>
                <Radio className="w-8 h-8 text-red-500 opacity-50" />
              </div>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-zinc-200 shadow-sm">
              <div className="flex items-center justify-between">
                <div><p className="text-zinc-500 text-sm">Offline Cameras</p><p className="text-2xl font-bold text-red-500">{stats.offline}</p></div>
                <WifiOff className="w-8 h-8 text-red-500 opacity-50" />
              </div>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-zinc-200 shadow-sm">
              <div className="flex items-center justify-between">
                <div><p className="text-zinc-500 text-sm">Active Viewers</p><p className="text-2xl font-bold text-blue-500">{stats.viewers}</p></div>
                <Users className="w-8 h-8 text-blue-500 opacity-50" />
              </div>
            </div>
          </div>

          {activeLiveStreams > 0 && (
            <div className="mb-8">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Radio className="w-5 h-5 text-red-500" />
                  <h2 className="text-lg font-semibold text-zinc-900">Live Broadcasts</h2>
                  <span className="bg-red-100 text-red-600 text-xs px-2 py-0.5 rounded-full">{activeLiveStreams} active</span>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {liveStreams.map((stream) => (
                  <div
                    key={stream.streamId}
                    onClick={() => watchLiveStream(stream)}
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
                      <p className="text-xs text-zinc-400 mt-2">Started {formatTime(stream.startTime)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-4 mb-8 items-center justify-between bg-white p-4 rounded-3xl border border-zinc-100 shadow-sm">
            <div className="flex items-center gap-8 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse"></div>
                <span className="font-medium text-emerald-700">{stats.active} Cameras ACTIVE</span>
              </div>
              {activeLiveStreams > 0 && (
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                  <span className="font-medium text-red-700">{activeLiveStreams} LIVE STREAMS</span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                <span className="text-zinc-500">{stats.offline} Cameras OFFLINE</span>
              </div>
            </div>
            <div className="text-xs text-zinc-500 font-mono">
              {isConnected ? '🟢 Connected' : '🔴 Disconnected'} • Last updated: {new Date().toLocaleTimeString()}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {cameras.map((camera) => (
              <div
                key={camera.id}
                onClick={() => {
                  setSelectedCamera(camera);
                  setShowModal(true);
                }}
                className={`group relative bg-white border rounded-3xl overflow-hidden shadow hover:shadow-xl transition-all duration-300 cursor-pointer hover:-translate-y-1 ${
                  camera.status === 'active' ? 'border-emerald-500 border-2' : 'border-zinc-200'
                }`}
              >
                <div className="relative aspect-video bg-zinc-950 flex items-center justify-center overflow-hidden">
                  <div className="absolute inset-0 bg-[radial-gradient(#444_0.8px,transparent_1px)] bg-[length:3px_3px] opacity-40"></div>
                  {camera.status === 'active' ? (
                    <>
                      <div className="absolute top-4 left-4 flex items-center gap-1.5 bg-black/70 text-white text-xs px-3 py-1 rounded-full font-medium">
                        <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                        ACTIVE
                      </div>
                      <div className="flex flex-col items-center justify-center text-white/70 group-hover:text-white transition-colors">
                        <Play className="w-14 h-14 mb-2" />
                        <p className="text-xs tracking-widest">CAMERA FEED</p>
                      </div>
                    </>
                  ) : (
                    <div className="text-center text-white/50">
                      <Camera className="w-16 h-16 mx-auto mb-3 opacity-40" />
                      <p className="font-medium">OFFLINE</p>
                    </div>
                  )}
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-5">
                    <p className="text-white font-semibold text-lg">{camera.camera_name}</p>
                    <p className="text-emerald-300 text-sm flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {camera.location_name || 'Unknown'}
                    </p>
                  </div>
                  <div className="absolute top-4 right-4 bg-black/70 text-white text-[10px] px-2.5 py-0.5 rounded font-mono tracking-wider">
                    {camera.resolution || '1080p'}
                  </div>
                </div>
                <div className="p-4 flex items-center justify-between border-t border-zinc-100">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${getStatusColor(camera.status)}`}></div>
                    <p className={`text-xs font-medium ${camera.status === 'active' ? 'text-emerald-600' : camera.status === 'maintenance' ? 'text-amber-600' : 'text-red-600'}`}>
                      {getStatusText(camera.status)}
                    </p>
                  </div>
                  <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    {camera.status === 'active' && (
                      <button className="p-2 hover:bg-emerald-50 text-emerald-600 rounded-xl transition-colors" onClick={(e) => { e.stopPropagation(); startRecording(camera.id); }}>
                        <Circle className="w-4 h-4" />
                      </button>
                    )}
                    <button className="p-2 hover:bg-sky-50 text-sky-600 rounded-xl transition-colors"><Volume2 className="w-4 h-4" /></button>
                    <button className="p-2 hover:bg-zinc-100 text-zinc-600 rounded-xl transition-colors"><Maximize2 className="w-4 h-4" /></button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </main>
      </div>

      {/* Live Stream Modal */}
      {showStreamModal && selectedStream && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4" onClick={closeStreamModal}>
          <div className="bg-white rounded-3xl max-w-5xl w-full max-h-[90vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-zinc-200 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                  <h2 className="text-xl font-bold text-zinc-900">LIVE: {selectedStream.cameraName}</h2>
                </div>
                <p className="text-sm text-zinc-500 flex items-center gap-1 mt-1"><MapPin className="w-3 h-3" />{selectedStream.location}</p>
              </div>
              <button onClick={closeStreamModal} className="p-2 hover:bg-zinc-100 rounded-xl transition-colors"><X className="w-5 h-5" /></button>
            </div>
            
            <div className="relative bg-black aspect-video">
              <img
                id="modal-video"
                className="w-full h-full object-contain"
                style={{ display: streamFrames[selectedStream.streamId] ? 'block' : 'none' }}
                alt="Live stream"
              />
              <div 
                id="modal-placeholder" 
                className="absolute inset-0 flex items-center justify-center"
                style={{ display: streamFrames[selectedStream.streamId] ? 'none' : 'flex' }}
              >
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
              <button className="flex-1 py-3 bg-red-500 text-white rounded-xl font-medium hover:bg-red-600 transition-colors flex items-center justify-center gap-2" onClick={() => {}}><AlertTriangle className="w-4 h-4" />Report Incident</button>
              <button className="flex-1 py-3 bg-zinc-500 text-white rounded-xl font-medium hover:bg-zinc-600 transition-colors" onClick={closeStreamModal}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Camera Detail Modal */}
      {showModal && selectedCamera && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[90vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-zinc-200 flex items-center justify-between">
              <div><h2 className="text-xl font-bold text-zinc-900">{selectedCamera.camera_name}</h2><p className="text-sm text-zinc-500 flex items-center gap-1 mt-1"><MapPin className="w-3 h-3" />{selectedCamera.location_name || 'Unknown location'}</p></div>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-zinc-100 rounded-xl transition-colors"><X className="w-5 h-5" /></button>
            </div>
            <div className="relative bg-black aspect-video">
              {selectedCamera.status === 'active' && selectedCamera.stream_url ? (
                <video src={selectedCamera.stream_url} controls autoPlay className="w-full h-full object-contain" />
              ) : (
                <div className="flex items-center justify-center h-full"><div className="text-center"><Camera className="w-16 h-16 text-zinc-600 mx-auto mb-4" /><p className="text-zinc-400">Camera is offline</p></div></div>
              )}
              {selectedCamera.status === 'active' && <div className="absolute top-4 left-4 flex items-center gap-2 bg-emerald-500 text-white px-3 py-1 rounded-full text-sm font-medium"><div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>ACTIVE</div>}
            </div>
            <div className="p-6 grid grid-cols-2 gap-4">
              <div className="bg-zinc-50 p-3 rounded-xl"><p className="text-zinc-500 text-xs mb-1">Status</p><p className="font-medium flex items-center gap-2"><div className={`w-2 h-2 rounded-full ${getStatusColor(selectedCamera.status)}`}></div>{getStatusText(selectedCamera.status)}</p></div>
              <div className="bg-zinc-50 p-3 rounded-xl"><p className="text-zinc-500 text-xs mb-1">Resolution</p><p className="font-medium">{selectedCamera.resolution || '1080p'}</p></div>
              <div className="bg-zinc-50 p-3 rounded-xl"><p className="text-zinc-500 text-xs mb-1">Last Active</p><p className="font-medium text-sm">{formatTime(selectedCamera.last_active)}</p></div>
              <div className="bg-zinc-50 p-3 rounded-xl"><p className="text-zinc-500 text-xs mb-1">Recordings</p><p className="font-medium">{selectedCamera.recording_count || 0} recordings</p></div>
            </div>
            <div className="p-4 border-t border-zinc-200 flex gap-3">
              {selectedCamera.status === 'active' && <button className="flex-1 py-3 bg-emerald-500 text-white rounded-xl font-medium hover:bg-emerald-600 transition-colors flex items-center justify-center gap-2" onClick={() => startRecording(selectedCamera.id)}><Circle className="w-4 h-4" />Start Recording</button>}
              {selectedCamera.status === 'active' && <button className="flex-1 py-3 bg-amber-500 text-white rounded-xl font-medium hover:bg-amber-600 transition-colors" onClick={() => updateCameraStatus(selectedCamera.id, 'maintenance')}>Set Maintenance</button>}
              {selectedCamera.status === 'maintenance' && <button className="flex-1 py-3 bg-emerald-500 text-white rounded-xl font-medium hover:bg-emerald-600 transition-colors" onClick={() => updateCameraStatus(selectedCamera.id, 'active')}>Activate Camera</button>}
              <button className="flex-1 py-3 bg-red-500 text-white rounded-xl font-medium hover:bg-red-600 transition-colors" onClick={() => setShowModal(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminCCTV;