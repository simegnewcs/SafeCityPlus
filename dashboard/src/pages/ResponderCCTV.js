import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import ResponderSidebar from "../layout/ResponderSidebar";
import SuperResponderSidebar from "../layout/SuperResponderSidebar";
import {
  Play, RefreshCw, Camera,
  AlertTriangle, Eye, Video, Radio, WifiOff, X,
  Circle, Square, Users, MapPin, Cpu, Shield, Download,
  AlertCircle, CheckCircle, Crosshair, Clock, ChevronDown, ChevronUp, BarChart2,
  Film, ChevronLeft, ChevronRight
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
  const [address,        setAddress]        = React.useState(null);
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
    if (!incidentCoords) return;
    const { lat: iLat, lng: iLng } = incidentCoords;

    const html = `<!DOCTYPE html><html><head>
<meta charset="utf-8"/>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"><\/script>
<style>html,body,#map{margin:0;padding:0;width:100%;height:100%;background:#0f172a}</style>
</head><body><div id="map"></div>
<script>
  var map = L.map('map',{zoomControl:true,attributionControl:false}).setView([${iLat},${iLng}],18);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19}).addTo(map);
  var redIcon = L.divIcon({className:'',html:'<div style="width:16px;height:16px;background:#ef4444;border:3px solid #fff;border-radius:50%;box-shadow:0 0 12px #ef4444"></div>',iconAnchor:[8,8]});
  L.marker([${iLat},${iLng}],{icon:redIcon}).addTo(map).bindPopup('<b>📍 Incident Location</b><br><small>GPS: ${iLat.toFixed(6)}, ${iLng.toFixed(6)}</small>').openPopup();
<\/script></body></html>`;

    if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
    const blob = new Blob([html], { type: 'text/html' });
    const url  = URL.createObjectURL(blob);
    blobUrlRef.current = url;
    setIframeSrc(url);
  }, [incidentCoords]);

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
  
  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
      <div className="px-3 py-2 border-b border-slate-700 flex items-center gap-1.5">
        <MapPin size={11} className="text-emerald-400" />
        <span className="text-[10px] font-bold text-slate-300">Incident Location</span>
        <a href={osmLink} target="_blank" rel="noreferrer" className="ml-auto text-[9px] text-indigo-400 hover:text-indigo-300">Open ↗</a>
      </div>
      {iframeSrc && <iframe title="stream-location" src={iframeSrc} width="100%" height="200" style={{ border: 0, display: 'block' }} sandbox="allow-scripts allow-same-origin" />}
      <div className="px-3 py-2.5 space-y-2">
        <div>
          <span className="text-[9px] font-mono text-emerald-400">{iLat.toFixed(5)}, {iLng.toFixed(5)}</span>
          {address && <p className="text-[10px] text-slate-300 leading-tight mt-0.5">{address}</p>}
        </div>
        <div className="flex items-center gap-3 text-[9px] text-slate-500">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> Incident Location</span>
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

  // Role-based access control state
  const [assignedIncidents, setAssignedIncidents] = useState([]);
  const [accessibleStreamIds, setAccessibleStreamIds] = useState([]);
  const [responderType, setResponderType] = useState(user?.responder_type || '');
  const [showAssignmentPanel, setShowAssignmentPanel] = useState(true);
  const [loadingAssignments, setLoadingAssignments] = useState(false);
  const isSuperResponder = user?.role === 'SuperResponder' || user?.role === 'Admin';

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

  // Recording playback modal state
  const [recPlayback, setRecPlayback]           = useState(null); // { recording, frames, frame, playing }
  const [recPlaybackLoading, setRecPlaybackLoading] = useState(false);
  const recPlayIntervalRef = useRef(null);

  // Auto-recording state from backend
  const [autoRecState, setAutoRecState] = useState(null); // { state, frameCount, maxFrames }
  const autoRecStateRef = useRef(null);

  // Manual recording
  const [isRecording, setIsRecording] = useState(false);
  const [recordingFrameCount, setRecordingFrameCount] = useState(0);
  const recordingBufferRef = useRef([]);
  const recordingIntervalRef = useRef(null);
  const [recordingPreview, setRecordingPreview] = useState(null);
  const previewIntervalRef = useRef(null);

  /* ── Recording playback ── */
  const openRecordingForIncident = async (incident) => {
    // Try recording_id first (joined from DB), then search by stream_id
    setRecPlaybackLoading(true);
    try {
      let recId = incident.recording_id || null;

      if (!recId && incident.stream_id) {
        // Search recordings list for matching stream_id
        const listRes = await axios.get(`${API_URL}/super-responder/recordings`);
        const recs = listRes.data?.recordings || [];
        const match = recs.find(r => r.stream_id === incident.stream_id);
        if (match) recId = match.id;
      }

      if (!recId) {
        addAlert('⚠️ No recording found for this incident');
        return;
      }

      const framesRes = await axios.get(`${API_URL}/super-responder/recordings/${recId}/frames`);
      const { recording, frames } = framesRes.data;
      if (!frames || frames.length === 0) {
        addAlert('⚠️ Recording has no frames');
        return;
      }
      setRecPlayback({ recording, frames, frame: 0, playing: false });
    } catch (e) {
      addAlert('Failed to load recording: ' + e.message);
    } finally {
      setRecPlaybackLoading(false);
    }
  };

  const closeRecPlayback = () => {
    clearInterval(recPlayIntervalRef.current);
    setRecPlayback(null);
  };

  const toggleRecPlay = () => {
    if (!recPlayback) return;
    if (recPlayback.playing) {
      clearInterval(recPlayIntervalRef.current);
      setRecPlayback(p => ({ ...p, playing: false }));
    } else {
      recPlayIntervalRef.current = setInterval(() => {
        setRecPlayback(p => {
          if (!p) return p;
          const next = p.frame + 1;
          if (next >= p.frames.length) {
            clearInterval(recPlayIntervalRef.current);
            return { ...p, playing: false, frame: p.frames.length - 1 };
          }
          return { ...p, frame: next };
        });
      }, 120);
      setRecPlayback(p => ({ ...p, playing: true }));
    }
  };

  const startManualRecording = () => {
    if (isRecording || !selectedStream) return;
    recordingBufferRef.current = [];
    setRecordingFrameCount(0);
    setIsRecording(true);
    addAlert('🔴 Recording started — press Stop to save');
    recordingIntervalRef.current = setInterval(() => {
      const canvas = modalCanvasRef.current;
      if (!canvas) return;
      try {
        const b64 = canvas.toDataURL('image/jpeg', 0.75).replace(/^data:image\/\w+;base64,/, '');
        recordingBufferRef.current.push({ frame: b64, timestamp: Date.now() });
        setRecordingFrameCount(recordingBufferRef.current.length);
      } catch {}
    }, 300);
  };

  const stopManualRecording = () => {
    if (!isRecording) return;
    clearInterval(recordingIntervalRef.current);
    setIsRecording(false);
    const frames = [...recordingBufferRef.current];
    recordingBufferRef.current = [];
    setRecordingFrameCount(0);
    console.log('🛑 stopManualRecording: frames captured =', frames.length, 'first frame size =', frames[0]?.frame?.length);
    if (!frames.length) { addAlert('No frames captured — canvas may be unavailable'); return; }
    setRecordingPreview({ frames, streamId: selectedStream?.streamId, cameraName: selectedStream?.cameraName, location: selectedStream?.location, previewFrame: 0, playing: false });
    addAlert(`⏸ ${frames.length} frames captured — preview ready`);
  };

  const saveRecordingFromPreview = async () => {
    if (!recordingPreview) return;
    const { frames, streamId, cameraName, location } = recordingPreview;
    clearInterval(previewIntervalRef.current);
    setRecordingPreview(null);
    addAlert(`⏳ Saving ${frames.length} frames…`);
    try {
      const res = await axios.post(`${API_URL}/super-responder/recordings/manual`, { streamId, cameraName, location, frames });
      if (res.data?.success) {
        addAlert(`✅ Saved! Go to Incidents page → 📹 Recordings tab to view it`);
        try {
          const incRes = await axios.get(`${API_URL}/super-responder/incidents?limit=200`);
          const incidents = Array.isArray(incRes.data) ? incRes.data : [];
          const match = incidents.find(i => i.stream_id && streamId && i.stream_id === streamId);
          if (match) {
            let types = match.assigned_to_types;
            if (typeof types === 'string') try { types = JSON.parse(types); } catch { types = []; }
            const isAssigned = Array.isArray(types) && types.length > 0;
            if (isAssigned) {
              addAlert(`✅ Incident #${match.id} is Assigned to: ${types.join(', ')}`);
            } else {
              addAlert(`⚠️ Incident #${match.id} exists but is NOT assigned — go to Incidents to assign`);
            }
          }
        } catch {}
      } else addAlert('Failed to save recording');
    } catch (err) { addAlert('Failed to save: ' + err.message); }
  };

  const togglePreviewPlay = () => {
    if (!recordingPreview) return;
    if (recordingPreview.playing) {
      clearInterval(previewIntervalRef.current);
      setRecordingPreview(p => ({ ...p, playing: false }));
    } else {
      previewIntervalRef.current = setInterval(() => {
        setRecordingPreview(p => {
          if (!p) return p;
          const next = p.previewFrame + 1;
          if (next >= p.frames.length) { clearInterval(previewIntervalRef.current); return { ...p, playing: false, previewFrame: p.frames.length - 1 }; }
          return { ...p, previewFrame: next };
        });
      }, 120);
      setRecordingPreview(p => ({ ...p, playing: true }));
    }
  };

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
      // Send annotated frame to backend buffer so auto-recording stores bboxes
      if (autoRecStateRef.current?.state === 'recording' && socketRef.current?.connected && selectedStreamRef.current?.streamId) {
        try {
          const annotated = canvas.toDataURL('image/jpeg', 0.7).replace(/^data:image\/\w+;base64,/, '');
          socketRef.current.emit('annotated-frame', { streamId: selectedStreamRef.current.streamId, frame: annotated });
        } catch {}
      }
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
    fetchAssignedIncidents(); // Fetch role-based assignments first
    fetchLiveStreams();
    connectSocket();
    const interval = setInterval(() => { 
      fetchCameras(); 
      fetchAlerts(); 
      fetchAssignedIncidents(); // Refresh assignments periodically
      fetchLiveStreams(); 
    }, 10000);
    return () => { clearInterval(interval); if (socketRef.current) socketRef.current.disconnect(); };
  }, []);
  
  // Re-fetch streams when accessibleStreamIds changes
  useEffect(() => {
    fetchLiveStreams();
  }, [accessibleStreamIds]);

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

      // Auto-recording state from backend
      socket.on('recording-state', ({ streamId, state, frameCount, maxFrames }) => {
        if (selectedStreamRef.current?.streamId === streamId) {
          const next = { state, frameCount: frameCount || 0, maxFrames: maxFrames || 20 };
          autoRecStateRef.current = next;
          setAutoRecState(next);
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

  // Fetch incidents assigned to this responder type
  const fetchAssignedIncidents = async () => {
    if (!responderType && !isSuperResponder) return;
    
    setLoadingAssignments(true);
    try {
      // SuperResponder sees all active incidents
      if (isSuperResponder) {
        const response = await axios.get(`${API_URL}/super-responder/incidents?status=assigned,pending,pending_review,in_progress&limit=100`);
        setAssignedIncidents(response.data?.incidents || []);
        const streamIds = response.data?.incidents?.map(inc => inc.stream_id) || [];
        setAccessibleStreamIds([...new Set(streamIds)]);
      } else {
        // Regular responder only sees their assigned incidents
        const response = await axios.get(`${API_URL}/super-responder/my-incidents?responderType=${encodeURIComponent(responderType)}&limit=50`);
        setAssignedIncidents(response.data?.incidents || []);
        
        // Fetch accessible streams for this responder type
        const streamsResponse = await axios.get(`${API_URL}/super-responder/incident-streams?responderType=${encodeURIComponent(responderType)}`);
        const streamIds = streamsResponse.data?.accessibleStreams?.map(s => s.stream_id) || [];
        setAccessibleStreamIds(streamIds);
      }
    } catch (error) {
      console.error('Error fetching assigned incidents:', error);
    } finally {
      setLoadingAssignments(false);
    }
  };

  const fetchLiveStreams = async () => {
    try {
      const response = await axios.get(`${API_URL}/streams`);
      let data = response.data;
      
      if (Array.isArray(data)) {
        // Filter streams based on role-based access control
        if (!isSuperResponder && accessibleStreamIds.length > 0) {
          // Only show streams that have assigned incidents for this responder
          data = data.filter(stream => accessibleStreamIds.includes(stream.streamId));
        } else if (!isSuperResponder && accessibleStreamIds.length === 0) {
          // No assignments - show empty state (or demo mode)
          data = [];
        }
        // SuperResponder sees all streams
      } else {
        data = [];
      }
      
      setLiveStreams(data);
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

  // Check if responder has access to a stream
  const hasStreamAccess = (streamId) => {
    if (isSuperResponder) return true; // SuperResponder can access all
    if (accessibleStreamIds.length === 0) return false;
    return accessibleStreamIds.includes(streamId);
  };

  // Get incident details for a stream
  const getStreamIncident = (streamId) => {
    return assignedIncidents.find(inc => inc.stream_id === streamId);
  };

  const watchLiveStream = (stream) => {
    // Role-based access control check
    if (!hasStreamAccess(stream.streamId)) {
      addAlert(`⛔ Access denied: This stream is not assigned to your responder type (${responderType})`, 'error');
      return;
    }
    
    setSelectedStream(stream);
    selectedStreamRef.current = stream;
    setShowStreamModal(true);
    setCurrentDetection(null);
    currentDetectionRef.current = null;
    setAutoRecState(null);
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
    a.download = `ai-events-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    addAlert('AI events exported successfully');
  };

  const saveVideoClip = async () => {
    if (!selectedStream || !streamFrames[selectedStream.streamId]) {
      addAlert('No video frame available to save');
      return;
    }

    try {
      // Get the current frame from the stream
      const currentFrame = streamFrames[selectedStream.streamId];
      
      // Create a canvas to capture the current video frame
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();
      
      img.onload = () => {
        // Set canvas dimensions to match the video
        canvas.width = img.naturalWidth || 640;
        canvas.height = img.naturalHeight || 360;
        
        // Draw the current frame
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        // Add timestamp and stream info overlay
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(0, canvas.height - 60, canvas.width, 60);
        
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 14px Arial';
        ctx.fillText(`Camera: ${selectedStream.cameraName || 'Unknown'}`, 10, canvas.height - 35);
        
        ctx.font = '12px Arial';
        ctx.fillText(`Stream ID: ${selectedStream.streamId}`, 10, canvas.height - 20);
        ctx.fillText(`Location: ${selectedStream.location || 'Unknown'}`, 10, canvas.height - 5);
        
        ctx.font = '10px Arial';
        ctx.fillText(`Time: ${new Date().toLocaleString()}`, canvas.width - 200, canvas.height - 5);
        
        // Convert canvas to blob and download
        canvas.toBlob((blob) => {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `cctv-clip-${selectedStream.cameraName || 'unknown'}-${Date.now()}.jpg`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          
          addAlert(`Video clip saved: ${selectedStream.cameraName || 'Unknown Camera'}`);
        }, 'image/jpeg', 0.9);
      };
      
      img.src = `data:image/jpeg;base64,${currentFrame}`;
      
    } catch (error) {
      console.error('Error saving video clip:', error);
      addAlert('Failed to save video clip');
    }
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
                <h2 className="text-base font-semibold text-zinc-900">
                  {isSuperResponder ? 'All Live Broadcasts' : 'Your Assigned Live Broadcasts'}
                </h2>
                <span className="bg-red-100 text-red-600 text-xs px-2 py-0.5 rounded-full">{activeLiveStreams} active</span>
                {!isSuperResponder && responderType && (
                  <span className="bg-blue-100 text-blue-600 text-xs px-2 py-0.5 rounded-full">{responderType}</span>
                )}
              </div>
              
              {/* Assignment Required Notice */}
              {!isSuperResponder && liveStreams.length === 0 && accessibleStreamIds.length === 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-amber-800">No Assigned Incidents</p>
                      <p className="text-sm text-amber-600 mt-1">
                        You currently have no assigned incidents. You will only be able to view CCTV streams 
                        for incidents assigned to your responder type ({responderType || 'Not Set'}).
                      </p>
                    </div>
                  </div>
                </div>
              )}
              
              <div className="flex gap-4">
                {/* ── Left: stream cards ── */}
                <div className="flex flex-col gap-4 w-72 flex-shrink-0">
                  {liveStreams.map((stream) => {
                    const incident = getStreamIncident(stream.streamId);
                    return (
                      <div key={stream.streamId} onClick={() => watchLiveStream(stream)}
                        className={`group rounded-2xl border-2 overflow-hidden shadow-lg hover:shadow-xl transition-all cursor-pointer hover:-translate-y-1 ${
                          incident ? 'border-red-500' : 'border-zinc-300'
                        }`}>
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
                          {incident && (
                            <div className="absolute bottom-2 left-2 right-2 z-10">
                              <div className="bg-black/80 backdrop-blur-sm rounded-lg p-2 text-white">
                                <div className="flex items-center gap-1.5 mb-1">
                                  <span className={`w-2 h-2 rounded-full ${
                                    incident.priority_score >= 80 ? 'bg-red-500' :
                                    incident.priority_score >= 60 ? 'bg-orange-500' :
                                    incident.priority_score >= 40 ? 'bg-yellow-500' : 'bg-blue-500'
                                  }`} />
                                  <span className="text-[10px] font-bold uppercase">
                                    {incident.severity} · Score: {incident.priority_score}
                                  </span>
                                </div>
                                <p className="text-[10px] leading-tight line-clamp-2">{incident.decision}</p>
                              </div>
                            </div>
                          )}
                        </div>
                        <div className="p-3 bg-white">
                          <p className="font-semibold text-zinc-900 text-sm">{stream.cameraName}</p>
                          <p className="text-xs text-zinc-500 mt-0.5 flex items-center gap-1">
                            <MapPin className="w-3 h-3" />{stream.location}
                          </p>
                          {incident && incident.assigned_to_types && (
                            <div className="mt-2 pt-2 border-t border-zinc-100 flex flex-wrap gap-1">
                              {(typeof incident.assigned_to_types === 'string'
                                ? JSON.parse(incident.assigned_to_types)
                                : incident.assigned_to_types
                              ).map((type, idx) => (
                                <span key={idx} className="text-[9px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">{type}</span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* ── Right: incident location map panel ── */}
                <div className="flex-1 min-w-0">
                  {(() => {
                    // Show map for the first stream that has an incident with a location
                    const streamWithIncident = liveStreams.find(s => {
                      const inc = getStreamIncident(s.streamId);
                      return inc && inc.location && inc.location !== 'Unknown';
                    });
                    const activeIncident = streamWithIncident ? getStreamIncident(streamWithIncident.streamId) : null;
                    const locationStr = activeIncident?.location || liveStreams[0]?.location;

                    return (
                      <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden h-full flex flex-col">
                        {/* Panel header */}
                        <div className="px-4 py-3 border-b border-zinc-100 flex items-center gap-2 flex-shrink-0">
                          <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                          <span className="text-sm font-semibold text-zinc-900">Incident Location</span>
                          {activeIncident && (
                            <span className={`ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                              activeIncident.priority_score >= 80 ? 'bg-red-50 border-red-300 text-red-600' :
                              activeIncident.priority_score >= 60 ? 'bg-orange-50 border-orange-300 text-orange-600' :
                              'bg-yellow-50 border-yellow-300 text-yellow-600'
                            }`}>
                              {activeIncident.severity?.toUpperCase()} · #{activeIncident.id}
                            </span>
                          )}
                        </div>

                        {/* Map */}
                        {locationStr && locationStr !== 'Unknown' ? (
                          <>
                            <div className="flex-1 min-h-0">
                              <StreamLocationMap locationStr={locationStr} />
                            </div>
                            {/* Incident detail below map */}
                            {activeIncident && (
                              <div className="px-4 py-3 border-t border-zinc-100 space-y-2 flex-shrink-0">
                                <div className="flex items-start gap-2">
                                  <Shield className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                                  <div className="min-w-0">
                                    <p className="text-xs font-bold text-zinc-900 line-clamp-2">{activeIncident.decision}</p>
                                    <p className="text-[10px] text-zinc-500 mt-0.5">{activeIncident.incident_category}</p>
                                  </div>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                  <div className="bg-zinc-50 rounded-lg p-2">
                                    <p className="text-[9px] text-zinc-500 uppercase">Priority Score</p>
                                    <p className="text-base font-bold text-zinc-900">{activeIncident.priority_score}/100</p>
                                  </div>
                                  <div className="bg-zinc-50 rounded-lg p-2">
                                    <p className="text-[9px] text-zinc-500 uppercase">AI Confidence</p>
                                    <p className="text-base font-bold text-zinc-900">{activeIncident.ai_confidence}%</p>
                                  </div>
                                </div>
                              </div>
                            )}
                          </>
                        ) : (
                          <div className="flex-1 flex flex-col items-center justify-center text-zinc-400 gap-3 p-8">
                            <MapPin className="w-10 h-10 opacity-30" />
                            <p className="text-sm font-medium">No location data available</p>
                            <p className="text-xs text-zinc-400">Location will appear when the stream reports GPS coordinates</p>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
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

          {/* Assigned Incidents Panel */}
          {assignedIncidents.length > 0 && (
            <div className="mb-6 bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden">
              <div 
                className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-slate-50 to-white border-b border-zinc-100 cursor-pointer hover:bg-slate-50 transition-colors"
                onClick={() => setShowAssignmentPanel(!showAssignmentPanel)}
              >
                <div className="flex items-center gap-3">
                  <Shield className="w-5 h-5 text-blue-600" />
                  <h3 className="font-semibold text-zinc-900">
                    {isSuperResponder ? 'All Active Incidents' : 'Your Assigned Incidents'}
                  </h3>
                  <span className="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full">
                    {assignedIncidents.length} active
                  </span>
                  {loadingAssignments && (
                    <RefreshCw className="w-4 h-4 text-zinc-400 animate-spin" />
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {!isSuperResponder && responderType && (
                    <span className="text-xs text-zinc-500">{responderType}</span>
                  )}
                  {showAssignmentPanel ? <ChevronUp className="w-5 h-5 text-zinc-400" /> : <ChevronDown className="w-5 h-5 text-zinc-400" />}
                </div>
              </div>
              
              {showAssignmentPanel && (
                <div className="p-4">
                  <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                    {assignedIncidents.slice(0, 6).map((incident) => (
                      <div key={incident.id} className="border border-zinc-200 rounded-xl p-4 hover:shadow-md transition-shadow bg-white">
                        {/* Header with Priority */}
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <span className={`w-3 h-3 rounded-full ${
                              incident.priority_score >= 80 ? 'bg-red-500 animate-pulse' :
                              incident.priority_score >= 60 ? 'bg-orange-500' :
                              incident.priority_score >= 40 ? 'bg-yellow-500' : 'bg-blue-500'
                            }`} />
                            <span className={`text-xs font-bold uppercase ${
                              incident.priority_score >= 80 ? 'text-red-600' :
                              incident.priority_score >= 60 ? 'text-orange-600' :
                              incident.priority_score >= 40 ? 'text-yellow-600' : 'text-blue-600'
                            }`}>
                              {incident.severity}
                            </span>
                          </div>
                          <span className="text-xs font-mono text-zinc-400">
                            #{incident.id}
                          </span>
                        </div>
                        
                        {/* Location Map — shown first, prominent */}
                        {incident.location && incident.location !== 'Unknown' && (
                          <div className="mb-3 -mx-4 -mt-1">
                            <StreamLocationMap locationStr={incident.location} />
                          </div>
                        )}

                        {/* Incident Details */}
                        <h4 className="font-medium text-zinc-900 text-sm mb-1 line-clamp-2">
                          {incident.decision}
                        </h4>
                        <p className="text-xs text-zinc-500 mb-2">{incident.incident_category}</p>

                        {/* Scores */}
                        <div className="grid grid-cols-2 gap-2 mb-3">
                          <div className="bg-zinc-50 rounded-lg p-2">
                            <p className="text-[10px] text-zinc-500 uppercase">Priority Score</p>
                            <p className="text-lg font-bold text-zinc-900">{incident.priority_score}/100</p>
                          </div>
                          <div className="bg-zinc-50 rounded-lg p-2">
                            <p className="text-[10px] text-zinc-500 uppercase">AI Confidence</p>
                            <p className="text-lg font-bold text-zinc-900">{incident.ai_confidence}%</p>
                          </div>
                        </div>
                        
                        {/* Assigned Teams */}
                        <div className="mb-3">
                          <p className="text-[10px] text-zinc-500 uppercase mb-1">Assigned Teams</p>
                          <div className="flex flex-wrap gap-1">
                            {(typeof incident.assigned_to_types === 'string' 
                              ? JSON.parse(incident.assigned_to_types) 
                              : incident.assigned_to_types || []
                            ).map((type, idx) => (
                              <span key={idx} className={`text-[10px] px-2 py-1 rounded ${
                                type === responderType ? 'bg-blue-100 text-blue-700 font-medium' : 'bg-zinc-100 text-zinc-600'
                              }`}>
                                {type}
                              </span>
                            ))}
                          </div>
                        </div>
                        
                        {/* Status & Actions */}
                        <div className="flex items-center justify-between pt-2 border-t border-zinc-100">
                          <span className={`text-[10px] px-2 py-1 rounded-full ${
                            incident.status === 'assigned' ? 'bg-emerald-100 text-emerald-700' :
                            incident.status === 'pending_review' ? 'bg-amber-100 text-amber-700' :
                            'bg-zinc-100 text-zinc-600'
                          }`}>
                            {incident.status === 'pending_review' ? '⚠️ Needs Review' : incident.status}
                          </span>
                          
                          <div className="flex items-center gap-1.5">
                            {/* Video recording button */}
                            <button
                              onClick={() => openRecordingForIncident(incident)}
                              disabled={recPlaybackLoading}
                              title="Play saved recording"
                              className="text-xs bg-purple-50 text-purple-600 px-2.5 py-1.5 rounded-lg hover:bg-purple-100 transition-colors flex items-center gap-1 disabled:opacity-40"
                            >
                              {recPlaybackLoading ? (
                                <RefreshCw className="w-3 h-3 animate-spin" />
                              ) : (
                                <Film className="w-3 h-3" />
                              )}
                              Video
                            </button>

                            {incident.stream_id && accessibleStreamIds.includes(incident.stream_id) && (
                              <button 
                                onClick={() => {
                                  const stream = liveStreams.find(s => s.streamId === incident.stream_id);
                                  if (stream) watchLiveStream(stream);
                                }}
                                className="text-xs bg-red-50 text-red-600 px-2.5 py-1.5 rounded-lg hover:bg-red-100 transition-colors flex items-center gap-1"
                              >
                                <Radio className="w-3 h-3" /> Stream
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  {assignedIncidents.length > 6 && (
                    <div className="mt-4 text-center">
                      <button 
                        onClick={() => setShowAssignmentPanel(false)}
                        className="text-sm text-zinc-500 hover:text-zinc-700 transition-colors"
                      >
                        And {assignedIncidents.length - 6} more incidents... (click header to collapse)
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

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

              {/* Auto-recording status bar */}
              {autoRecState && (
                <div className="px-4 py-2 border-t border-slate-700 bg-slate-900/60 flex-shrink-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-[10px] font-bold flex items-center gap-1.5 ${
                      autoRecState.state === 'recording' ? 'text-red-400' :
                      autoRecState.state === 'awaiting' ? 'text-yellow-400' :
                      autoRecState.state === 'saved' ? 'text-emerald-400' :
                      'text-slate-500'
                    }`}>
                      {autoRecState.state === 'recording' && <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse inline-block" />}
                      {autoRecState.state === 'recording' ? `Auto-Recording: ${autoRecState.frameCount}/${autoRecState.maxFrames} frames` :
                       autoRecState.state === 'awaiting' ? '⏸ Buffer full — Assign to save recording' :
                       autoRecState.state === 'saved' ? '✅ Recording saved to incident' :
                       autoRecState.state === 'discarded' ? '🗑 Recording discarded (not assigned)' : ''}
                    </span>
                    <span className="text-[9px] text-slate-500">
                      {autoRecState.state === 'recording' ? `~${Math.round((autoRecState.frameCount / autoRecState.maxFrames) * 20)}s / 20s` : ''}
                    </span>
                  </div>
                  {autoRecState.state === 'recording' && (
                    <div className="w-full h-1.5 bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-red-500 transition-all duration-300 rounded-full"
                        style={{ width: `${Math.min(100, (autoRecState.frameCount / autoRecState.maxFrames) * 100)}%` }}
                      />
                    </div>
                  )}
                  {autoRecState.state === 'awaiting' && (
                    <div className="w-full h-1.5 bg-yellow-700/50 rounded-full" />
                  )}
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
                <button onClick={saveVideoClip} className="flex-1 py-2 bg-slate-700 border border-slate-600 text-slate-300 rounded-xl text-xs font-bold hover:bg-slate-600 transition-colors flex items-center justify-center gap-1.5">
                  <Download size={13} /> Save Clip
                </button>
                <div className={`flex-1 py-2 border rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 ${
                  !autoRecState || autoRecState.state === 'discarded'
                    ? 'bg-slate-800 border-slate-700 text-slate-500'
                    : autoRecState.state === 'recording'
                      ? 'bg-red-900/40 border-red-700/60 text-red-300'
                      : autoRecState.state === 'awaiting'
                        ? 'bg-yellow-900/40 border-yellow-700/60 text-yellow-300'
                        : 'bg-emerald-900/40 border-emerald-700/60 text-emerald-300'
                }`}>
                  {!autoRecState || autoRecState.state === 'discarded' ? (
                    <><Circle size={10} className="text-slate-600" /> No Buffer</>
                  ) : autoRecState.state === 'recording' ? (
                    <><span className="w-2 h-2 rounded-full bg-red-500 animate-pulse inline-block" /> {autoRecState.frameCount}/{autoRecState.maxFrames}f</>
                  ) : autoRecState.state === 'awaiting' ? (
                    <><span className="w-2 h-2 rounded-full bg-yellow-400 inline-block" /> Buffer Ready</>
                  ) : (
                    <><span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" /> Saved</>
                  )}
                </div>
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

      {/* ── Incident Recording Playback Modal ───────────────────────── */}
      {recPlayback && (
        <div className="fixed inset-0 bg-black/85 flex items-center justify-center z-[100] p-4"
          onClick={closeRecPlayback}>
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl"
            onClick={e => e.stopPropagation()}>

            {/* Header */}
            <div className="px-5 py-3 border-b border-slate-700 flex items-center gap-3 bg-slate-800/80">
              <div className="w-8 h-8 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center flex-shrink-0">
                <Film size={14} className="text-purple-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white font-bold text-sm">{recPlayback.recording?.camera_name || 'Recording'}</p>
                <p className="text-slate-400 text-[10px] mt-0.5">
                  {recPlayback.frames.length} frames
                  {recPlayback.recording?.location ? ` · ${recPlayback.recording.location}` : ''}
                  {recPlayback.recording?.created_at ? ` · ${new Date(recPlayback.recording.created_at).toLocaleString()}` : ''}
                </p>
              </div>
              <button onClick={closeRecPlayback}
                className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-500 hover:text-white hover:bg-slate-700 transition-colors">
                <X size={14} />
              </button>
            </div>

            {/* Frame viewer */}
            <div className="relative bg-black aspect-video">
              <img
                src={`http://localhost:5000${recPlayback.frames[recPlayback.frame]}`}
                alt={`Frame ${recPlayback.frame + 1}`}
                className="w-full h-full object-contain"
              />
              {/* Overlay: frame counter */}
              <div className="absolute top-2 right-2 bg-black/60 text-white text-[10px] px-2 py-0.5 rounded-full font-mono">
                {recPlayback.frame + 1} / {recPlayback.frames.length}
              </div>
              {/* Overlay: playing indicator */}
              {recPlayback.playing && (
                <div className="absolute bottom-3 left-3 flex items-center gap-1.5 bg-red-600/80 backdrop-blur px-2.5 py-1 rounded-full">
                  <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                  <span className="text-white text-[10px] font-bold">PLAYING</span>
                </div>
              )}
              {/* Prev/Next frame buttons */}
              <button
                onClick={() => { clearInterval(recPlayIntervalRef.current); setRecPlayback(p => ({ ...p, frame: Math.max(0, p.frame - 1), playing: false })); }}
                disabled={recPlayback.frame === 0}
                className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/50 rounded-full flex items-center justify-center text-white hover:bg-black/70 transition-colors disabled:opacity-20">
                <ChevronLeft size={16} />
              </button>
              <button
                onClick={() => { clearInterval(recPlayIntervalRef.current); setRecPlayback(p => ({ ...p, frame: Math.min(p.frames.length - 1, p.frame + 1), playing: false })); }}
                disabled={recPlayback.frame === recPlayback.frames.length - 1}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/50 rounded-full flex items-center justify-center text-white hover:bg-black/70 transition-colors disabled:opacity-20">
                <ChevronRight size={16} />
              </button>
            </div>

            {/* Controls */}
            <div className="px-5 py-4 space-y-3 bg-slate-900">
              {/* Scrubber */}
              <input
                type="range" min={0} max={recPlayback.frames.length - 1} value={recPlayback.frame}
                onChange={e => { clearInterval(recPlayIntervalRef.current); setRecPlayback(p => ({ ...p, frame: parseInt(e.target.value), playing: false })); }}
                className="w-full accent-purple-500 cursor-pointer h-1.5"
              />
              {/* Buttons */}
              <div className="flex items-center gap-2">
                <button onClick={toggleRecPlay}
                  className={`flex-1 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors ${
                    recPlayback.playing
                      ? 'bg-yellow-600 hover:bg-yellow-500 text-white'
                      : 'bg-purple-600 hover:bg-purple-500 text-white'
                  }`}>
                  {recPlayback.playing ? '⏸ Pause' : <><Play size={12} /> Play</>}
                </button>
                <button
                  onClick={() => { clearInterval(recPlayIntervalRef.current); setRecPlayback(p => ({ ...p, frame: 0, playing: false })); }}
                  className="px-4 py-2.5 bg-slate-700 border border-slate-600 text-slate-300 rounded-xl text-xs font-semibold hover:bg-slate-600 transition-colors">
                  ↩ Restart
                </button>
                <button onClick={closeRecPlayback}
                  className="px-4 py-2.5 bg-slate-700 border border-slate-600 text-slate-300 rounded-xl text-xs font-semibold hover:bg-slate-600 transition-colors">
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Recording Preview Modal ─────────────────────────────────── */}
      {recordingPreview?._show && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[200] p-4"
          onClick={() => { clearInterval(previewIntervalRef.current); setRecordingPreview(p => ({ ...p, _show: false, playing: false })); }}>
          <div className="bg-slate-900 rounded-2xl border border-slate-700 w-full max-w-xl overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-700">
              <div>
                <h2 className="text-white font-bold text-sm flex items-center gap-2"><Video size={14} className="text-purple-400" /> Recording Preview</h2>
                <p className="text-slate-400 text-[10px] mt-0.5">{recordingPreview.frames.length} frames · {recordingPreview.cameraName || 'Unknown camera'}</p>
              </div>
              <button onClick={() => { clearInterval(previewIntervalRef.current); setRecordingPreview(p => ({ ...p, _show: false, playing: false })); }}
                className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-700 transition-all"><X size={15} /></button>
            </div>
            <div className="relative bg-black aspect-video flex items-center justify-center">
              <img
                src={`data:image/jpeg;base64,${recordingPreview.frames[recordingPreview.previewFrame]?.frame}`}
                alt={`Frame ${recordingPreview.previewFrame + 1}`}
                className="max-h-full max-w-full object-contain"
              />
              <div className="absolute top-2 right-2 bg-black/60 text-white text-[10px] px-2 py-0.5 rounded-full">
                {recordingPreview.previewFrame + 1} / {recordingPreview.frames.length}
              </div>
            </div>
            <div className="px-5 py-4 space-y-3">
              <input type="range" min={0} max={recordingPreview.frames.length - 1} value={recordingPreview.previewFrame}
                onChange={e => { clearInterval(previewIntervalRef.current); setRecordingPreview(p => ({ ...p, previewFrame: parseInt(e.target.value), playing: false })); }}
                className="w-full accent-purple-500 cursor-pointer" />
              <div className="flex items-center justify-center gap-3">
                <button onClick={togglePreviewPlay}
                  className={`px-5 py-1.5 text-xs font-bold rounded-lg transition-all ${ recordingPreview.playing ? 'bg-yellow-600 hover:bg-yellow-500 text-white' : 'bg-purple-600 hover:bg-purple-500 text-white'}`}>
                  {recordingPreview.playing ? '⏸ Pause' : '▶ Play'}
                </button>
              </div>
              <div className="flex gap-2 pt-1">
                <button onClick={saveRecordingFromPreview}
                  className="flex-1 py-2 bg-emerald-700 hover:bg-emerald-600 border border-emerald-600 text-white rounded-xl text-xs font-bold transition-all">
                  ✅ Save Recording
                </button>
                <button onClick={() => { clearInterval(previewIntervalRef.current); setRecordingPreview(null); }}
                  className="flex-1 py-2 bg-slate-700 hover:bg-slate-600 border border-slate-600 text-slate-300 rounded-xl text-xs font-bold transition-all">
                  🗑 Discard
                </button>
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