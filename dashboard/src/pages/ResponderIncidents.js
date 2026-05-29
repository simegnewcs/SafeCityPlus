// src/pages/ResponderIncidents.js
import React, { useEffect, useState, useMemo, useRef } from "react";
import ResponderSidebar from "../layout/ResponderSidebar";
import axios from "axios";
import io from "socket.io-client";
import { 
  AlertTriangle, Clock, CheckCircle, MapPin, 
  RefreshCw, Eye, Navigation, Calendar,
  Filter, X, ChevronLeft, ChevronRight, TrendingUp,
  Download, Search, Camera, Video as VideoIcon,
  Film, Play
} from "lucide-react";

const API_URL = "http://localhost:5000/api";
const SOCKET_URL = "http://localhost:5000";

// Reverse-geocode cache (lat,lng → place name)
const geoCache = {};
const reverseGeocode = async (lat, lng) => {
  const key = `${parseFloat(lat).toFixed(4)},${parseFloat(lng).toFixed(4)}`;
  if (geoCache[key]) return geoCache[key];
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&zoom=16&addressdetails=1`,
      { headers: { 'Accept-Language': 'en' } }
    );
    const data = await res.json();
    const a = data.address || {};
    // Full fallback chain — covers Ethiopian OSM data patterns
    const name =
      a.suburb || a.neighbourhood || a.quarter || a.city_district ||
      a.district || a.borough || a.hamlet || a.municipality ||
      a.road || a.residential || a.town || a.village ||
      a.city || a.county || a.state_district || a.state ||
      // If nothing specific, use display_name first segment
      (data.display_name ? data.display_name.split(',')[0].trim() : null) ||
      `${parseFloat(lat).toFixed(4)}, ${parseFloat(lng).toFixed(4)}`;
    geoCache[key] = name;
    return name;
  } catch {
    const fallback = `${parseFloat(lat).toFixed(4)}, ${parseFloat(lng).toFixed(4)}`;
    geoCache[key] = fallback;
    return fallback;
  }
};

const parseLatLng = (lat, lng, location) => {
  if (lat && lng) return { lat: parseFloat(lat), lng: parseFloat(lng) };
  // Extract from "lat, lng" string stored in location column
  if (location && /^-?\d/.test(String(location))) {
    const parts = String(location).split(',').map(s => parseFloat(s.trim()));
    if (parts.length >= 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
      return { lat: parts[0], lng: parts[1] };
    }
  }
  return null;
};

const LocationCell = ({ lat, lng, location }) => {
  const coords = parseLatLng(lat, lng, location);
  const [placeName, setPlaceName] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  React.useEffect(() => {
    if (coords) {
      setLoading(true);
      reverseGeocode(coords.lat, coords.lng).then(name => { setPlaceName(name); setLoading(false); });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lng, location]);
  // Already a human-readable name (not starting with digit)
  if (location && !/^-?\d/.test(String(location))) return (
    <span className="flex items-center gap-1 text-xs text-zinc-700">
      <MapPin size={10} className="text-blue-500 flex-shrink-0" />{location}
    </span>
  );
  if (loading) return <span className="text-zinc-400 text-xs italic">locating…</span>;
  if (placeName) return (
    <span className="flex items-center gap-1 text-xs text-zinc-700">
      <MapPin size={10} className="text-blue-500 flex-shrink-0" />{placeName}
    </span>
  );
  if (coords) return (
    <span className="text-zinc-400 text-[10px]">{coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}</span>
  );
  return <span className="text-zinc-400 text-xs">—</span>;
};

const ResponderIncidents = () => {
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const [allIncidents, setAllIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [selectedIncident, setSelectedIncident] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [notification, setNotification] = useState({ show: false, message: "", type: "" });
  const [searchTerm, setSearchTerm] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [stats, setStats] = useState({ total: 0, pending: 0, inProgress: 0, resolved: 0, high: 0, medium: 0, low: 0 });

  // Recording playback state
  const [recPlayback, setRecPlayback]           = useState(null); // { recording, frames, frame, playing }
  const [recPlaybackLoading, setRecPlaybackLoading] = useState(false);
  const recPlayIntervalRef = useRef(null);

  // Fetch BOTH regular incidents AND AI-incidents (CCTV)
  const fetchIncidents = async () => {
    try {
      setLoading(true);

      // Always re-read from localStorage (may have been updated)
      let currentUser = JSON.parse(localStorage.getItem("user") || "{}");

      // If responder_type missing, fetch fresh profile from backend and update localStorage
      if (!currentUser.responder_type && !currentUser.responderType && currentUser.id) {
        try {
          const profileRes = await axios.get(`${API_URL}/users/${currentUser.id}`);
          const fresh = profileRes.data;
          if (fresh?.responder_type) {
            currentUser = { ...currentUser, responder_type: fresh.responder_type };
            localStorage.setItem("user", JSON.stringify(currentUser));
            console.log('[ResponderIncidents] Refreshed responder_type from profile:', fresh.responder_type);
          }
        } catch (e) {
          console.warn('[ResponderIncidents] Could not refresh profile:', e.message);
        }
      }

      // 1. Fetch regular incidents
      const regularResponse = await axios.get(`${API_URL}/incidents`);
      const regularIncidents = regularResponse.data.map(inc => ({
        ...inc,
        isAssignedToMe: inc.assigned_responder_id === currentUser.id || inc.user_id === currentUser.id,
        incidentSource: 'reporter'
      }));
      
      // 2. Fetch AI-incidents assigned to this responder type
      let aiIncidents = [];
      const responderType = currentUser.responder_type || currentUser.responderType;

      console.log('[ResponderIncidents] user:', currentUser.id, '| responder_type:', responderType);

      if (responderType) {
        try {
          const aiResponse = await axios.get(
            `${API_URL}/super-responder/my-incidents?responderType=${encodeURIComponent(responderType)}&limit=100`
          );
          console.log('[ResponderIncidents] AI incidents response:', aiResponse.data);
          const raw = aiResponse.data?.incidents || [];
          aiIncidents = raw.map(aiInc => ({
            ...aiInc,
            _rawId: aiInc.id,
            id: `AI-${aiInc.id}`,
            type: aiInc.incident_category || aiInc.decision || 'AI Detected Incident',
            status: aiInc.status || 'pending',
            priority: aiInc.severity === 'Critical Emergency' ? 'Critical' : (aiInc.severity === 'Medium Risk' ? 'Medium' : 'Low'),
            description: aiInc.decision,
            isAssignedToMe: true,
            incidentSource: 'cctv',
            reporter_name: 'AI Detection System',
            created_at: aiInc.created_at,
            assigned_at: aiInc.assigned_at,
            assigned_by: (aiInc.assigned_by === 'ai' || aiInc.assigned_by === 'auto')
              ? '🤖 AI System'
              : (aiInc.assigned_by_name || 'Super Responder'),
            latitude: aiInc.latitude,
            longitude: aiInc.longitude,
            location: aiInc.location,
            confidence: aiInc.ai_confidence ? aiInc.ai_confidence / 100 : (aiInc.accident_confidence ? aiInc.accident_confidence / 100 : 0),
            assigned_responder_type: aiInc.assigned_to_types,
            ai_metadata: aiInc.ai_metadata,
            priority_score: aiInc.priority_score,
            incident_category: aiInc.incident_category,
          }));
          console.log(`[ResponderIncidents] ${aiIncidents.length} CCTV incidents loaded for type "${responderType}"`);
        } catch (aiError) {
          console.error('[ResponderIncidents] AI incidents fetch FAILED:', aiError.response?.data || aiError.message);
        }
      } else {
        console.warn('[ResponderIncidents] No responder_type on user object — check login response. User keys:', Object.keys(user));
      }
      
      // 3. Merge both lists (CCTV incidents first if high priority)
      const mergedIncidents = [...aiIncidents, ...regularIncidents];
      
      setAllIncidents(mergedIncidents);
      
      const pending = mergedIncidents.filter(i => i.status === "Pending" || !i.status).length;
      const inProgress = mergedIncidents.filter(i => i.status === "In Progress").length;
      const resolved = mergedIncidents.filter(i => i.status === "Resolved").length;
      const high = mergedIncidents.filter(i => i.priority === "High" || i.priority === "Critical").length;
      const medium = mergedIncidents.filter(i => i.priority === "Medium").length;
      const low = mergedIncidents.filter(i => i.priority === "Low" || i.priority === "Normal").length;
      
      setStats({
        total: mergedIncidents.length,
        pending,
        inProgress,
        resolved,
        high,
        medium,
        low,
        cctv: aiIncidents.length  // Track CCTV incidents count
      });
    } catch (error) {
      console.error("Error fetching incidents:", error);
      showNotification("Failed to load incidents", "error");
    } finally {
      setLoading(false);
    }
  };

  const updateIncidentStatus = async (id, newStatus) => {
    setUpdatingStatus(true);
    try {
      await axios.put(`${API_URL}/incidents/${id}`, { status: newStatus });
      showNotification(`Incident status updated to ${newStatus}`, "success");
      fetchIncidents();
      if (showModal) setShowModal(false);
    } catch (error) {
      console.error("Error updating status:", error);
      showNotification("Failed to update status", "error");
    } finally {
      setUpdatingStatus(false);
    }
  };

  const socketRef = useRef(null);

  useEffect(() => {
    fetchIncidents();
    const interval = setInterval(fetchIncidents, 30000);

    const socket = io(SOCKET_URL, { transports: ["websocket", "polling"] });
    socketRef.current = socket;

    // New incident assigned — always re-read user from localStorage for freshness
    socket.on("incident-assigned", (incident) => {
      const currentUser = JSON.parse(localStorage.getItem("user") || "{}");
      const myType = currentUser.responder_type || currentUser.responderType || "";
      const raw = incident.assignedTypes ?? incident.assigned_to_types ?? [];
      const types = Array.isArray(raw) ? raw : (typeof raw === 'string' ? JSON.parse(raw) : []);
      if (myType && types.includes(myType)) {
        showNotification(`🚨 New incident assigned: ${incident.incidentCategory || incident.decision || "Check your queue"}`, "error");
        fetchIncidents();
      }
    });

    // Real-time status sync: Super Responder updated a status
    socket.on("incident-status-updated", ({ id, status, assigned_to_types }) => {
      const currentUser = JSON.parse(localStorage.getItem("user") || "{}");
      const myType = currentUser.responder_type || currentUser.responderType || "";
      const types = Array.isArray(assigned_to_types) ? assigned_to_types : [];
      if (!myType || types.includes(myType)) {
        setAllIncidents(prev => prev.map(i =>
          (i._rawId === id || i.id === `AI-${id}` || i.id === id)
            ? { ...i, status }
            : i
        ));
      }
    });

    // Reassignment: if now includes my type, refresh
    socket.on("incident-reassigned", (data) => {
      const currentUser = JSON.parse(localStorage.getItem("user") || "{}");
      const myType = currentUser.responder_type || currentUser.responderType || "";
      const types = Array.isArray(data.assignedTypes) ? data.assignedTypes : [];
      if (myType && types.includes(myType)) {
        showNotification(`🔄 Incident reassigned to your unit`, "error");
        fetchIncidents();
      }
    });

    return () => { clearInterval(interval); socket.disconnect(); };
  }, [user.id]);

  const showNotification = (message, type) => {
    setNotification({ show: true, message, type });
    setTimeout(() => setNotification({ show: false, message: "", type: "" }), 3000);
  };

  const filteredIncidents = useMemo(() => {
    let filtered = allIncidents;
    
    // CCTV filter - show only AI-detected incidents
    if (filter === "CCTV") {
      filtered = filtered.filter(inc => inc.incidentSource === 'cctv');
    } else if (filter !== "all") {
      // Regular status filter
      filtered = filtered.filter(inc => inc.status === filter);
    }
    
    if (priorityFilter !== "all") {
      filtered = filtered.filter(inc => {
        if (priorityFilter === "high") return inc.priority === "High" || inc.priority === "Critical";
        if (priorityFilter === "medium") return inc.priority === "Medium";
        if (priorityFilter === "low") return inc.priority === "Low" || inc.priority === "Normal";
        return true;
      });
    }
    
    if (searchTerm) {
      filtered = filtered.filter(inc => 
        inc.type?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        inc.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        inc.id?.toString().includes(searchTerm)
      );
    }
    
    // Sort: CCTV incidents first (if high priority), then by date
    return filtered.sort((a, b) => {
      // If both are CCTV, sort by priority score
      if (a.incidentSource === 'cctv' && b.incidentSource === 'cctv') {
        return (b.priority_score || 0) - (a.priority_score || 0);
      }
      // CCTV incidents come first
      if (a.incidentSource === 'cctv') return -1;
      if (b.incidentSource === 'cctv') return 1;
      // Regular date sort
      return new Date(b.created_at) - new Date(a.created_at);
    });
  }, [allIncidents, filter, priorityFilter, searchTerm]);

  const totalPages = Math.ceil(filteredIncidents.length / itemsPerPage);
  const paginatedIncidents = filteredIncidents.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const getPriorityColor = (priority) => {
    if (!priority) return "bg-zinc-100 text-zinc-600";
    if (priority === "High" || priority === "Critical") return "bg-rose-100 text-rose-700";
    if (priority === "Medium") return "bg-amber-100 text-amber-700";
    return "bg-emerald-100 text-emerald-700";
  };

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'resolved': return 'bg-emerald-100 text-emerald-700';
      case 'in progress': return 'bg-blue-100 text-blue-700';
      default: return 'bg-yellow-100 text-yellow-700';
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  const handleViewDetails = (incident) => {
    setSelectedIncident(incident);
    setShowModal(true);
  };

  /* ── Recording playback ── */
  const openRecordingForIncident = async (incident) => {
    setRecPlaybackLoading(true);
    try {
      let recId = incident.recording_id || null;

      if (!recId && incident.stream_id) {
        const listRes = await axios.get(`${API_URL}/super-responder/recordings`);
        const recs = listRes.data?.recordings || [];
        const match = recs.find(r => r.stream_id === incident.stream_id);
        if (match) recId = match.id;
      }

      if (!recId) {
        showNotification('⚠️ No recording found for this incident', 'error');
        return;
      }

      const framesRes = await axios.get(`${API_URL}/super-responder/recordings/${recId}/frames`);
      const { recording, frames } = framesRes.data;
      if (!frames || frames.length === 0) {
        showNotification('⚠️ Recording has no frames', 'error');
        return;
      }
      setRecPlayback({ recording, frames, frame: 0, playing: false });
    } catch (e) {
      showNotification('Failed to load recording: ' + e.message, 'error');
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

  // Media helpers - same as AdminIncidentLogs
  const getMediaUrl = (incident) => {
    if (incident.media_name) {
      return `${API_URL.replace('/api', '')}/uploads/${incident.media_name}`;
    }
    return null;
  };

  const isVideo = (incident) => {
    return incident.media_type === 'video';
  };

  const handleRefresh = () => {
    fetchIncidents();
  };

  const handleExport = () => {
    const exportData = filteredIncidents.map(inc => ({
      id: inc.id,
      type: inc.type,
      priority: inc.priority,
      status: inc.status,
      location: inc.location || (inc.latitude && inc.longitude ? `${inc.latitude}, ${inc.longitude}` : 'Unknown'),
      description: inc.description,
      reported_at: inc.created_at,
      reported_by: inc.reporter_name
    }));
    
    const dataStr = JSON.stringify(exportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `incidents_export_${new Date().toISOString()}.json`;
    link.click();
    URL.revokeObjectURL(url);
    showNotification("Export completed!", "success");
  };

  const StatCard = ({ title, value, icon, color }) => (
    <div className={`bg-white border-l-4 ${color} rounded-xl p-4 shadow-sm`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-zinc-500 text-xs font-medium">{title}</p>
          <p className="text-2xl font-bold text-zinc-900 mt-1">{value}</p>
        </div>
        <div className="text-zinc-400">{icon}</div>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-zinc-50 overflow-hidden">
      <ResponderSidebar activeTab="assigned incidents" setActiveTab={() => {}} user={user} />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Notification Toast */}
        {notification.show && (
          <div className={`fixed top-20 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg animate-slide-in ${
            notification.type === "success" ? "bg-emerald-500 text-white" : "bg-red-500 text-white"
          }`}>
            {notification.type === "success" ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
            <span className="text-sm font-medium">{notification.message}</span>
          </div>
        )}

        {/* Top Navbar */}
        <header className="h-16 bg-white border-b border-zinc-200 px-6 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-4">
            <div className="p-2 bg-blue-100 rounded-xl">
              <AlertTriangle className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Incidents</h1>
              <p className="text-sm text-zinc-500">View and manage all incidents</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <button onClick={handleExport} className="p-2.5 hover:bg-zinc-100 rounded-xl transition-colors" title="Export">
              <Download size={18} className="text-zinc-600" />
            </button>
            <button onClick={handleRefresh} className="p-2.5 hover:bg-zinc-100 rounded-xl transition-colors">
              <RefreshCw size={18} className="text-zinc-600" />
            </button>
            <div className="text-sm text-zinc-500">
              {filteredIncidents.length} incident{filteredIncidents.length !== 1 ? 's' : ''}
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 p-6 overflow-auto">
          {/* Stats Row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 mb-6">
            <StatCard title="Total" value={stats.total} icon={<AlertTriangle size={16} />} color="border-blue-500" />
            <StatCard title="CCTV" value={stats.cctv || 0} icon={<VideoIcon size={16} />} color="border-red-500" />
            <StatCard title="Pending" value={stats.pending} icon={<Clock size={16} />} color="border-yellow-500" />
            <StatCard title="In Progress" value={stats.inProgress} icon={<TrendingUp size={16} />} color="border-blue-500" />
            <StatCard title="Resolved" value={stats.resolved} icon={<CheckCircle size={16} />} color="border-emerald-500" />
            <StatCard title="High" value={stats.high} icon={<AlertTriangle size={16} />} color="border-red-500" />
            <StatCard title="Medium" value={stats.medium} icon={<AlertTriangle size={16} />} color="border-amber-500" />
            <StatCard title="Low" value={stats.low} icon={<AlertTriangle size={16} />} color="border-green-500" />
          </div>

          {/* Search and Filters */}
          <div className="bg-white border border-zinc-200 rounded-2xl p-4 mb-6">
            <div className="flex flex-col lg:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                  <input
                    type="text"
                    placeholder="Search by ID, type, or description..."
                    className="w-full pl-10 pr-4 py-2 bg-zinc-50 border border-zinc-200 rounded-xl focus:border-blue-400 focus:ring-1 focus:ring-blue-400 outline-none transition-all"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>
              
              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                className="px-4 py-2 bg-zinc-50 border border-zinc-200 rounded-xl focus:border-blue-400 outline-none"
              >
                <option value="all">All Priorities</option>
                <option value="high">High Priority</option>
                <option value="medium">Medium Priority</option>
                <option value="low">Low Priority</option>
              </select>
            </div>
          </div>

          {/* Status Filters */}
          <div className="flex flex-wrap gap-2 mb-6">
            <button onClick={() => { setFilter("all"); setCurrentPage(1); }} className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${filter === 'all' ? 'bg-blue-600 text-white shadow-md' : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700'}`}>
              All ({stats.total})
            </button>
            <button onClick={() => { setFilter("CCTV"); setCurrentPage(1); }} className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all flex items-center gap-1 ${filter === 'CCTV' ? 'bg-red-600 text-white shadow-md' : 'bg-red-50 hover:bg-red-100 text-red-700'}`}>
              <VideoIcon size={14} /> CCTV ({stats.cctv || 0})
            </button>
            <button onClick={() => { setFilter("Pending"); setCurrentPage(1); }} className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${filter === 'Pending' ? 'bg-yellow-500 text-white shadow-md' : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700'}`}>
              Pending ({stats.pending})
            </button>
            <button onClick={() => { setFilter("In Progress"); setCurrentPage(1); }} className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${filter === 'In Progress' ? 'bg-blue-600 text-white shadow-md' : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700'}`}>
              In Progress ({stats.inProgress})
            </button>
            <button onClick={() => { setFilter("Resolved"); setCurrentPage(1); }} className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${filter === 'Resolved' ? 'bg-emerald-600 text-white shadow-md' : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700'}`}>
              Resolved ({stats.resolved})
            </button>
            {filter !== "all" && (
              <button onClick={() => { setFilter("all"); setCurrentPage(1); setPriorityFilter("all"); setSearchTerm(""); }} className="px-4 py-1.5 rounded-full text-sm text-zinc-400 hover:text-zinc-600 flex items-center gap-1">
                <X size={14} /> Clear
              </button>
            )}
          </div>

          {/* Incidents List */}
          <div className="bg-white border border-zinc-200 rounded-2xl shadow-sm overflow-hidden">
            {loading ? (
              <div className="py-20 text-center">
                <div className="animate-spin w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
                <p className="text-zinc-500">Loading incidents...</p>
              </div>
            ) : filteredIncidents.length === 0 ? (
              <div className="py-20 text-center">
                <div className="w-16 h-16 bg-zinc-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <AlertTriangle className="w-8 h-8 text-zinc-400" />
                </div>
                <h3 className="text-lg font-medium text-zinc-700">No incidents found</h3>
                <p className="text-zinc-500 mt-1">Try adjusting your filters</p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-zinc-50 border-b border-zinc-200">
                      <tr>
                        <th className="px-6 py-4 text-left font-medium text-zinc-500 text-xs uppercase tracking-wider">ID</th>
                        <th className="px-6 py-4 text-left font-medium text-zinc-500 text-xs uppercase tracking-wider">Title / Category</th>
                        <th className="px-6 py-4 text-left font-medium text-zinc-500 text-xs uppercase tracking-wider">Source</th>
                        <th className="px-6 py-4 text-left font-medium text-zinc-500 text-xs uppercase tracking-wider">Priority</th>
                        <th className="px-6 py-4 text-left font-medium text-zinc-500 text-xs uppercase tracking-wider">Location</th>
                        <th className="px-6 py-4 text-left font-medium text-zinc-500 text-xs uppercase tracking-wider">Status</th>
                        <th className="px-6 py-4 text-left font-medium text-zinc-500 text-xs uppercase tracking-wider">Assigned At</th>
                        <th className="px-6 py-4 text-left font-medium text-zinc-500 text-xs uppercase tracking-wider">Assigned By</th>
                        <th className="px-6 py-4 text-center font-medium text-zinc-500 text-xs uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {paginatedIncidents.map((inc) => (
                        <tr key={inc.id} className="hover:bg-zinc-50/50 transition-colors group">
                          <td className="px-6 py-4 font-mono text-xs text-zinc-500">#{String(inc.id).replace('AI-', '')}</td>
                          <td className="px-6 py-4">
                            <div className="flex flex-col gap-0.5">
                              <span className="font-medium text-zinc-900 text-sm">{inc.type || "Unknown Incident"}</span>
                              {(inc.incident_category || inc.incidentCategory) && (
                                <span className="text-[10px] text-zinc-500">📂 {inc.incident_category || inc.incidentCategory}</span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            {inc.incidentSource === 'cctv' ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold bg-red-100 text-red-700 rounded-full">
                                <VideoIcon size={9} /> CCTV
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold bg-blue-100 text-blue-700 rounded-full">
                                👤 Reporter
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex px-3 py-1 text-xs font-semibold rounded-full ${getPriorityColor(inc.priority)}`}>
                              {inc.priority || "Normal"}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <LocationCell lat={inc.latitude} lng={inc.longitude} location={inc.location} />
                          </td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex px-3 py-1 text-xs font-semibold rounded-full ${getStatusColor(inc.status)}`}>
                              {inc.status || "Pending"}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-zinc-500 text-xs">
                            {formatDate(inc.assigned_at || inc.created_at)}
                          </td>
                          <td className="px-6 py-4 text-zinc-500 text-xs">
                            {inc.assigned_by || (inc.incidentSource === 'cctv' ? '🤖 AI System' : '—')}
                          </td>
                          <td className="px-6 py-4 text-center">
                            <div className="flex justify-center gap-2">
                              {/* Eye / View — for CCTV opens video player, for reporter opens detail modal */}
                              <button
                                onClick={() => inc.incidentSource === 'cctv'
                                  ? openRecordingForIncident(inc)
                                  : handleViewDetails(inc)
                                }
                                disabled={recPlaybackLoading && inc.incidentSource === 'cctv'}
                                className={`p-2 rounded-lg transition-colors ${
                                  inc.incidentSource === 'cctv'
                                    ? 'hover:bg-purple-50 text-purple-600 disabled:opacity-40'
                                    : 'hover:bg-blue-50 text-blue-600'
                                }`}
                                title={inc.incidentSource === 'cctv' ? 'Play Recording' : 'View Details'}
                              >
                                {recPlaybackLoading && inc.incidentSource === 'cctv'
                                  ? <RefreshCw size={16} className="animate-spin" />
                                  : inc.incidentSource === 'cctv'
                                    ? <Film size={16} />
                                    : <Eye size={16} />
                                }
                              </button>
                              {/* Info button for CCTV incidents to still open detail modal */}
                              {inc.incidentSource === 'cctv' && (
                                <button onClick={() => handleViewDetails(inc)} className="p-2 hover:bg-blue-50 text-blue-600 rounded-lg transition-colors" title="View Details">
                                  <Eye size={16} />
                                </button>
                              )}
                              {inc.status !== "In Progress" && inc.status !== "Resolved" && (
                                <button onClick={() => updateIncidentStatus(inc.id, "In Progress")} disabled={updatingStatus} className="p-2 hover:bg-amber-50 text-amber-600 rounded-lg transition-colors" title="Start Work">
                                  <Clock size={16} />
                                </button>
                              )}
                              {inc.status !== "Resolved" && (
                                <button onClick={() => updateIncidentStatus(inc.id, "Resolved")} disabled={updatingStatus} className="p-2 hover:bg-emerald-50 text-emerald-600 rounded-lg transition-colors" title="Mark Resolved">
                                  <CheckCircle size={16} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="px-6 py-4 border-t border-zinc-100 flex items-center justify-between">
                    <p className="text-sm text-zinc-500">Page {currentPage} of {totalPages}</p>
                    <div className="flex gap-2">
                      <button onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} disabled={currentPage === 1} className="p-2 border border-zinc-200 rounded-lg hover:bg-zinc-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                        <ChevronLeft size={18} />
                      </button>
                      <button onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))} disabled={currentPage === totalPages} className="p-2 border border-zinc-200 rounded-lg hover:bg-zinc-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                        <ChevronRight size={18} />
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </main>
      </div>

      {/* Incident Detail Modal */}
      {showModal && selectedIncident && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-zinc-200 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-zinc-900">Incident #{selectedIncident.id}</h2>
                <p className="text-sm text-zinc-500 mt-1">{selectedIncident.type || "Unknown Type"}</p>
              </div>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-zinc-100 rounded-lg transition-colors">
                <X size={20} className="text-zinc-500" />
              </button>
            </div>

            <div className="overflow-y-auto p-6 space-y-6">
              {/* CCTV Badge for AI incidents */}
              {selectedIncident.incidentSource === 'cctv' && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <VideoIcon size={18} className="text-red-600" />
                    <h3 className="font-semibold text-red-900">CCTV AI Detection</h3>
                  </div>
                  <p className="text-sm text-red-700">This incident was automatically detected by the AI surveillance system.</p>
                </div>
              )}

              {/* Media Section */}
              {getMediaUrl(selectedIncident) && (
                <div className="bg-zinc-50 rounded-2xl p-4">
                  <h3 className="font-medium text-zinc-900 mb-3">Evidence Media</h3>
                  {isVideo(selectedIncident) ? (
                    <video
                      src={getMediaUrl(selectedIncident)}
                      controls
                      className="w-full rounded-xl max-h-96 object-contain"
                      controlsList="nodownload"
                    />
                  ) : (
                    <img
                      src={getMediaUrl(selectedIncident)}
                      alt="Incident evidence"
                      className="w-full rounded-xl max-h-96 object-contain"
                    />
                  )}
                  <button
                    onClick={() => window.open(getMediaUrl(selectedIncident), '_blank')}
                    className="mt-3 flex items-center gap-2 text-sm text-emerald-600 hover:text-emerald-700"
                  >
                    <Download size={14} />
                    Download
                  </button>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-zinc-50 p-3 rounded-xl">
                  <p className="text-zinc-500 text-xs mb-1">Title</p>
                  <p className="font-semibold text-zinc-900 text-sm">{selectedIncident.type || "Unknown"}</p>
                </div>
                <div className="bg-zinc-50 p-3 rounded-xl">
                  <p className="text-zinc-500 text-xs mb-1">Category</p>
                  <p className="font-medium text-zinc-900 text-sm">{selectedIncident.incident_category || selectedIncident.incidentCategory || "—"}</p>
                </div>
                <div className="bg-zinc-50 p-3 rounded-xl">
                  <p className="text-zinc-500 text-xs mb-1">Priority</p>
                  <span className={`inline-flex px-3 py-1 text-xs font-semibold rounded-full ${getPriorityColor(selectedIncident.priority)}`}>
                    {selectedIncident.priority || "Normal"}
                  </span>
                </div>
                <div className="bg-zinc-50 p-3 rounded-xl">
                  <p className="text-zinc-500 text-xs mb-1">Current Status</p>
                  {selectedIncident.incidentSource !== 'cctv' ? (
                    <select value={selectedIncident.status || "Pending"} onChange={(e) => updateIncidentStatus(selectedIncident.id, e.target.value)} disabled={updatingStatus} className={`px-3 py-1 text-xs font-semibold rounded-full border-none focus:ring-1 focus:ring-blue-400 ${getStatusColor(selectedIncident.status)}`}>
                      <option value="Pending">Pending</option>
                      <option value="In Progress">In Progress</option>
                      <option value="Resolved">Resolved</option>
                    </select>
                  ) : (
                    <span className={`inline-flex px-3 py-1 text-xs font-semibold rounded-full ${getStatusColor(selectedIncident.status)}`}>
                      {selectedIncident.status || "Pending"}
                    </span>
                  )}
                </div>
                <div className="bg-zinc-50 p-3 rounded-xl">
                  <p className="text-zinc-500 text-xs mb-1">Assigned At</p>
                  <p className="font-medium text-zinc-900 text-sm">{formatDate(selectedIncident.assigned_at || selectedIncident.created_at)}</p>
                </div>
                <div className="bg-zinc-50 p-3 rounded-xl">
                  <p className="text-zinc-500 text-xs mb-1">Assigned By</p>
                  <p className="font-medium text-zinc-900 text-sm">{selectedIncident.assigned_by || (selectedIncident.incidentSource === 'cctv' ? '🤖 AI System' : '—')}</p>
                </div>
                <div className="bg-zinc-50 p-3 rounded-xl">
                  <p className="text-zinc-500 text-xs mb-1">Reported By</p>
                  <p className="font-medium text-zinc-900">{selectedIncident.reporter_name || (selectedIncident.incidentSource === 'cctv' ? 'AI Detection System' : 'Anonymous')}</p>
                </div>
                <div className="bg-zinc-50 p-3 rounded-xl">
                  <p className="text-zinc-500 text-xs mb-1">Detected At</p>
                  <p className="font-medium text-zinc-900 text-sm">{formatDate(selectedIncident.created_at)}</p>
                </div>
                <div className="bg-zinc-50 p-3 rounded-xl col-span-2">
                  <p className="text-zinc-500 text-xs mb-1">Location</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <MapPin size={14} className="text-blue-500 flex-shrink-0" />
                    <div className="font-medium text-zinc-900 text-sm flex-1">
                      <LocationCell lat={selectedIncident.latitude} lng={selectedIncident.longitude} location={selectedIncident.location} />
                    </div>
                    {(() => {
                      const c = parseLatLng(selectedIncident.latitude, selectedIncident.longitude, selectedIncident.location);
                      return c ? (
                        <button onClick={() => window.open(`https://maps.google.com?q=${c.lat},${c.lng}`, "_blank")} className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1 flex-shrink-0">
                          <Navigation size={14} /> Navigate
                        </button>
                      ) : null;
                    })()}
                  </div>
                </div>
              </div>

              {/* AI Metadata for CCTV incidents */}
              {selectedIncident.incidentSource === 'cctv' && selectedIncident.ai_metadata && (
                <div className="bg-zinc-50 p-4 rounded-xl">
                  <h3 className="font-medium text-zinc-900 mb-3">AI Detection Details</h3>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="bg-white p-2 rounded-lg">
                      <p className="text-zinc-500 text-xs">AI Confidence</p>
                      <p className="font-medium text-zinc-900">{selectedIncident.ai_confidence || Math.round((selectedIncident.confidence || 0) * 100)}%</p>
                    </div>
                    <div className="bg-white p-2 rounded-lg">
                      <p className="text-zinc-500 text-xs">Priority Score</p>
                      <p className="font-medium text-zinc-900">{selectedIncident.priority_score || 'N/A'}/100</p>
                    </div>
                    <div className="bg-white p-2 rounded-lg">
                      <p className="text-zinc-500 text-xs">Detection Method</p>
                      <p className="font-medium text-zinc-900">{selectedIncident.ai_metadata?.fireDetectionMethod || 'YOLO AI'}</p>
                    </div>
                    <div className="bg-white p-2 rounded-lg">
                      <p className="text-zinc-500 text-xs">Assigned To</p>
                      <p className="font-medium text-zinc-900 text-xs">
                        {Array.isArray(selectedIncident.assigned_responder_type) 
                          ? selectedIncident.assigned_responder_type.join(', ')
                          : selectedIncident.assigned_responder_type || 'Unassigned'}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {selectedIncident.description && (
                <div className="bg-zinc-50 p-4 rounded-xl">
                  <h3 className="font-medium text-zinc-900 mb-2">Description</h3>
                  <p className="text-zinc-600 text-sm">{selectedIncident.description}</p>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-zinc-200 flex gap-3">
              {selectedIncident.status !== "In Progress" && selectedIncident.status !== "Resolved" && (
                <button onClick={() => updateIncidentStatus(selectedIncident.id, "In Progress")} disabled={updatingStatus} className="flex-1 py-3 bg-amber-500 text-white rounded-xl font-medium hover:bg-amber-600 transition-colors disabled:opacity-50">
                  Start Response
                </button>
              )}
              {selectedIncident.status !== "Resolved" && (
                <button onClick={() => updateIncidentStatus(selectedIncident.id, "Resolved")} disabled={updatingStatus} className="flex-1 py-3 bg-emerald-500 text-white rounded-xl font-medium hover:bg-emerald-600 transition-colors disabled:opacity-50">
                  Mark as Resolved
                </button>
              )}
              <button onClick={() => setShowModal(false)} className="flex-1 py-3 bg-zinc-500 text-white rounded-xl font-medium hover:bg-zinc-600 transition-colors">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Recording Playback Modal ────────────────────────────── */}
      {recPlayback && (
        <div className="fixed inset-0 bg-black/85 flex items-center justify-center z-[200] p-4"
          onClick={closeRecPlayback}>
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl"
            onClick={e => e.stopPropagation()}>

            {/* Header */}
            <div className="px-5 py-3 border-b border-slate-700 flex items-center gap-3 bg-slate-800/80">
              <div className="w-8 h-8 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center flex-shrink-0">
                <Film size={14} className="text-purple-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white font-bold text-sm">{recPlayback.recording?.camera_name || 'Incident Recording'}</p>
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
              <div className="absolute top-2 right-2 bg-black/60 text-white text-[10px] px-2 py-0.5 rounded-full font-mono">
                {recPlayback.frame + 1} / {recPlayback.frames.length}
              </div>
              {recPlayback.playing && (
                <div className="absolute bottom-3 left-3 flex items-center gap-1.5 bg-red-600/80 backdrop-blur px-2.5 py-1 rounded-full">
                  <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                  <span className="text-white text-[10px] font-bold">PLAYING</span>
                </div>
              )}
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
              <input
                type="range" min={0} max={recPlayback.frames.length - 1} value={recPlayback.frame}
                onChange={e => { clearInterval(recPlayIntervalRef.current); setRecPlayback(p => ({ ...p, frame: parseInt(e.target.value), playing: false })); }}
                className="w-full accent-purple-500 cursor-pointer h-1.5"
              />
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
    </div>
  );
};

export default ResponderIncidents;