import React, { useState, useEffect, useRef, useCallback } from "react";
import ResponderSidebar from "../layout/ResponderSidebar";
import SuperResponderSidebar from "../layout/SuperResponderSidebar";
import {
  Play, RefreshCw, Camera,
  AlertTriangle, Eye, Video, Radio, WifiOff, X,
  Circle, Users, MapPin, Cpu, Shield, Download,
  AlertCircle, CheckCircle, Crosshair, Clock, ChevronDown, ChevronUp, BarChart2
} from "lucide-react";
import axios from "axios";
import io from 'socket.io-client';

const API_URL = "http://localhost:5000/api";
const SOCKET_URL = "http://localhost:5000";

// ── Helper components ──────────────────────────────────────────────────────────

const SeverityBadge = ({ severity }) => {
  const map = {
    'Critical Emergency': 'bg-red-500/20 text-red-300 border border-red-500/40',
    'Medium Risk':        'bg-yellow-500/20 text-yellow-300 border border-yellow-500/40',
    'Low Risk':           'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40',
  };
  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${map[severity] || map['Low Risk']}`}>
      {severity}
    </span>
  );
};

const ConfidenceBar = ({ value }) => {
  const color = value >= 70 ? 'bg-red-500' : value >= 45 ? 'bg-yellow-400' : 'bg-emerald-400';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${value}%` }} />
      </div>
      <span className="text-[11px] font-mono text-white/70 w-8 text-right">{value}%</span>
    </div>
  );
};

const StreamLocationMap = ({ locationStr }) => {
  const [incidentCoords, setIncidentCoords] = React.useState(null);
  const [userCoords,     setUserCoords]     = React.useState(null);
  const [address,        setAddress]        = React.useState(null);
  const [route,          setRoute]          = React.useState(null);
  const [routeError,     setRouteError]     = React.useState(null);
  const [loadingRoute,   setLoadingRoute]   = React.useState(false);
  const [iframeSrc,      setIframeSrc]      = React.useState(null);
  const blobUrlRef = React.useRef(null);

  React.useEffect(() => {
    if (!locationStr || locationStr === 'Unknown') return;
    const parts = locationStr.split(',').map(s => parseFloat(s.trim()));
    if (parts.length < 2 || isNaN(parts[0]) || isNaN(parts[1])) return;
    const [lat, lng] = parts;
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return;
    setIncidentCoords({ lat, lng });
    fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`, { headers: { 'Accept-Language': 'en' } })
      .then(r => r.json())
      .then(data => {
        const a = data.address || {};
        const place = [a.road || a.pedestrian, a.suburb || a.neighbourhood, a.city || a.town || a.village, a.country].filter(Boolean).join(', ');
        setAddress(place || data.display_name || locationStr);
      })
      .catch(() => setAddress(locationStr));
  }, [locationStr]);

  React.useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      pos => setUserCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setUserCoords(null)
    );
  }, []);

  React.useEffect(() => {
    if (!incidentCoords || !userCoords) return;
    setLoadingRoute(true); setRouteError(null);
    const { lat: iLat, lng: iLng } = incidentCoords;
    const { lat: uLat, lng: uLng } = userCoords;
    fetch(`https://router.project-osrm.org/route/v1/driving/${uLng},${uLat};${iLng},${iLat}?overview=full&geometries=geojson`)
      .then(r => r.json())
      .then(data => {
        if (data.code !== 'Ok' || !data.routes?.length) throw new Error('No route found');
        const r0 = data.routes[0];
        setRoute({ distance: r0.distance, duration: r0.duration, geometry: r0.geometry });
        setLoadingRoute(false);
      })
      .catch(e => { setRouteError(e.message); setLoadingRoute(false); });
  }, [incidentCoords, userCoords]);

  React.useEffect(() => {
    if (!incidentCoords) return;
    const { lat: iLat, lng: iLng } = incidentCoords;
    const uLat = userCoords?.lat, uLng = userCoords?.lng;
    const hasRoute = route && uLat != null;
    const cLat = hasRoute ? (iLat + uLat) / 2 : iLat;
    const cLng = hasRoute ? (iLng + uLng) / 2 : iLng;
    const zoom  = hasRoute ? 13 : 16;
    const routeCoords = hasRoute ? JSON.stringify(route.geometry.coordinates.map(([ln, la]) => [la, ln])) : '[]';

    const html = `<!DOCTYPE html><html><head>
<meta charset="utf-8"/>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"><\/script>
<style>html,body,#map{margin:0;padding:0;width:100%;height:100%;background:#0f172a}</style>
</head><body><div id="map"></div>
<script>
  var map = L.map('map',{zoomControl:true,attributionControl:false}).setView([${cLat},${cLng}],${zoom});
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19}).addTo(map);
  var redIcon = L.divIcon({className:'',html:'<div style="width:14px;height:14px;background:#ef4444;border:2px solid #fff;border-radius:50%;box-shadow:0 0 8px #ef4444"></div>',iconAnchor:[7,7]});
  L.marker([${iLat},${iLng}],{icon:redIcon}).addTo(map).bindPopup('<b>📍 Incident Location</b>').openPopup();
  ${uLat != null ? `var blueIcon = L.divIcon({className:'',html:'<div style="width:12px;height:12px;background:#60a5fa;border:2px solid #fff;border-radius:50%;box-shadow:0 0 6px #60a5fa"></div>',iconAnchor:[6,6]});L.marker([${uLat},${uLng}],{icon:blueIcon}).addTo(map).bindPopup('<b>🚓 Your Location</b>');` : ''}
  ${hasRoute ? `var coords=${routeCoords};L.polyline(coords,{color:'#f59e0b',weight:4,opacity:0.9,dashArray:'8,4'}).addTo(map);map.fitBounds(L.polyline(coords).getBounds(),{padding:[20,20]});` : ''}
<\/script></body></html>`;

    if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
    const blob = new Blob([html], { type: 'text/html' });
    const url  = URL.createObjectURL(blob);
    blobUrlRef.current = url;
    setIframeSrc(url);
  }, [incidentCoords, userCoords, route]);

  React.useEffect(() => () => { if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current); }, []);

  if (!incidentCoords) {
    return (
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-3 flex items-center gap-2">
        <MapPin size={12} className="text-slate-500" />
        <span className="text-[11px] text-slate-400">{locationStr || 'No location data'}</span>
      </div>
    );
  }

  const { lat: iLat, lng: iLng } = incidentCoords;
  const osmLink = `https://www.openstreetmap.org/?mlat=${iLat}&mlon=${iLng}#map=16/${iLat}/${iLng}`;
  const fmtDist = (m) => m >= 1000 ? `${(m/1000).toFixed(1)} km` : `${Math.round(m)} m`;
  const fmtTime = (s) => { const h = Math.floor(s/3600), m = Math.floor((s%3600)/60); return h > 0 ? `${h}h ${m}m` : `${m} min`; };

  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
      <div className="px-3 py-2 border-b border-slate-700 flex items-center gap-1.5">
        <MapPin size={11} className="text-emerald-400" />
        <span className="text-[10px] font-bold text-slate-300">Incident Location & Route</span>
        <a href={osmLink} target="_blank" rel="noreferrer" className="ml-auto text-[9px] text-indigo-400 hover:text-indigo-300">Open ↗</a>
      </div>
      {iframeSrc && <iframe title="stream-location" src={iframeSrc} width="100%" height="200" style={{ border: 0, display: 'block' }} sandbox="allow-scripts allow-same-origin" />}
      <div className="px-3 py-2.5 space-y-2">
        <div>
          <span className="text-[9px] font-mono text-emerald-400">{iLat.toFixed(5)}, {iLng.toFixed(5)}</span>
          {address && <p className="text-[10px] text-slate-300 leading-tight mt-0.5">{address}</p>}
        </div>
        {loadingRoute && <div className="flex items-center gap-1.5 text-[10px] text-slate-500"><div className="w-3 h-3 border border-yellow-500 border-t-transparent rounded-full animate-spin" />Calculating route...</div>}
        {!loadingRoute && !userCoords && <p className="text-[10px] text-slate-500">Enable browser location to see route</p>}
        {route && !loadingRoute && (
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-slate-700/60 rounded-lg px-2.5 py-2 border border-slate-600/50">
              <div className="flex items-center gap-1 mb-0.5"><span className="text-yellow-400 text-[10px]">🚗</span><span className="text-[9px] text-slate-400 uppercase font-bold">Distance</span></div>
              <p className="text-sm font-bold text-white">{fmtDist(route.distance)}</p>
            </div>
            <div className="bg-slate-700/60 rounded-lg px-2.5 py-2 border border-slate-600/50">
              <div className="flex items-center gap-1 mb-0.5"><span className="text-yellow-400 text-[10px]">⏱</span><span className="text-[9px] text-slate-400 uppercase font-bold">Drive Time</span></div>
              <p className="text-sm font-bold text-white">{fmtTime(route.duration)}</p>
            </div>
          </div>
        )}
        {route && !loadingRoute && (
          <div className="flex items-center gap-1.5 bg-yellow-500/10 border border-yellow-500/30 rounded-lg px-2.5 py-1.5">
            <span className="text-yellow-400 text-xs">⚡</span>
            <span className="text-[10px] text-yellow-300 font-semibold">Fastest route by car</span>
            <span className="ml-auto text-[9px] text-yellow-400 font-mono">{fmtDist(route.distance)} · {fmtTime(route.duration)}</span>
          </div>
        )}
        {routeError && <p className="text-[10px] text-red-400">Route unavailable: {routeError}</p>}
        <div className="flex items-center gap-3 text-[9px] text-slate-500">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> Incident</span>
          {userCoords && <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-400 inline-block" /> Your Position</span>}
          {route && <span className="flex items-center gap-1"><span className="inline-block w-4 border-t-2 border-dashed border-yellow-400" /> Route</span>}
        </div>
      </div>
    </div>
  );
};

// ── Main Component ─────────────────────────────────────────────────────────────

const ResponderCCTV = () => {
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const [cameras, setCameras] = useState([]);
  const [selectedCamera, setSelectedCamera] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [stats, setStats] = useState({ total: 0, active: 0, offline: 0, viewers: 0, liveStreams: 0 });
  const [alerts, setAlerts] = useState([]);
  const [showAlerts, setShowAlerts] = useState(false);
  const [liveStreams, setLiveStreams] = useState([]);
  const [selectedStream, setSelectedStream] = useState(null);
  const [showStreamModal, setShowStreamModal] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [streamFrames, setStreamFrames] = useState({});

  // AI state
  const [aiEnabled] = useState(true);
  const [aiStatus, setAiStatus] = useState('idle');
  const [aiServiceOnline, setAiServiceOnline] = useState(false);
  const [currentDetection, setCurrentDetection] = useState(null);
  const [aiEventTimeline, setAiEventTimeline] = useState([]);
  const [aiFrameCounter, setAiFrameCounter] = useState(0);
  const [showAiPanel, setShowAiPanel] = useState(true);
  const [showTimeline, setShowTimeline] = useState(true);

  // Assignment state
  const [showAssignPanel, setShowAssignPanel] = useState(false);
  const [assignTypes, setAssignTypes] = useState([]);
  const [assignNotes, setAssignNotes] = useState('');
  const [assigning, setAssigning] = useState(false);
  const [assignSuccess, setAssignSuccess] = useState(false);

  // Draggable AI panel
  const [aiPanelWidth, setAiPanelWidth] = useState(288);
  const isDraggingRef = useRef(false);
  const dragStartXRef = useRef(0);
  const dragStartWidthRef = useRef(288);
  const modalRowRef = useRef(null);

  const selectedStreamRef = useRef(null);
  const socketRef = useRef(null);
  const modalCanvasRef = useRef(null);
  const currentDetectionRef = useRef(null);

  // Draggable divider
  const onDividerMouseDown = (e) => {
    e.preventDefault();
    isDraggingRef.current = true;
    dragStartXRef.current = e.clientX;
    dragStartWidthRef.current = aiPanelWidth;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  useEffect(() => {
    const onMouseMove = (e) => {
      if (!isDraggingRef.current) return;
      const delta = dragStartXRef.current - e.clientX;
      const newW = Math.min(560, Math.max(200, dragStartWidthRef.current + delta));
      setAiPanelWidth(newW);
    };
    const onMouseUp = () => {
      if (!isDraggingRef.current) return;
      isDraggingRef.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => { window.removeEventListener('mousemove', onMouseMove); window.removeEventListener('mouseup', onMouseUp); };
  }, []);

  // Label colours
  const LABEL_COLORS = { person:'#facc15', car:'#60a5fa', truck:'#f87171', bus:'#f97316', motorcycle:'#a78bfa', bicycle:'#34d399', fire:'#ef4444', accident:'#ef4444' };
  const getLabelColor = (label) => LABEL_COLORS[label?.toLowerCase()] ?? '#facc15';

  // Canvas draw with bbox overlay
  const drawFrameOnCanvas = useCallback((base64Frame, detection) => {
    const canvas = modalCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const img = new Image();
    img.onload = () => {
      canvas.width  = img.naturalWidth  || canvas.offsetWidth  || 640;
      canvas.height = img.naturalHeight || canvas.offsetHeight || 360;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const boxes = detection?.detections || [];
      boxes.forEach(box => {
        if (!box.w || !box.h) return;
        const x = box.x * canvas.width, y = box.y * canvas.height;
        const w = box.w * canvas.width,  h = box.h * canvas.height;
        const color = getLabelColor(box.label);
        const label = `${(box.label || 'obj').toUpperCase()} ${Math.round((box.confidence||0)*100)}%`;
        ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.strokeRect(x, y, w, h);
        const cs = 12; ctx.lineWidth = 3;
        [[x,y,1,1],[x+w,y,-1,1],[x,y+h,1,-1],[x+w,y+h,-1,-1]].forEach(([cx,cy,dx,dy]) => {
          ctx.beginPath(); ctx.moveTo(cx+dx*cs,cy); ctx.lineTo(cx,cy); ctx.lineTo(cx,cy+dy*cs); ctx.stroke();
        });
        ctx.font = 'bold 11px monospace';
        const tw = ctx.measureText(label).width;
        ctx.fillStyle = color; ctx.fillRect(x, y - 18, tw + 10, 18);
        ctx.fillStyle = '#000'; ctx.fillText(label, x + 5, y - 4);
      });
      ctx.fillStyle = 'rgba(0,0,0,0.04)';
      for (let i = 0; i < canvas.height; i += 4) ctx.fillRect(0, i, canvas.width, 2);
    };
    img.src = `data:image/jpeg;base64,${base64Frame}`;
  }, []);

  // AI health check
  useEffect(() => {
    const check = async () => {
      try {
        const res = await axios.get(`${API_URL}/ai/health`, { timeout: 3000 });
        setAiServiceOnline(res.data?.status === 'healthy');
      } catch { setAiServiceOnline(false); }
    };
    check();
    const t = setInterval(check, 15000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    fetchCameras();
    fetchAlerts();
    fetchLiveStreams();
    connectSocket();
    const interval = setInterval(() => { fetchCameras(); fetchAlerts(); fetchLiveStreams(); }, 10000);
    return () => { clearInterval(interval); if (socketRef.current) socketRef.current.disconnect(); };
  }, []);

  const connectSocket = () => {
    try {
      const userData = JSON.parse(localStorage.getItem('user') || '{}');
      const authToken = userData?.id ? String(userData.id) : null;
      const socket = io(SOCKET_URL, {
        transports: ['websocket', 'polling'],
        reconnection: true, reconnectionAttempts: 5,
        reconnectionDelay: 3000, timeout: 10000,
        auth: { token: authToken }
      });

      socket.on('connect', () => { setIsConnected(true); socket.emit('get-streams'); });
      socket.on('connect_error', () => setIsConnected(false));
      socket.on('disconnect', () => setIsConnected(false));

      socket.on('streams-list', (streams) => {
        setLiveStreams(streams || []);
        setStats(prev => ({ ...prev, liveStreams: streams?.length || 0 }));
      });

      socket.on('stream-started', (data) => {
        setLiveStreams(prev => [...prev, { streamId: data.streamId, cameraName: data.cameraName, location: data.location, viewerCount: 0, startTime: data.startTime }]);
        setStats(prev => ({ ...prev, liveStreams: prev.liveStreams + 1 }));
        addAlert(`🎥 New live stream started: ${data.cameraName}`);
      });

      socket.on('stream-ended', (data) => {
        setLiveStreams(prev => prev.filter(s => s.streamId !== data.streamId));
        setStats(prev => ({ ...prev, liveStreams: Math.max(0, prev.liveStreams - 1) }));
        if (selectedStreamRef.current?.streamId === data.streamId) { setShowStreamModal(false); setSelectedStream(null); }
        setStreamFrames(prev => { const n = { ...prev }; delete n[data.streamId]; return n; });
        addAlert(`🛑 Live stream ended: ${data.cameraName}`);
      });

      socket.on('stream-updated', (data) => {
        setLiveStreams(prev => prev.map(s => s.streamId === data.streamId ? { ...s, viewerCount: data.viewerCount } : s));
      });

      socket.on('stream-frame', (data) => {
        if (!data.frame || data.frame.length < 100) return;
        setStreamFrames(prev => ({ ...prev, [data.streamId]: data.frame }));

        // Trigger AI analysis for the open stream
        if (selectedStreamRef.current?.streamId === data.streamId) {
          socket.emit('ai-analyze-frame', { streamId: data.streamId, frame: data.frame });
        }

        // Thumbnail card update
        const thumbEl = document.getElementById(`video-${data.streamId}`);
        if (thumbEl) {
          thumbEl.src = `data:image/jpeg;base64,${data.frame}`;
          thumbEl.style.display = 'block';
          const ph = document.getElementById(`placeholder-${data.streamId}`);
          if (ph) ph.style.display = 'none';
        }

        // Canvas draw for modal
        if (selectedStreamRef.current?.streamId === data.streamId) {
          drawFrameOnCanvas(data.frame, currentDetectionRef.current);
        }
      });

      // AI events
      socket.on('ai-detection', (data) => {
        currentDetectionRef.current = data;
        setCurrentDetection(data);
        setAiFrameCounter(c => c + 1);
        setAiStatus(data.isAlert ? 'alert' : 'active');
        setAiEventTimeline(prev => [data, ...prev].slice(0, 30));
      });

      socket.on('ai-alert', (data) => {
        setAiStatus('alert');
        setTimeout(() => setAiStatus(prev => prev === 'alert' ? 'active' : prev), 8000);
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
    setCurrentDetection(null);
    currentDetectionRef.current = null;
    setAiStatus('active');
    if (socketRef.current?.connected) socketRef.current.emit('join-stream', stream.streamId);
    setTimeout(() => {
      if (streamFrames[stream.streamId]) drawFrameOnCanvas(streamFrames[stream.streamId], null);
    }, 100);
  };

  const closeStreamModal = () => {
    if (selectedStreamRef.current && socketRef.current?.connected)
      socketRef.current.emit('leave-stream', selectedStreamRef.current.streamId);
    setShowStreamModal(false);
    setShowAssignPanel(false);
    setAssignTypes([]);
    setAssignNotes('');
    setSelectedStream(null);
    selectedStreamRef.current = null;
    setCurrentDetection(null);
    setAiStatus('idle');
  };

  const exportAIEvents = () => {
    const blob = new Blob([JSON.stringify(aiEventTimeline, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `ai-events-${Date.now()}.json`; a.click();
    URL.revokeObjectURL(url);
  };

  const getStatusColor = (status) => {
    switch (status) { case 'active': return 'bg-emerald-500'; case 'maintenance': return 'bg-amber-500'; default: return 'bg-red-500'; }
  };
  const getStatusText = (status) => {
    switch (status) { case 'active': return 'ACTIVE'; case 'maintenance': return 'MAINTENANCE'; default: return 'OFFLINE'; }
  };
  const formatTime = (dateString) => {
    if (!dateString) return 'Never';
    const diff = Math.floor((new Date() - new Date(dateString)) / 60000);
    if (diff < 60) return `${diff} min ago`;
    if (diff < 1440) return `${Math.floor(diff / 60)} hours ago`;
    return `${Math.floor(diff / 1440)} days ago`;
  };

  const aiStatusColor = aiStatus === 'alert'
    ? 'bg-red-500/20 border-red-500/50 text-red-300'
    : aiStatus === 'active'
    ? 'bg-yellow-500/20 border-yellow-500/40 text-yellow-300'
    : 'bg-slate-700 border-slate-600 text-slate-400';

  const SidebarComponent = user?.role === 'SuperResponder'
    ? <SuperResponderSidebar user={user} />
    : <ResponderSidebar activeTab="cctv feed" setActiveTab={() => {}} user={user} />;

  if (loading) {
    return (
      <div className="flex h-screen bg-zinc-50">
        {SidebarComponent}
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
      {SidebarComponent}

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-16 bg-white border-b border-zinc-200 px-8 flex items-center justify-between shadow-sm flex-shrink-0">
          <div className="flex items-center gap-4">
            <div className="relative">
              <Camera className="w-7 h-7 text-emerald-600" />
              {activeLiveStreams > 0 && <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-pulse" />}
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">CCTV Surveillance</h1>
              <div className="flex items-center gap-2">
                <p className="text-sm text-zinc-500">Live monitoring & AI detection</p>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${aiServiceOnline ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600' : 'bg-zinc-100 border-zinc-200 text-zinc-400'}`}>
                  {aiServiceOnline ? '🤖 AI Online' : '🤖 AI Offline'}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {!isConnected && (
              <div className="flex items-center gap-2 bg-amber-50 px-3 py-1.5 rounded-full">
                <div className="w-2 h-2 bg-amber-500 rounded-full" />
                <span className="text-xs font-medium text-amber-600">Reconnecting...</span>
              </div>
            )}
            {activeLiveStreams > 0 && (
              <div className="flex items-center gap-2 bg-red-50 px-3 py-1.5 rounded-full">
                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                <span className="text-xs font-medium text-red-600">{activeLiveStreams} Live</span>
              </div>
            )}
            <div className="relative">
              <button onClick={() => setShowAlerts(!showAlerts)} className="relative p-2 hover:bg-zinc-100 rounded-xl transition-all">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                {unreadAlerts > 0 && <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">{unreadAlerts}</span>}
              </button>
              {showAlerts && (
                <div className="absolute right-0 top-12 w-80 bg-white rounded-2xl shadow-xl border border-zinc-200 z-50">
                  <div className="p-4 border-b border-zinc-100"><h3 className="font-semibold">Recent Alerts</h3></div>
                  <div className="max-h-80 overflow-y-auto">
                    {alerts.length === 0 ? <p className="p-4 text-center text-zinc-500">No alerts</p> : alerts.map(alert => (
                      <div key={alert.id} className={`p-3 border-b border-zinc-100 hover:bg-zinc-50 cursor-pointer ${!alert.is_viewed ? 'bg-amber-50' : ''}`} onClick={() => markAlertRead(alert.id)}>
                        <p className="text-sm font-medium">{alert.incident_type || 'System Alert'}</p>
                        <p className="text-xs text-zinc-500 mt-1">{alert.alert_message || alert.message}</p>
                        <p className="text-xs text-zinc-400 mt-1">{formatTime(alert.created_at)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <button onClick={handleRefresh} className={`flex items-center gap-2 px-4 py-2 bg-white border border-zinc-300 hover:border-emerald-300 rounded-2xl text-sm font-medium transition-all ${refreshing ? 'opacity-50' : ''}`}>
              <RefreshCw size={16} className={`text-emerald-600 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </header>

        <main className="flex-1 p-6 overflow-auto bg-zinc-50">
          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-6">
            {[
              { label: 'Total Cameras', value: stats.total, icon: Camera, color: 'text-emerald-500' },
              { label: 'Active', value: stats.active, icon: Video, color: 'text-emerald-600', bold: 'text-emerald-600' },
              { label: 'Live Streams', value: stats.liveStreams, icon: Radio, color: 'text-red-500', bold: 'text-red-500' },
              { label: 'Offline', value: stats.offline, icon: WifiOff, color: 'text-red-400', bold: 'text-red-500' },
              { label: 'Viewers', value: stats.viewers, icon: Users, color: 'text-blue-500', bold: 'text-blue-500' },
            ].map(({ label, value, icon: Icon, color, bold }) => (
              <div key={label} className="bg-white p-4 rounded-2xl border border-zinc-200 shadow-sm">
                <div className="flex items-center justify-between">
                  <div><p className="text-zinc-500 text-xs">{label}</p><p className={`text-2xl font-bold ${bold || 'text-zinc-900'}`}>{value}</p></div>
                  <Icon className={`w-7 h-7 opacity-40 ${color}`} />
                </div>
              </div>
            ))}
          </div>

          {/* Live Broadcasts */}
          {activeLiveStreams > 0 && (
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <Radio className="w-4 h-4 text-red-500" />
                <h2 className="text-base font-semibold text-zinc-900">Live Broadcasts</h2>
                <span className="bg-red-100 text-red-600 text-xs px-2 py-0.5 rounded-full">{activeLiveStreams} active</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {liveStreams.map((stream) => (
                  <div key={stream.streamId} onClick={() => watchLiveStream(stream)}
                    className="group bg-white rounded-2xl border-2 border-red-500 overflow-hidden shadow-lg hover:shadow-xl transition-all cursor-pointer hover:-translate-y-1">
                    <div className="relative aspect-video bg-zinc-900 overflow-hidden">
                      <img id={`video-${stream.streamId}`} className="w-full h-full object-cover absolute inset-0" style={{ display: streamFrames[stream.streamId] ? 'block' : 'none' }} alt="" />
                      <div id={`placeholder-${stream.streamId}`} className="absolute inset-0 flex flex-col items-center justify-center" style={{ display: streamFrames[stream.streamId] ? 'none' : 'flex' }}>
                        <Radio className="w-10 h-10 text-red-500 mb-2 animate-pulse" />
                        <p className="text-white text-xs">Loading stream...</p>
                      </div>
                      <div className="absolute top-2 left-2 flex items-center gap-1.5 z-10">
                        <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                        <span className="text-white text-xs font-bold bg-black/60 px-1.5 py-0.5 rounded">LIVE</span>
                      </div>
                      <div className="absolute top-2 right-2 bg-black/60 text-white text-xs px-1.5 py-0.5 rounded flex items-center gap-1 z-10">
                        <Eye className="w-3 h-3" />{stream.viewerCount || 0}
                      </div>
                    </div>
                    <div className="p-3">
                      <p className="font-semibold text-zinc-900 text-sm">{stream.cameraName}</p>
                      <p className="text-xs text-zinc-500 mt-0.5 flex items-center gap-1"><MapPin className="w-3 h-3" />{stream.location}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Status bar */}
          <div className="flex items-center justify-between bg-white px-4 py-3 rounded-2xl border border-zinc-100 shadow-sm mb-6 text-sm">
            <div className="flex items-center gap-6">
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse inline-block" /><span className="font-medium text-emerald-700">{stats.active} Active</span></span>
              {activeLiveStreams > 0 && <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse inline-block" /><span className="font-medium text-red-700">{activeLiveStreams} Live</span></span>}
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-zinc-400 inline-block" /><span className="text-zinc-500">{stats.offline} Offline</span></span>
            </div>
            <span className="text-xs text-zinc-400 font-mono">{isConnected ? '🟢 Connected' : '🔴 Disconnected'} · {new Date().toLocaleTimeString()}</span>
          </div>

          {/* Camera grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {cameras.map((camera) => (
              <div key={camera.id} onClick={() => { setSelectedCamera(camera); setShowModal(true); }}
                className={`group relative bg-white border rounded-3xl overflow-hidden shadow hover:shadow-xl transition-all duration-300 cursor-pointer hover:-translate-y-1 ${camera.status === 'active' ? 'border-emerald-500 border-2' : 'border-zinc-200'}`}>
                <div className="relative aspect-video bg-zinc-950 flex items-center justify-center overflow-hidden">
                  <div className="absolute inset-0 bg-[radial-gradient(#444_0.8px,transparent_1px)] bg-[length:3px_3px] opacity-40" />
                  {camera.status === 'active' ? (
                    <>
                      <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-black/70 text-white text-xs px-2.5 py-1 rounded-full font-medium">
                        <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />ACTIVE
                      </div>
                      <div className="flex flex-col items-center justify-center text-white/70 group-hover:text-white transition-colors">
                        <Play className="w-12 h-12 mb-1" /><p className="text-xs tracking-widest">CAMERA FEED</p>
                      </div>
                    </>
                  ) : (
                    <div className="text-center text-white/50">
                      <Camera className="w-14 h-14 mx-auto mb-3 opacity-40" /><p className="font-medium">OFFLINE</p>
                    </div>
                  )}
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
                    <p className="text-white font-semibold">{camera.camera_name}</p>
                    <p className="text-emerald-300 text-xs flex items-center gap-1"><MapPin className="w-3 h-3" />{camera.location_name || 'Unknown'}</p>
                  </div>
                  <div className="absolute top-3 right-3 bg-black/70 text-white text-[10px] px-2 py-0.5 rounded font-mono">{camera.resolution || '1080p'}</div>
                </div>
                <div className="p-3 flex items-center justify-between border-t border-zinc-100">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${getStatusColor(camera.status)}`} />
                    <p className={`text-xs font-medium ${camera.status === 'active' ? 'text-emerald-600' : camera.status === 'maintenance' ? 'text-amber-600' : 'text-red-600'}`}>{getStatusText(camera.status)}</p>
                  </div>
                  {camera.status === 'active' && (
                    <button className="p-1.5 hover:bg-emerald-50 text-emerald-600 rounded-xl transition-colors opacity-0 group-hover:opacity-100" onClick={(e) => { e.stopPropagation(); startRecording(camera.id); }}>
                      <Circle className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </main>
      </div>

      {/* ── AI-Enhanced Live Stream Modal ─────────────────────────────────────── */}
      {showStreamModal && selectedStream && (
        <div className="fixed inset-0 bg-black/95 flex z-50" onClick={closeStreamModal}>
          <div ref={modalRowRef} className="flex flex-row flex-1 m-4 max-h-full overflow-hidden" style={{ gap: 0 }} onClick={(e) => e.stopPropagation()}>

            {/* Video panel */}
            <div className="flex flex-col bg-slate-900 rounded-l-2xl overflow-hidden border border-slate-700 min-w-0" style={{ flex: 1 }}>
              <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between flex-shrink-0 bg-slate-800/80">
                <div className="flex items-center gap-3">
                  <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                  <span className="text-white font-bold text-sm">LIVE:</span>
                  <span className="text-red-300 font-semibold text-sm">{selectedStream.cameraName}</span>
                  <span className="text-slate-400 text-xs flex items-center gap-1"><MapPin size={10} />{selectedStream.location}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-bold ${aiStatusColor}`}>
                    <Cpu size={10} />{aiStatus === 'alert' ? '⚠ AI ALERT' : aiStatus === 'active' ? 'AI ACTIVE' : 'AI IDLE'}
                  </div>
                  <button onClick={closeStreamModal} className="p-1.5 hover:bg-slate-700 rounded-xl text-slate-400 hover:text-white transition-colors"><X size={16} /></button>
                </div>
              </div>

              {/* Canvas video with bbox overlay */}
              <div className="relative flex-1 bg-black overflow-hidden" style={{ minHeight: 0 }}>
                <canvas ref={modalCanvasRef} className="w-full h-full object-contain"
                  style={{ display: streamFrames[selectedStream.streamId] ? 'block' : 'none', imageRendering: 'auto' }} />
                {!streamFrames[selectedStream.streamId] && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center">
                      <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-3 animate-pulse">
                        <Radio size={28} className="text-red-500" />
                      </div>
                      <p className="text-white font-semibold">Connecting to stream...</p>
                      <p className="text-slate-400 text-sm mt-1">Waiting for video feed</p>
                    </div>
                  </div>
                )}
                {/* Detected objects chips */}
                {currentDetection?.detections?.length > 0 && (
                  <div className="absolute top-3 left-3 flex flex-wrap gap-1.5 max-w-[60%]">
                    {[...new Set(currentDetection.detections.map(d => d.label))].slice(0, 6).map(label => (
                      <span key={label} className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                        style={{ backgroundColor: getLabelColor(label), color: '#000' }}>{label}</span>
                    ))}
                  </div>
                )}
                {/* Alert overlay */}
                {aiStatus === 'alert' && currentDetection?.isAlert && (
                  <div className="absolute top-3 right-3 bg-red-600/90 backdrop-blur border border-red-400/60 rounded-xl px-4 py-2 flex items-center gap-2">
                    <AlertCircle size={14} className="text-white flex-shrink-0 animate-pulse" />
                    <div className="min-w-0">
                      <p className="text-white font-bold text-xs truncate">{currentDetection.decision}</p>
                      <p className="text-red-200 text-[10px]">{currentDetection.accidentConfidence}% confidence</p>
                    </div>
                  </div>
                )}
                {aiStatus === 'active' && !currentDetection?.isAlert && (
                  <div className="absolute bottom-3 left-3 flex items-center gap-2 bg-yellow-500/20 backdrop-blur border border-yellow-500/40 px-3 py-1.5 rounded-full">
                    <Cpu size={12} className="text-yellow-400" />
                    <span className="text-yellow-300 text-[11px] font-bold">AI Analyzing</span>
                    <span className="w-1.5 h-1.5 bg-yellow-400 rounded-full animate-pulse" />
                  </div>
                )}
              </div>

              {/* Inline Assignment Panel — slides up when open */}
              {showAssignPanel && (
                <div className="border-t border-slate-700 bg-slate-900 flex-shrink-0">
                  <div className="px-4 pt-3 pb-1 flex items-center justify-between">
                    <p className="text-xs font-bold text-white flex items-center gap-1.5">
                      <Users size={12} className="text-red-400" /> Assign Responder Teams
                    </p>
                    <button onClick={() => { setShowAssignPanel(false); setAssignTypes([]); setAssignNotes(''); }}
                      className="text-slate-600 hover:text-slate-400">
                      <X size={13} />
                    </button>
                  </div>

                  {/* Responder type grid */}
                  <div className="px-4 pb-2 grid grid-cols-3 gap-1.5">
                    {[
                      { value: 'Traffic Police',          emoji: '🚔' },
                      { value: 'Ambulance / Medical',     emoji: '🚑' },
                      { value: 'Fire Brigade',            emoji: '🔥' },
                      { value: 'Armed Police',            emoji: '🔫' },
                      { value: 'Road Safety',             emoji: '🛣️' },
                      { value: 'Construction Safety',     emoji: '🏗️' },
                      { value: 'Disaster Management',     emoji: '🌊' },
                      { value: 'Municipal Emergency',     emoji: '🏙️' },
                      { value: 'Technical Investigation', emoji: '🔍' },
                    ].map(rt => {
                      const sel = assignTypes.includes(rt.value);
                      return (
                        <button key={rt.value}
                          onClick={() => setAssignTypes(prev => sel ? prev.filter(t => t !== rt.value) : [...prev, rt.value])}
                          className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg border text-[10px] font-semibold transition-all ${
                            sel
                              ? 'bg-red-900/50 border-red-600/60 text-red-200'
                              : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500'
                          }`}>
                          <span>{rt.emoji}</span>
                          <span className="leading-tight truncate">{rt.value}</span>
                          {sel && <CheckCircle size={9} className="ml-auto flex-shrink-0 text-red-300" />}
                        </button>
                      );
                    })}
                  </div>

                  {/* Notes */}
                  <div className="px-4 pb-2">
                    <textarea
                      value={assignNotes}
                      onChange={e => setAssignNotes(e.target.value)}
                      placeholder="Emergency notes (optional)..."
                      rows={2}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-2 text-[11px] text-white placeholder-slate-600 resize-none focus:outline-none focus:border-slate-500"
                    />
                  </div>

                  {/* Submit */}
                  <div className="px-4 pb-3 flex gap-2">
                    {assignSuccess ? (
                      <div className="flex-1 py-2 bg-emerald-900/40 border border-emerald-700/50 text-emerald-300 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5">
                        <CheckCircle size={12} /> Assigned successfully!
                      </div>
                    ) : (
                      <button
                        disabled={assignTypes.length === 0 || assigning}
                        onClick={async () => {
                          if (!assignTypes.length) return;
                          setAssigning(true);
                          try {
                            // Find latest pending incident for this stream
                            const res = await axios.get(
                              `${API_URL}/super-responder/incidents?limit=20`
                            );
                            const match = (res.data || []).find(
                              i => i.stream_id === selectedStream?.streamId && i.status === 'pending'
                            );
                            if (match) {
                              // Assign the existing pending incident
                              await axios.post(
                                `${API_URL}/super-responder/incidents/${match.id}/assign`,
                                { assignedTypes: assignTypes, notes: assignNotes }
                              );
                            } else {
                              // No DB incident yet — emit socket so SuperResponder dashboard
                              // and responders are notified immediately
                              socketRef.current?.emit('manual-assign', {
                                streamId: selectedStream?.streamId,
                                cameraName: selectedStream?.cameraName,
                                location: selectedStream?.location || 'Unknown',
                                decision: currentDetection?.decision || 'Manual Dispatch',
                                severity: currentDetection?.severity || 'Medium Risk',
                                incidentCategory: currentDetection?.incidentCategory || 'Unknown',
                                accidentConfidence: currentDetection?.accidentConfidence || 0,
                                assignedTypes: assignTypes,
                                assignedBy: 'manual',
                                notes: assignNotes,
                                timestamp: new Date().toISOString(),
                              });
                            }
                            setAssignSuccess(true);
                            setTimeout(() => {
                              setAssignSuccess(false);
                              setShowAssignPanel(false);
                              setAssignTypes([]);
                              setAssignNotes('');
                            }, 2000);
                          } catch (err) {
                            console.error('Assign error:', err.message);
                          } finally {
                            setAssigning(false);
                          }
                        }}
                        className={`flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all border ${
                          assignTypes.length === 0 || assigning
                            ? 'bg-slate-800 border-slate-700 text-slate-600 cursor-not-allowed'
                            : 'bg-red-600 border-red-500 text-white hover:bg-red-500'
                        }`}>
                        {assigning
                          ? <><div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" /> Assigning...</>
                          : <><Users size={12} /> Assign {assignTypes.length > 0 ? `(${assignTypes.length})` : ''}</>}
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Action bar */}
              <div className="px-4 py-3 border-t border-slate-700 flex gap-2 flex-shrink-0 bg-slate-800/80">
                <button
                  onClick={() => { setShowAssignPanel(p => !p); setAssignSuccess(false); }}
                  className={`flex-1 py-2 border rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                    showAssignPanel
                      ? 'bg-red-600 border-red-500 text-white'
                      : currentDetection?.isAlert || aiStatus === 'alert'
                        ? 'bg-red-500/20 border-red-500/50 text-red-300 hover:bg-red-500/30 animate-pulse'
                        : 'bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600'
                  }`}>
                  <Users size={13} />
                  {showAssignPanel
                    ? 'Hide Assignment'
                    : currentDetection?.isAlert || aiStatus === 'alert'
                      ? '🚨 Assign Responders'
                      : 'Assign Responders'}
                </button>
                <button className="flex-1 py-2 bg-slate-700 border border-slate-600 text-slate-300 rounded-xl text-xs font-bold hover:bg-slate-600 transition-colors flex items-center justify-center gap-1.5">
                  <Download size={13} /> Save Clip
                </button>
                <button onClick={closeStreamModal} className="flex-1 py-2 bg-slate-700 border border-slate-600 text-slate-300 rounded-xl text-xs font-bold hover:bg-slate-600 transition-colors">Close</button>
              </div>
            </div>

            {/* Drag divider */}
            <div onMouseDown={onDividerMouseDown}
              className="flex-shrink-0 flex items-center justify-center bg-slate-800 border-y border-slate-700 hover:bg-indigo-500/20 transition-colors group"
              style={{ width: 6, cursor: 'col-resize', zIndex: 10 }}>
              <div className="w-0.5 h-8 rounded-full bg-slate-600 group-hover:bg-indigo-400 transition-colors" />
            </div>

            {/* AI side panel */}
            <div className="flex-shrink-0 bg-slate-900 rounded-r-2xl border border-slate-700 flex flex-col overflow-hidden" style={{ width: aiPanelWidth }}>
              <div className="px-4 py-3 border-b border-slate-700 bg-slate-800/60 flex-shrink-0">
                <div className="flex items-center gap-2">
                  <Cpu size={14} className="text-yellow-400" />
                  <span className="text-xs font-bold text-white">AI Intelligence</span>
                  <span className={`ml-auto text-[9px] font-bold px-2 py-0.5 rounded-full border ${aiStatusColor}`}>{aiStatus.toUpperCase()}</span>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-3 space-y-3">
                {/* GPS Map */}
                <StreamLocationMap locationStr={selectedStream.location} />

                {/* Current Detection */}
                {currentDetection ? (
                  <>
                    <div className={`rounded-xl p-3 border ${currentDetection.isAlert ? 'bg-red-500/15 border-red-500/50' : currentDetection.accidentConfidence >= 45 ? 'bg-yellow-500/10 border-yellow-500/40' : 'bg-slate-800 border-slate-700'}`}>
                      {currentDetection.incidentCategory && currentDetection.incidentCategory !== 'None' && (
                        <div className="mb-2">
                          <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${currentDetection.isAlert ? 'bg-red-500/20 border-red-500/40 text-red-300' : 'bg-yellow-500/20 border-yellow-500/40 text-yellow-300'}`}>
                            {currentDetection.incidentCategory}
                          </span>
                        </div>
                      )}
                      <p className="text-[10px] text-slate-400 uppercase font-bold mb-1">AI Decision</p>
                      <p className={`text-sm font-bold mb-2 ${currentDetection.isAlert ? 'text-red-300' : currentDetection.accidentConfidence >= 45 ? 'text-yellow-300' : 'text-emerald-300'}`}>
                        {currentDetection.decision}
                      </p>
                      <ConfidenceBar value={currentDetection.accidentConfidence} />
                      <div className="mt-2 flex items-center justify-between">
                        <SeverityBadge severity={currentDetection.severity} />
                        <span className="text-[9px] text-slate-500">{currentDetection.framesAnalyzed} frames · {aiFrameCounter} analyzed</span>
                      </div>
                    </div>

                    {/* Response Action */}
                    <div className="bg-slate-800 rounded-xl p-3 border border-slate-700">
                      <p className="text-[10px] text-slate-400 uppercase font-bold mb-1 flex items-center gap-1"><Shield size={9} /> Suggested Action</p>
                      <p className="text-xs text-white font-medium">{currentDetection.responseAction}</p>
                    </div>

                    {/* Tracked objects */}
                    {currentDetection.trackedObjects?.length > 0 && (
                      <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
                        <div className="px-3 py-2 border-b border-slate-700 flex items-center gap-1.5">
                          <Crosshair size={11} className="text-yellow-400" />
                          <span className="text-[10px] font-bold text-slate-300">Tracked Objects</span>
                          <span className="ml-auto text-[9px] text-slate-500">{currentDetection.trackedObjects.length}</span>
                        </div>
                        <div className="divide-y divide-slate-700/60 max-h-48 overflow-y-auto">
                          {currentDetection.trackedObjects.map((obj) => (
                            <div key={obj.id} className="px-3 py-2 flex items-center gap-2">
                              <span className="text-[9px] font-mono text-yellow-400 w-6">{obj.id}</span>
                              <span className="text-xs font-semibold text-white flex-1 capitalize">{obj.label}</span>
                              <span className="text-[10px] text-slate-400">{obj.direction}</span>
                              <span className="text-[10px] font-mono text-slate-300">{obj.confidence}%</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex flex-col items-center py-10 text-slate-600">
                    <div className="w-12 h-12 border-2 border-yellow-500/30 rounded-full flex items-center justify-center mb-3 animate-pulse">
                      <Cpu size={20} className="text-yellow-400/50" />
                    </div>
                    <p className="text-xs font-medium">Waiting for first frame...</p>
                    <p className="text-[10px] mt-1">AI will activate automatically</p>
                  </div>
                )}

                {/* Mini timeline */}
                {aiEventTimeline.length > 0 && (
                  <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
                    <div className="px-3 py-2 border-b border-slate-700 flex items-center gap-1.5">
                      <Clock size={11} className="text-indigo-400" />
                      <span className="text-[10px] font-bold text-slate-300">Recent Events</span>
                      <button onClick={exportAIEvents} className="ml-auto p-1 hover:bg-slate-600 rounded text-slate-400 hover:text-white">
                        <Download size={10} />
                      </button>
                    </div>
                    <div className="divide-y divide-slate-700/40 max-h-40 overflow-y-auto">
                      {aiEventTimeline.slice(0, 6).map((ev, i) => (
                        <div key={i} className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            {ev.isAlert ? <AlertCircle size={10} className="text-red-400 flex-shrink-0" /> : <CheckCircle size={10} className="text-emerald-500 flex-shrink-0" />}
                            <p className={`text-[10px] font-medium flex-1 truncate ${ev.isAlert ? 'text-red-300' : 'text-slate-300'}`}>{ev.decision}</p>
                            <span className="text-[9px] text-slate-500 font-mono flex-shrink-0">{new Date(ev.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Camera Detail Modal */}
      {showModal && selectedCamera && (
        <div className="fixed inset-0 bg-black/85 flex items-center justify-center z-50 p-4" onClick={() => setShowModal(false)}>
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-3xl w-full overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-slate-700 flex items-center justify-between bg-slate-800/80">
              <div>
                <h2 className="font-bold text-white">{selectedCamera.camera_name}</h2>
                <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5"><MapPin size={10} />{selectedCamera.location_name || 'Unknown'}</p>
              </div>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-slate-700 rounded-xl text-slate-400 hover:text-white transition-colors"><X size={16} /></button>
            </div>
            <div className="relative bg-black aspect-video">
              {selectedCamera.status === 'active' && selectedCamera.stream_url
                ? <video src={selectedCamera.stream_url} controls autoPlay className="w-full h-full object-contain" />
                : <div className="flex items-center justify-center h-full"><div className="text-center"><Camera className="w-12 h-12 text-slate-600 mx-auto mb-3" /><p className="text-slate-500">Camera is offline</p></div></div>}
              {selectedCamera.status === 'active' && (
                <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-emerald-500 text-white px-2.5 py-1 rounded-full text-xs font-bold">
                  <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" /> ACTIVE
                </div>
              )}
            </div>
            <div className="p-4 grid grid-cols-4 gap-3">
              {[
                { label: 'Status', value: getStatusText(selectedCamera.status) },
                { label: 'Resolution', value: selectedCamera.resolution || '1080p' },
                { label: 'Last Active', value: formatTime(selectedCamera.last_active) },
                { label: 'Recordings', value: `${selectedCamera.recording_count || 0} clips` },
              ].map(({ label, value }) => (
                <div key={label} className="bg-slate-800 p-3 rounded-xl border border-slate-700">
                  <p className="text-[10px] text-slate-500 mb-1">{label}</p>
                  <p className="text-sm font-semibold text-white">{value}</p>
                </div>
              ))}
            </div>
            <div className="px-4 pb-4 flex gap-2">
              {selectedCamera.status === 'active' && (
                <button onClick={() => startRecording(selectedCamera.id)} className="flex-1 py-2.5 bg-red-500/20 border border-red-500/40 text-red-300 rounded-xl text-xs font-bold hover:bg-red-500/30 transition-colors flex items-center justify-center gap-1.5">
                  <Circle size={12} /> Record
                </button>
              )}
              <button onClick={() => setShowModal(false)} className="flex-1 py-2.5 bg-slate-700 border border-slate-600 text-slate-300 rounded-xl text-xs font-bold hover:bg-slate-600 transition-colors">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ResponderCCTV;