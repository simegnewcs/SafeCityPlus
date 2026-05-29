import React, { useState, useEffect, useRef, useMemo } from "react";
import SuperResponderSidebar from "../layout/SuperResponderSidebar";
import io from "socket.io-client";
import axios from "axios";
import {
  AlertTriangle, MapPin, Cpu, Clock, CheckCircle, ChevronDown,
  RefreshCw, Search, X, UserCheck, Users, Filter, Navigation, Video, Trash2, CheckSquare, Square
} from "lucide-react";

const API_URL = "http://localhost:5000/api";
const SOCKET_URL = "http://localhost:5000";

const _geoCache = {};
const reverseGeocode = async (lat, lng) => {
  const key = `${parseFloat(lat).toFixed(4)},${parseFloat(lng).toFixed(4)}`;
  if (_geoCache[key]) return _geoCache[key];
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&zoom=16&addressdetails=1`,
      { headers: { 'Accept-Language': 'en' } }
    );
    const data = await res.json();
    const a = data.address || {};
    const name =
      a.suburb || a.neighbourhood || a.quarter || a.city_district ||
      a.district || a.borough || a.hamlet || a.municipality ||
      a.road || a.residential || a.town || a.village ||
      a.city || a.county || a.state_district || a.state ||
      (data.display_name ? data.display_name.split(',')[0].trim() : null) ||
      `${parseFloat(lat).toFixed(4)}, ${parseFloat(lng).toFixed(4)}`;
    _geoCache[key] = name;
    return name;
  } catch {
    const fb = `${parseFloat(lat).toFixed(4)}, ${parseFloat(lng).toFixed(4)}`;
    _geoCache[key] = fb;
    return fb;
  }
};

const _parseLatLng = (lat, lng, location) => {
  if (lat && lng) return { lat: parseFloat(lat), lng: parseFloat(lng) };
  if (location && /^-?\d/.test(String(location))) {
    const parts = String(location).split(',').map(s => parseFloat(s.trim()));
    if (parts.length >= 2 && !isNaN(parts[0]) && !isNaN(parts[1]))
      return { lat: parts[0], lng: parts[1] };
  }
  return null;
};

const LocationText = ({ lat, lng, location }) => {
  const coords = _parseLatLng(lat, lng, location);
  const [name, setName] = React.useState(null);
  React.useEffect(() => {
    if (coords) reverseGeocode(coords.lat, coords.lng).then(setName);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lng, location]);
  if (location && !/^-?\d/.test(String(location))) return <>{location}</>;
  if (name) return <>{name}</>;
  if (coords) return <>{coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}</>;
  return <>—</>;
};

const SEVERITY_STYLES = {
  "Critical Emergency": "bg-red-500/20 border-red-500/50 text-red-300",
  "Medium Risk":        "bg-yellow-500/20 border-yellow-500/40 text-yellow-300",
  "Low Risk":           "bg-emerald-500/20 border-emerald-500/40 text-emerald-300",
};

// These values MUST exactly match the responder_type values stored in AdminUsers / DB
const RESPONDER_TYPES = [
  { value: "Fire Brigade",       emoji: "�", label: "Fire / Smoke" },
  { value: "Armed Police",       emoji: "�", label: "Weapon / Security" },
  { value: "Ambulance",          emoji: "�", label: "Medical / Ambulance" },
  { value: "Construction Safety",emoji: "🏗️", label: "Construction Site" },
  { value: "Traffic Police",     emoji: "🚔", label: "Road & Traffic" },
  { value: "Crowd Control",      emoji: "�", label: "Crowd / Stampede" },
  { value: "Emergency Patrol",   emoji: "🚑", label: "Emergency Patrol" },
  { value: "Site Inspector",     emoji: "🏗️", label: "Construction Monitor" },
  { value: "General Responder",  emoji: "⚠️", label: "General / Medium Risk" },
];

const parseTypes = (raw) => {
  if (Array.isArray(raw)) return raw;
  try { return JSON.parse(raw || "[]"); } catch { return []; }
};

const formatTime = (ts) =>
  ts ? new Date(ts).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

const statusBadge = (status) => {
  switch (status) {
    case "resolved":   return "bg-emerald-900/40 text-emerald-400 border border-emerald-800/50";
    case "assigned":   return "bg-blue-900/40 text-blue-400 border border-blue-800/50";
    case "in_progress":return "bg-orange-900/40 text-orange-400 border border-orange-800/50";
    default:           return "bg-yellow-900/40 text-yellow-400 border border-yellow-800/50";
  }
};

export default function SuperResponderIncidents() {
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);
  const [activeTab, setActiveTab] = useState("incidents"); // "incidents" | "recordings"
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [resolving, setResolving] = useState(null);
  const [recordings, setRecordings] = useState([]);
  const [recordingsLoading, setRecordingsLoading] = useState(false);

  const fetchRecordings = async () => {
    setRecordingsLoading(true);
    try {
      const res = await axios.get(`${API_URL}/super-responder/recordings`);
      setRecordings(res.data?.recordings || []);
    } catch { setRecordings([]); }
    finally { setRecordingsLoading(false); }
  };

  const openRecordingPlayer = async (rec) => {
    try {
      const res = await axios.get(`${API_URL}/super-responder/recordings/${rec.id}/frames`);
      if (res.data?.success && res.data.frames.length > 0) {
        setClipModal({ incidentId: `Recording #${rec.id}`, frames: res.data.frames, recordedAt: rec.created_at, currentFrame: 0, playing: false });
      } else {
        showToast(res.data?.message || 'No frames found for this recording', 'error');
      }
    } catch (err) {
      console.error('openRecordingPlayer error:', err);
      showToast(err.response?.data?.error || 'Failed to load recording', 'error');
    }
  };

  // Auto-recording state per stream: streamId -> { state, frameCount }
  const [recordingStates, setRecordingStates] = useState({});

  // Assign modal state
  const [assignModal, setAssignModal] = useState(null);
  const [assignTypes, setAssignTypes] = useState([]);
  const [assignNotes, setAssignNotes] = useState("");
  const [assigning, setAssigning] = useState(false);
  const [toast, setToast] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null); // incident id awaiting confirm

  // ── Bulk selection ──
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkConfirm, setBulkConfirm] = useState(false);

  // ── Recording selection ──
  const [recSelectionMode, setRecSelectionMode] = useState(false);
  const [selectedRecIds, setSelectedRecIds] = useState(new Set());
  const [bulkRecConfirm, setBulkRecConfirm] = useState(false);

  const toggleRecSelection = (id) => setSelectedRecIds(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });
  const exitRecSelection = () => { setRecSelectionMode(false); setSelectedRecIds(new Set()); };
  const isAllRecsSelected = recordings.length > 0 && recordings.every(r => selectedRecIds.has(r.id));
  const toggleSelectAllRecs = () => setSelectedRecIds(
    isAllRecsSelected ? new Set() : new Set(recordings.map(r => r.id))
  );
  const bulkDeleteRecs = async () => {
    setBulkRecConfirm(false);
    const ids = [...selectedRecIds];
    for (const id of ids) {
      try { await axios.delete(`${API_URL}/super-responder/recordings/${id}`); } catch { /* continue */ }
    }
    setRecordings(prev => prev.filter(r => !ids.includes(r.id)));
    exitRecSelection();
    showToast(`${ids.length} recording(s) deleted`, 'success');
  };

  const toggleSelection = (id) => setSelectedIds(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });
  const exitSelection = () => { setSelectionMode(false); setSelectedIds(new Set()); };

  const deleteIncident = async (id) => {
    setConfirmDelete(null);
    setDeleting(id);
    try {
      await axios.delete(`${API_URL}/super-responder/incidents/${id}`);
      setIncidents(prev => prev.filter(i => i.id !== id));
      if (expanded === id) setExpanded(null);
      showToast('Incident deleted', 'success');
    } catch (err) {
      showToast('Failed to delete incident', 'error');
    } finally {
      setDeleting(null);
    }
  };

  // Clip playback modal state
  const [clipModal, setClipModal] = useState(null); // { incidentId, frames, recordedAt, currentFrame }
  const clipIntervalRef = useRef(null);

  const openClipModal = async (incidentId) => {
    try {
      const res = await axios.get(`${API_URL}/super-responder/incidents/${incidentId}/clip`);
      if (res.data?.success && res.data.frames.length > 0) {
        setClipModal({ incidentId, frames: res.data.frames, recordedAt: res.data.recordedAt, currentFrame: 0, playing: false });
      } else {
        showToast('No recording available for this incident', 'error');
      }
    } catch {
      showToast('Failed to load clip', 'error');
    }
  };

  const closeClipModal = () => {
    if (clipIntervalRef.current) clearInterval(clipIntervalRef.current);
    setClipModal(null);
  };

  const toggleClipPlay = () => {
    if (!clipModal) return;
    if (clipModal.playing) {
      clearInterval(clipIntervalRef.current);
      setClipModal(m => ({ ...m, playing: false }));
    } else {
      clipIntervalRef.current = setInterval(() => {
        setClipModal(m => {
          if (!m) return m;
          const next = m.currentFrame + 1;
          if (next >= m.frames.length) { clearInterval(clipIntervalRef.current); return { ...m, playing: false, currentFrame: m.frames.length - 1 }; }
          return { ...m, currentFrame: next };
        });
      }, 120); // ~8fps playback
      setClipModal(m => ({ ...m, playing: true }));
    }
  };

  const socketRef = useRef(null);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchIncidents = async () => {
    try {
      const res = await axios.get(`${API_URL}/super-responder/incidents?limit=200`);
      setIncidents(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error(err.message);
    } finally { setLoading(false); }
  };

  useEffect(() => {
    fetchIncidents();
    fetchRecordings();
    const interval = setInterval(fetchIncidents, 30000);

    const socket = io(SOCKET_URL, { transports: ["websocket", "polling"] });
    socketRef.current = socket;

    // Real-time: newly assigned → update list immediately + refresh recordings so video icon activates
    socket.on("super-responder-incident-updated", ({ id, status, assignedTypes }) => {
      setIncidents(prev => prev.map(i =>
        i.id === id
          ? { ...i, status, assigned_to_types: assignedTypes }
          : i
      ));
      fetchRecordings();
    });

    // Real-time: status update from responders
    socket.on("incident-status-updated", ({ id, status }) => {
      setIncidents(prev => prev.map(i => i.id === id ? { ...i, status } : i));
    });

    // Real-time: new AI incident arrives — optimistic prepend + background refresh
    socket.on("new-ai-incident", (inc) => {
      if (inc?.id) {
        setIncidents(prev => {
          const exists = prev.find(i => i.id === inc.id);
          if (exists) return prev.map(i => i.id === inc.id ? { ...i, ...inc, assigned_to_types: inc.assignedTypes || i.assigned_to_types, assigned_by: inc.assignedBy || i.assigned_by, status: inc.status || i.status } : i);
          return [{ ...inc, assigned_to_types: inc.assignedTypes, assigned_by: inc.assignedBy }, ...prev];
        });
      }
      fetchIncidents();
    });

    // Real-time: auto-recording state updates
    socket.on("recording-state", ({ streamId, state, frameCount }) => {
      setRecordingStates(prev => ({ ...prev, [streamId]: { state, frameCount } }));
    });

    // Real-time: stream recording saved — refresh recordings so video icon turns active
    socket.on("stream-recorded", ({ recordingId } = {}) => {
      fetchRecordings();
      showToast(`🎬 Recording #${recordingId || '?'} saved automatically — video icon is now active`, 'success');
    });

    return () => { clearInterval(interval); socket.disconnect(); };
  }, []);

  const resolve = async (id) => {
    setResolving(id);
    try {
      await axios.put(`${API_URL}/super-responder/incidents/${id}/status`, { status: "resolved" });
      setIncidents(prev => prev.map(i => i.id === id ? { ...i, status: "resolved" } : i));
      showToast("Incident marked as resolved");
    } catch { showToast("Failed to resolve", "error"); }
    finally { setResolving(null); }
  };

  const openAssign = (inc) => {
    setAssignModal(inc);
    setAssignTypes(parseTypes(inc.assigned_to_types));
    setAssignNotes(inc.notes || "");
  };

  const toggleType = (type) => {
    setAssignTypes(prev =>
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    );
  };

  const submitAssign = async () => {
    if (!assignModal || assignTypes.length === 0) {
      showToast("Select at least one responder category", "error");
      return;
    }
    setAssigning(true);
    try {
      await axios.post(`${API_URL}/super-responder/incidents/${assignModal.id}/assign`, {
        assignedTypes: assignTypes,
        notes: assignNotes,
        assignedByUserId: user.id,
        assignedByName: user.fullName || user.full_name || "Super Responder",
      });
      // Optimistic update
      setIncidents(prev => prev.map(i =>
        i.id === assignModal.id
          ? { ...i, status: "assigned", assigned_to_types: assignTypes, notes: assignNotes, assigned_by_name: user.fullName || user.full_name }
          : i
      ));
      showToast(`Assigned to ${assignTypes.join(", ")}`);
      setAssignModal(null);
    } catch { showToast("Assignment failed", "error"); }
    finally { setAssigning(false); }
  };

  const filtered = useMemo(() => {
    let list = filter === "all" ? incidents : incidents.filter(i => i.status === filter);
    if (search.trim()) {
      const s = search.toLowerCase();
      list = list.filter(i =>
        (i.decision || "").toLowerCase().includes(s) ||
        (i.location || "").toLowerCase().includes(s) ||
        (i.incident_category || "").toLowerCase().includes(s) ||
        String(i.id).includes(s)
      );
    }
    return list;
  }, [incidents, filter, search]);

  // These depend on `filtered` — must come after it
  const isAllSelected = filtered.length > 0 && filtered.every(i => selectedIds.has(i.id));
  const toggleSelectAll = () => setSelectedIds(
    isAllSelected ? new Set() : new Set(filtered.map(i => i.id))
  );
  const bulkDelete = async () => {
    setBulkConfirm(false);
    const ids = [...selectedIds];
    for (const id of ids) {
      try {
        await axios.delete(`${API_URL}/super-responder/incidents/${id}`);
      } catch { /* continue */ }
    }
    setIncidents(prev => prev.filter(i => !ids.includes(i.id)));
    exitSelection();
    showToast(`${ids.length} incident(s) deleted`, 'success');
  };

  const counts = useMemo(() => ({
    all: incidents.length,
    pending: incidents.filter(i => i.status === "pending" || i.status === "pending_review").length,
    assigned: incidents.filter(i => i.status === "assigned").length,
    in_progress: incidents.filter(i => i.status === "in_progress").length,
    resolved: incidents.filter(i => i.status === "resolved").length,
  }), [incidents]);

  return (
    <div className="flex h-screen bg-slate-950 text-white overflow-hidden">
      <SuperResponderSidebar user={user} />

      <div className="flex-1 flex flex-col overflow-hidden">

        {/* ── Bulk delete recordings confirm modal ── */}
        {bulkRecConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="bg-slate-900 border border-red-800/60 rounded-2xl shadow-2xl p-6 w-80 flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-red-900/50 border border-red-700/50 flex items-center justify-center flex-shrink-0">
                  <Trash2 size={18} className="text-red-400" />
                </div>
                <div>
                  <p className="text-sm font-bold text-white">Delete {selectedRecIds.size} recording{selectedRecIds.size !== 1 ? 's' : ''}?</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">This action cannot be undone. All selected recordings will be permanently removed.</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={bulkDeleteRecs}
                  className="flex-1 py-2 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5">
                  <Trash2 size={12} /> Yes, delete {selectedRecIds.size}
                </button>
                <button onClick={() => setBulkRecConfirm(false)}
                  className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs font-bold rounded-xl transition-all">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Bulk delete incidents confirm modal ── */}
        {bulkConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="bg-slate-900 border border-red-800/60 rounded-2xl shadow-2xl p-6 w-80 flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-red-900/50 border border-red-700/50 flex items-center justify-center flex-shrink-0">
                  <Trash2 size={18} className="text-red-400" />
                </div>
                <div>
                  <p className="text-sm font-bold text-white">Delete {selectedIds.size} incident{selectedIds.size !== 1 ? 's' : ''}?</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">This action cannot be undone. All selected incident records will be permanently removed.</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={bulkDelete}
                  className="flex-1 py-2 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5">
                  <Trash2 size={12} /> Yes, delete {selectedIds.size}
                </button>
                <button
                  onClick={() => setBulkConfirm(false)}
                  className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs font-bold rounded-xl transition-all">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Toast */}
        {toast && (
          <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl text-sm font-semibold shadow-xl flex items-center gap-2 ${toast.type === "error" ? "bg-red-600" : "bg-emerald-600"}`}>
            {toast.type === "error" ? <AlertTriangle size={15} /> : <CheckCircle size={15} />}
            {toast.msg}
          </div>
        )}

        {/* Header */}
        <header className="h-14 bg-slate-900 border-b border-slate-800 px-6 flex items-center gap-3 flex-shrink-0">
          <AlertTriangle size={16} className="text-red-400" />
          <div>
            <h1 className="text-sm font-bold">{activeTab === 'recordings' ? 'Stream Recordings' : 'Incident Queue'}</h1>
            <p className="text-[10px] text-slate-500">{activeTab === 'recordings' ? `${recordings.length} saved recordings` : `All AI-detected & manually logged incidents · ${filtered.length} shown`}</p>
          </div>
          <div className="flex items-center gap-2 ml-auto flex-wrap">
            {/* Tab switcher */}
            <div className="flex items-center gap-1 bg-slate-800 border border-slate-700 rounded-lg p-0.5">
              <button onClick={() => setActiveTab('incidents')}
                className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${activeTab === 'incidents' ? 'bg-red-700 text-white' : 'text-slate-400 hover:text-white'}`}>
                🚨 Incidents
              </button>
              <button onClick={() => { setActiveTab('recordings'); fetchRecordings(); }}
                className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all flex items-center gap-1 ${activeTab === 'recordings' ? 'bg-purple-700 text-white' : 'text-slate-400 hover:text-white'}`}>
                📹 Recordings {recordings.length > 0 && <span className="bg-purple-500 text-white text-[8px] px-1.5 py-0.5 rounded-full">{recordings.length}</span>}
              </button>
            </div>
            {/* Search (incidents tab only) */}
            {activeTab === 'incidents' && <div className="relative hidden md:block">
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search…"
                className="pl-7 pr-3 py-1.5 text-xs bg-slate-800 border border-slate-700 rounded-lg text-slate-300 placeholder-slate-600 focus:outline-none focus:border-slate-500 w-36"
              />
            </div>}
            {/* Status filters (incidents tab only) */}
            {activeTab === 'incidents' && ["all", "pending", "assigned", "in_progress", "resolved"].map(s => (
              <button key={s} onClick={() => setFilter(s)}
                className={`px-2.5 py-1 text-[10px] font-bold rounded-lg capitalize border transition-all ${filter === s ? 'bg-red-900/40 border-red-700/50 text-red-300' : 'bg-slate-800 border-slate-700 text-slate-500 hover:text-slate-300'}`}>
                {s.replace("_", " ")} <span className="opacity-60">({counts[s] ?? 0})</span>
              </button>
            ))}
            {/* Select mode toggle */}
            {activeTab === 'incidents' && (
              <button
                onClick={() => selectionMode ? exitSelection() : setSelectionMode(true)}
                className={`flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-bold rounded-lg border transition-all ${
                  selectionMode ? 'bg-blue-700 border-blue-600 text-white' : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                }`}>
                <CheckSquare size={11} />
                {selectionMode ? 'Cancel' : 'Select'}
              </button>
            )}
            {activeTab === 'recordings' && recordings.length > 0 && (
              <button
                onClick={() => recSelectionMode ? exitRecSelection() : setRecSelectionMode(true)}
                className={`flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-bold rounded-lg border transition-all ${
                  recSelectionMode ? 'bg-blue-700 border-blue-600 text-white' : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                }`}>
                <CheckSquare size={11} />
                {recSelectionMode ? 'Cancel' : 'Select'}
              </button>
            )}
            <button onClick={activeTab === 'recordings' ? fetchRecordings : fetchIncidents} className="p-1.5 bg-slate-800 border border-slate-700 rounded-lg hover:text-white text-slate-500 transition-colors">
              <RefreshCw size={13} />
            </button>
          </div>
        </header>

        {/* ── Recordings bulk action bar ── */}
        {recSelectionMode && activeTab === 'recordings' && (
          <div className="flex items-center gap-3 px-6 py-2 bg-slate-900 border-b border-slate-800 flex-shrink-0">
            <button onClick={toggleSelectAllRecs} className="flex items-center gap-2 text-xs text-slate-300 hover:text-white transition-colors">
              {isAllRecsSelected
                ? <CheckSquare size={15} className="text-blue-400" />
                : <Square size={15} className="text-slate-500" />}
              <span className="font-semibold">{isAllRecsSelected ? 'Deselect all' : `Select all (${recordings.length})`}</span>
            </button>
            <span className="text-[10px] text-slate-500 ml-2">
              {selectedRecIds.size > 0 ? `${selectedRecIds.size} selected` : 'None selected'}
            </span>
            {selectedRecIds.size > 0 && (
              <button onClick={() => setBulkRecConfirm(true)}
                className="ml-auto flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold bg-red-700 hover:bg-red-600 text-white rounded-lg transition-all">
                <Trash2 size={11} /> Delete {selectedRecIds.size}
              </button>
            )}
          </div>
        )}

        {/* ── Incidents bulk action bar ── */}
        {selectionMode && activeTab === 'incidents' && (
          <div className="flex items-center gap-3 px-6 py-2 bg-slate-900 border-b border-slate-800 flex-shrink-0">
            {/* Select all checkbox */}
            <button onClick={toggleSelectAll} className="flex items-center gap-2 text-xs text-slate-300 hover:text-white transition-colors">
              {isAllSelected
                ? <CheckSquare size={15} className="text-blue-400" />
                : <Square size={15} className="text-slate-500" />}
              <span className="font-semibold">
                {isAllSelected ? 'Deselect all' : `Select all (${filtered.length})`}
              </span>
            </button>
            <span className="text-[10px] text-slate-500 ml-2">
              {selectedIds.size > 0 ? `${selectedIds.size} selected` : 'None selected'}
            </span>
            {selectedIds.size > 0 && (
              <button
                onClick={() => setBulkConfirm(true)}
                className="ml-auto flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold bg-red-700 hover:bg-red-600 text-white rounded-lg transition-all">
                <Trash2 size={11} /> Delete {selectedIds.size}
              </button>
            )}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">

          {/* ── Recordings Tab ── */}
          {activeTab === 'recordings' && (
            recordingsLoading ? (
              <div className="flex flex-col items-center justify-center h-64 text-slate-600">
                <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mb-3" />
                <p className="text-sm">Loading recordings…</p>
              </div>
            ) : recordings.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-slate-600">
                <span className="text-5xl mb-3">📹</span>
                <p className="text-sm font-medium">No recordings yet</p>
                <p className="text-xs text-slate-500 mt-1">Recordings are saved automatically when a live stream ends</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {recordings.map(rec => {
                  const matchedInc = incidents.find(i => rec.incident_id && i.id === rec.incident_id) ||
                                    incidents.find(i => i.stream_id && rec.stream_id && i.stream_id === rec.stream_id);
                  const thumbUrl = rec.recording_dir
                    ? `http://localhost:5000${rec.recording_dir}/frame_00000.jpg`
                    : null;
                  const isRecSelected = selectedRecIds.has(rec.id);
                  return (
                    <div key={rec.id}
                      onClick={() => recSelectionMode ? toggleRecSelection(rec.id) : null}
                      className={`bg-slate-900 border rounded-xl overflow-hidden transition-all ${
                        recSelectionMode ? 'cursor-pointer' : 'group'
                      } ${
                        isRecSelected ? 'border-blue-600/70 ring-1 ring-blue-600/40 bg-blue-950/20' : 'border-slate-700 hover:border-purple-700/60'
                      }`}>
                      {/* Thumbnail */}
                      <div className="relative bg-slate-800 h-36 flex items-center justify-center cursor-pointer"
                        onClick={e => { if (recSelectionMode) { e.stopPropagation(); toggleRecSelection(rec.id); } else openRecordingPlayer(rec); }}>
                        {thumbUrl ? (
                          <img src={thumbUrl} alt="thumbnail"
                            className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                            onError={e => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }} />
                        ) : null}
                        <div className={`${thumbUrl ? 'hidden' : 'flex'} absolute inset-0 items-center justify-center text-4xl opacity-30 group-hover:opacity-60 transition-opacity`}>🎬</div>
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <div className="bg-purple-600/90 rounded-full p-3"><span className="text-white text-lg">▶</span></div>
                        </div>
                        <div className="absolute bottom-2 right-2 bg-black/70 text-white text-[9px] px-1.5 py-0.5 rounded">
                          {rec.duration_seconds ? `${rec.duration_seconds}s` : `${rec.frame_count}f`}
                        </div>
                        {/* Selection checkbox overlay */}
                        {recSelectionMode && (
                          <div className="absolute top-2 left-2 z-10">
                            {isRecSelected
                              ? <CheckSquare size={18} className="text-blue-400 drop-shadow" />
                              : <Square size={18} className="text-white/70 drop-shadow" />}
                          </div>
                        )}
                        {matchedInc && (
                          <div className={`absolute ${recSelectionMode ? 'top-2 left-8' : 'top-2 left-2'} text-[8px] font-bold px-1.5 py-0.5 rounded-full ${
                            matchedInc.assigned_to_types && matchedInc.assigned_to_types.length > 0
                              ? 'bg-emerald-700/90 text-emerald-100'
                              : 'bg-yellow-700/90 text-yellow-100'
                          }`}>
                            {matchedInc.assigned_to_types && matchedInc.assigned_to_types.length > 0 ? '✅ Assigned' : '⚠️ Unassigned'}
                          </div>
                        )}
                      </div>
                      {/* Info */}
                      <div className="p-3">
                        <div className="flex items-start justify-between gap-1 mb-1">
                          <p className="text-xs font-semibold text-white truncate">📡 {rec.camera_name || 'Unknown Camera'}</p>
                          <p className="text-[9px] text-slate-500 flex-shrink-0">{rec.created_at ? new Date(rec.created_at).toLocaleString() : '—'}</p>
                        </div>
                        <p className="text-[10px] text-slate-400 flex items-center gap-1 mb-1.5">
                          <MapPin size={8} /> {rec.location || '—'}
                        </p>
                        {matchedInc ? (
                          <div className="bg-slate-800/80 rounded-lg p-2 space-y-1 border border-slate-700/50">
                            <p className="text-[10px] font-bold text-red-300 truncate">
                              🚨 {matchedInc.decision || matchedInc.incident_category || 'Unknown'}
                            </p>
                            <div className="flex items-center gap-2 flex-wrap">
                              {matchedInc.severity && (
                                <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full ${
                                  matchedInc.severity === 'Critical Emergency' ? 'bg-red-900/80 text-red-300' :
                                  matchedInc.severity === 'Medium Risk' ? 'bg-yellow-900/80 text-yellow-300' :
                                  'bg-emerald-900/80 text-emerald-300'
                                }`}>{matchedInc.severity}</span>
                              )}
                              {matchedInc.ai_confidence > 0 && (
                                <span className="text-[8px] text-slate-400">
                                  {Math.round(matchedInc.ai_confidence * (matchedInc.ai_confidence <= 1 ? 100 : 1))}% confidence
                                </span>
                              )}
                            </div>
                            {matchedInc.response_action && (
                              <p className="text-[8px] text-slate-400 truncate">📋 {matchedInc.response_action}</p>
                            )}
                            {(() => {
                              const types = parseTypes(matchedInc.assigned_to_types);
                              return types.length > 0 ? (
                                <p className="text-[8px] text-emerald-400">✅ Assigned: {types.join(', ')}</p>
                              ) : (
                                <p className="text-[8px] text-yellow-400">⚠️ Not yet assigned</p>
                              );
                            })()}
                          </div>
                        ) : (
                          <p className="text-[9px] text-slate-600 italic">No AI incident detected for this stream</p>
                        )}
                        <div className="flex items-center gap-2 mt-2">
                          <button onClick={() => openRecordingPlayer(rec)}
                            className="flex-1 py-1.5 text-[10px] font-bold bg-purple-700 hover:bg-purple-600 text-white rounded-lg transition-all flex items-center justify-center gap-1">
                            <Video size={9} /> Play
                          </button>
                          <button onClick={async (e) => {
                            e.stopPropagation();
                            try {
                              await axios.delete(`${API_URL}/super-responder/recordings/${rec.id}`);
                              setRecordings(prev => prev.filter(r => r.id !== rec.id));
                            } catch { showToast('Failed to delete', 'error'); }
                          }} className="px-2 py-1.5 text-[10px] bg-red-900/50 hover:bg-red-800 border border-red-800/50 text-red-400 rounded-lg transition-all">
                            <X size={10} />
                          </button>
                          <span className="text-[9px] text-slate-500">{rec.frame_count}f</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          )}

          {/* ── Incidents Tab ── */}
          {activeTab === 'incidents' && loading ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-600">
              <div className="w-8 h-8 border-4 border-red-500 border-t-transparent rounded-full animate-spin mb-3" />
              <p className="text-sm">Loading incidents…</p>
            </div>
          ) : activeTab === 'incidents' && filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-600">
              <AlertTriangle size={40} className="mb-3 opacity-30" />
              <p className="text-sm">No incidents match your filters</p>
            </div>
          ) : activeTab === 'incidents' ? filtered.map((inc) => {
            const types = parseTypes(inc.assigned_to_types);
            const isOpen = expanded === inc.id;
            // Match recording: use recording_id linked directly on incident first, then stream_id fallback
            const matchedRecording = (() => {
              if (inc.recording_id) return recordings.find(r => r.id === inc.recording_id) || { id: inc.recording_id, recording_dir: inc.recording_dir, frame_count: inc.recording_frame_count, stream_id: inc.stream_id } ;
              return (inc.stream_id ? recordings.find(r => r.stream_id === inc.stream_id) : null) || null;
            })();
            const hasVideo = !!(matchedRecording?.recording_dir) || inc.clip_frame_count > 0 || inc.clip_dir;
            const recState = recordingStates[inc.stream_id];

            const isSelected = selectedIds.has(inc.id);
            return (
              <div key={inc.id} className={`bg-slate-900 rounded-xl border transition-all ${
                isSelected ? 'border-blue-600/70 bg-blue-950/20' :
                inc.severity === "Critical Emergency" ? "border-red-800/50" : "border-slate-800"
              }`}>

                {/* Row header */}
                <div className="p-4 flex items-start gap-3 cursor-pointer"
                  onClick={() => selectionMode ? toggleSelection(inc.id) : setExpanded(isOpen ? null : inc.id)}>
                  {/* Checkbox (selection mode) or severity dot */}
                  {selectionMode ? (
                    <div className="mt-0.5 flex-shrink-0" onClick={e => { e.stopPropagation(); toggleSelection(inc.id); }}>
                      {isSelected
                        ? <CheckSquare size={15} className="text-blue-400" />
                        : <Square size={15} className="text-slate-500" />}
                    </div>
                  ) : (
                    <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${
                      inc.severity === "Critical Emergency" ? "bg-red-500 animate-pulse" :
                      inc.severity === "Medium Risk" ? "bg-yellow-400" : "bg-emerald-400"
                    }`} />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <p className="text-sm font-semibold text-white line-clamp-1">
                        {inc.decision || inc.incident_category || "Incident #" + inc.id}
                      </p>
                      {recState && (
                        <div className={`flex flex-col items-end gap-0.5 flex-shrink-0`}>
                          <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full ${
                            recState.state === 'recording' ? 'bg-red-700/80 text-red-200' :
                            recState.state === 'awaiting' ? 'bg-yellow-700/80 text-yellow-200' :
                            recState.state === 'saved' ? 'bg-emerald-700/80 text-emerald-200' :
                            'bg-slate-700/80 text-slate-400'
                          }`}>
                            {recState.state === 'recording'
                              ? `⏺ ${recState.frameCount || 0}/20f`
                              : recState.state === 'awaiting' ? '⏸ Awaiting Assignment'
                              : recState.state === 'saved' ? '✅ Saved'
                              : recState.state === 'discarded' ? '🗑 Discarded'
                              : recState.state}
                          </span>
                          {recState.state === 'recording' && (
                            <div className="w-16 h-1 bg-slate-700 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-red-500 transition-all duration-300 rounded-full"
                                style={{ width: `${Math.min(100, ((recState.frameCount || 0) / 20) * 100)}%` }}
                              />
                            </div>
                          )}
                        </div>
                      )}
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <button
                          onClick={e => {
                            e.stopPropagation();
                            if (matchedRecording) openRecordingPlayer(matchedRecording);
                            else if (inc.clip_frame_count > 0 || inc.clip_dir) openClipModal(inc.id);
                            else showToast('No recording for this incident — recording saves automatically when you Assign Responders during a live stream', 'error');
                          }}
                          title={hasVideo ? "Play recorded video" : "No recording yet"}
                          className={`p-1 border rounded-lg transition-colors flex items-center justify-center ${
                            hasVideo
                              ? "bg-purple-700/70 hover:bg-purple-600 border-purple-600/50"
                              : "bg-slate-800 hover:bg-slate-700 border-slate-700 opacity-50"
                          }`}>
                          <Video size={11} className="text-white" />
                        </button>
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${statusBadge(inc.status)}`}>
                          {(inc.status || "pending").replace("_", " ").toUpperCase()}
                        </span>
                        <div className="relative">
                          <button
                            onClick={e => { e.stopPropagation(); setConfirmDelete(confirmDelete === inc.id ? null : inc.id); }}
                            title="Delete incident"
                            disabled={deleting === inc.id}
                            className={`p-1 border rounded-lg transition-colors flex items-center justify-center disabled:opacity-40 ${
                              confirmDelete === inc.id
                                ? 'bg-red-600 border-red-500'
                                : 'border-red-900/50 bg-red-950/30 hover:bg-red-900/50'
                            }`}>
                            <Trash2 size={11} className="text-red-400" />
                          </button>
                          {confirmDelete === inc.id && (
                            <div
                              onClick={e => e.stopPropagation()}
                              className="absolute right-0 top-7 z-50 w-52 bg-slate-800 border border-red-700/60 rounded-xl shadow-2xl p-3 flex flex-col gap-2">
                              <p className="text-xs font-semibold text-red-300">Delete this incident?</p>
                              <p className="text-[10px] text-slate-400 leading-relaxed">This action cannot be undone. The incident record will be permanently removed.</p>
                              <div className="flex gap-2 mt-1">
                                <button
                                  onClick={() => deleteIncident(inc.id)}
                                  className="flex-1 py-1.5 bg-red-600 hover:bg-red-500 text-white text-[10px] font-bold rounded-lg transition-colors">
                                  Yes, Delete
                                </button>
                                <button
                                  onClick={() => setConfirmDelete(null)}
                                  className="flex-1 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 text-[10px] font-bold rounded-lg transition-colors">
                                  Cancel
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                        <ChevronDown size={14} className={`text-slate-600 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                      </div>
                    </div>

                    {/* Meta row */}
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-slate-500">
                      <span className={`font-bold px-1.5 py-0.5 rounded-full border ${SEVERITY_STYLES[inc.severity] || SEVERITY_STYLES["Low Risk"]}`}>
                        {inc.severity || "Unknown"}
                      </span>
                      {inc.incident_category && (
                        <span className="bg-slate-800 border border-slate-700 px-1.5 py-0.5 rounded-full text-slate-300">
                          📂 {inc.incident_category}
                        </span>
                      )}
                      {inc.location && <span className="flex items-center gap-1"><MapPin size={9} />{inc.location}</span>}
                      {inc.accident_confidence > 0 && inc.assigned_by !== 'manual' && <span className="flex items-center gap-1"><Cpu size={9} />{inc.accident_confidence}%</span>}
                      <span className="flex items-center gap-1"><Clock size={9} />{formatTime(inc.created_at)}</span>
                    </div>

                    {/* AI Assigned badge — shown prominently above teams when auto-assigned */}
                    {(inc.assigned_by === "ai" || inc.assigned_by === "auto") && (
                      <div className="flex items-center gap-2 mt-2 px-2.5 py-1.5 bg-purple-950/60 border border-purple-700/50 rounded-xl w-fit">
                        <span className="text-purple-300 text-sm">🤖</span>
                        <div>
                          <span className="text-[10px] font-bold text-purple-300 tracking-wide">AI AUTO-ASSIGNED</span>
                          {(inc.accident_confidence > 0 || inc.ai_confidence > 0) && (
                            <span className="ml-2 text-[9px] text-purple-400/80">
                              {inc.accident_confidence >= 70
                                ? `${inc.accident_confidence}% detection confidence`
                                : inc.ai_confidence > 0
                                  ? `${inc.ai_confidence}% AI confidence`
                                  : ''}
                            </span>
                          )}
                        </div>
                        <span className="ml-1 w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
                      </div>
                    )}

                    {/* Assigned teams */}
                    {types.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {types.map(t => {
                          const meta = RESPONDER_TYPES.find(r => r.value === t);
                          return (
                            <span key={t} className="text-[9px] bg-blue-900/30 border border-blue-800/40 text-blue-300 px-2 py-0.5 rounded-full">
                              {meta?.emoji || "🛡️"} {t}
                            </span>
                          );
                        })}
                        {!(inc.assigned_by === "ai" || inc.assigned_by === "auto") && (
                          <span className="text-[9px] px-2 py-0.5 rounded-full border bg-slate-800 border-slate-700 text-slate-400">
                            👤 {inc.assigned_by_name || "Manual"}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Expanded details */}
                {isOpen && (
                  <div className="border-t border-slate-800 px-4 pb-4 pt-3 space-y-3">

                    {/* Full assignment details grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {[
                        { label: "Incident ID",    value: `#${inc.id}` },
                        { label: "Category",       value: inc.incident_category || "—" },
                        { label: "Priority Score", value: inc.priority_score ? `${inc.priority_score}/100` : "—" },
                        { label: "Camera",         value: inc.camera_name || "—" },
                        { label: "Assigned At",    value: formatTime(inc.assigned_at) },
                        { label: "Assigned By",    value: inc.assigned_by === "ai" || inc.assigned_by === "auto" ? "🤖 AI System" : (inc.assigned_by_name || "Super Responder") },
                        { label: "Detected At",    value: formatTime(inc.created_at) },
                        ...(inc.assigned_by !== 'manual' ? [{ label: "AI Confidence", value: inc.ai_confidence ? `${inc.ai_confidence}%` : (inc.accident_confidence ? `${inc.accident_confidence}%` : "—") }] : []),
                        { label: "Location",       value: <LocationText lat={inc.latitude} lng={inc.longitude} location={inc.location} /> },
                      ].map(({ label, value }) => (
                        <div key={label} className="bg-slate-800 rounded-lg p-2.5 border border-slate-700">
                          <p className="text-[9px] text-slate-500 mb-0.5">{label}</p>
                          <p className="text-xs font-semibold text-white truncate">{value}</p>
                        </div>
                      ))}
                    </div>

                    {/* View Recording button */}
                    {(inc.clip_frame_count > 0 || inc.clip_dir) && (
                      <button
                        onClick={() => openClipModal(inc.id)}
                        className="flex items-center gap-1.5 text-[10px] bg-purple-600 hover:bg-purple-500 text-white px-3 py-1.5 rounded-lg font-semibold transition-all">
                        🎬 View Recording ({inc.clip_frame_count || '?'} frames)
                      </button>
                    )}

                    {/* Navigate link */}
                    {(() => { const c = _parseLatLng(inc.latitude, inc.longitude, inc.location); return c ? (
                      <button
                        onClick={() => window.open(`https://maps.google.com?q=${c.lat},${c.lng}`, "_blank")}
                        className="flex items-center gap-1.5 text-[10px] text-blue-400 hover:text-blue-300">
                        <Navigation size={11} /> Open in Maps
                      </button>
                    ) : null; })()}

                    {/* Response action */}
                    {inc.response_action && (
                      <div className="bg-slate-800 rounded-lg p-3 border border-slate-700">
                        <p className="text-[9px] text-slate-500 mb-1">Suggested Action</p>
                        <p className="text-xs text-white">{inc.response_action}</p>
                      </div>
                    )}

                    {/* Notes */}
                    {inc.notes && (
                      <div className="bg-slate-800 rounded-lg p-3 border border-slate-700">
                        <p className="text-[9px] text-slate-500 mb-1">Notes</p>
                        <p className="text-xs text-white whitespace-pre-line">{inc.notes}</p>
                      </div>
                    )}

                    {/* Action buttons */}
                    <div className="flex flex-wrap gap-2 pt-1">
                      {inc.status !== "resolved" && (
                        <>
                          <button onClick={() => openAssign(inc)}
                            className="flex items-center gap-1.5 px-3 py-2 bg-blue-900/40 border border-blue-800/50 text-blue-300 rounded-lg text-xs font-bold hover:bg-blue-900/60 transition-colors">
                            <UserCheck size={12} />
                            {types.length > 0 ? "Reassign" : "Assign"}
                          </button>
                          <button onClick={() => resolve(inc.id)} disabled={resolving === inc.id}
                            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-900/40 border border-emerald-800/50 text-emerald-300 rounded-lg text-xs font-bold hover:bg-emerald-900/60 transition-colors disabled:opacity-50">
                            <CheckCircle size={12} />
                            {resolving === inc.id ? "Resolving…" : "Mark Resolved"}
                          </button>
                        </>
                      )}
                      {inc.status === "resolved" && (
                        <span className="text-[10px] text-emerald-500 flex items-center gap-1">
                          <CheckCircle size={11} /> Resolved {formatTime(inc.resolved_at)}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          }) : null}
        </div>
      </div>

      {/* ── Assign Modal ── */}
      {assignModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => setAssignModal(null)}>
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-white">Assign Incident #{assignModal.id}</h2>
                <p className="text-[10px] text-slate-500 mt-0.5 line-clamp-1">{assignModal.decision || assignModal.incident_category}</p>
              </div>
              <button onClick={() => setAssignModal(null)} className="text-slate-500 hover:text-white">
                <X size={16} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Incident summary */}
              <div className="bg-slate-800 rounded-xl p-3 border border-slate-700 grid grid-cols-2 gap-2 text-[10px]">
                <div><span className="text-slate-500">Category: </span><span className="text-white font-semibold">{assignModal.incident_category || "—"}</span></div>
                <div><span className="text-slate-500">Severity: </span><span className="text-white font-semibold">{assignModal.severity || "—"}</span></div>
                <div><span className="text-slate-500">Priority: </span><span className="text-white font-semibold">{assignModal.priority_score ? `${assignModal.priority_score}/100` : "—"}</span></div>
                <div><span className="text-slate-500">Location: </span><span className="text-white font-semibold truncate"><LocationText lat={assignModal.latitude} lng={assignModal.longitude} location={assignModal.location} /></span></div>
              </div>

              {/* Responder type selector */}
              <div>
                <p className="text-xs font-semibold text-slate-400 mb-2 flex items-center gap-1.5"><Users size={12} /> Select Responder Categories</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {RESPONDER_TYPES.filter((v, i, a) => a.findIndex(x => x.value === v.value) === i).map(({ value, emoji }) => (
                    <button key={value} onClick={() => toggleType(value)}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium border transition-all text-left ${
                        assignTypes.includes(value)
                          ? "bg-blue-900/50 border-blue-700/60 text-blue-200"
                          : "bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200"
                      }`}>
                      <span>{emoji}</span> {value}
                      {assignTypes.includes(value) && <CheckCircle size={10} className="ml-auto text-blue-400" />}
                    </button>
                  ))}
                </div>
              </div>

              {/* Notes */}
              <div>
                <p className="text-xs font-semibold text-slate-400 mb-1.5">Notes (optional)</p>
                <textarea
                  value={assignNotes}
                  onChange={e => setAssignNotes(e.target.value)}
                  placeholder="Add dispatch instructions or notes…"
                  rows={3}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-slate-500 resize-none"
                />
              </div>
            </div>

            <div className="px-5 pb-5 flex gap-2">
              <button onClick={submitAssign} disabled={assigning || assignTypes.length === 0}
                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-sm font-bold transition-colors flex items-center justify-center gap-2">
                <UserCheck size={14} />
                {assigning ? "Assigning…" : `Assign to ${assignTypes.length} categor${assignTypes.length === 1 ? "y" : "ies"}`}
              </button>
              <button onClick={() => setAssignModal(null)} className="px-4 py-2.5 bg-slate-800 border border-slate-700 text-slate-400 rounded-xl text-sm font-bold hover:text-white transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Clip Playback Modal ── */}
      {clipModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-4" onClick={closeClipModal}>
          <div className="bg-slate-900 rounded-2xl border border-slate-700 w-full max-w-2xl overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700">
              <div>
                <h2 className="text-white font-bold text-sm flex items-center gap-2">🎬 Incident Recording — #{clipModal.incidentId}</h2>
                <p className="text-slate-400 text-[10px] mt-0.5">Recorded at {clipModal.recordedAt ? new Date(clipModal.recordedAt).toLocaleString() : '—'} · {clipModal.frames.length} frames</p>
              </div>
              <button onClick={closeClipModal} className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-700 transition-all"><X size={16} /></button>
            </div>

            {/* Frame viewer */}
            <div className="relative bg-black aspect-video flex items-center justify-center">
              <img
                src={`http://localhost:5000${clipModal.frames[clipModal.currentFrame]}`}
                alt={`Frame ${clipModal.currentFrame + 1}`}
                className="max-h-full max-w-full object-contain"
                onError={e => { e.target.style.opacity = 0.3; }}
              />
              {/* Frame counter */}
              <div className="absolute top-2 right-2 bg-black/60 text-white text-[10px] px-2 py-0.5 rounded-full">
                {clipModal.currentFrame + 1} / {clipModal.frames.length}
              </div>
            </div>

            {/* Controls */}
            <div className="px-5 py-4 space-y-3">
              {/* Scrubber */}
              <input
                type="range" min={0} max={clipModal.frames.length - 1} value={clipModal.currentFrame}
                onChange={e => setClipModal(m => ({ ...m, currentFrame: parseInt(e.target.value), playing: false }))}
                className="w-full accent-purple-500 cursor-pointer"
              />
              {/* Buttons */}
              <div className="flex items-center justify-center gap-3">
                <button onClick={() => setClipModal(m => ({ ...m, currentFrame: 0, playing: false }))}
                  className="px-3 py-1.5 text-xs bg-slate-700 hover:bg-slate-600 text-white rounded-lg">⏮ First</button>
                <button onClick={() => setClipModal(m => ({ ...m, currentFrame: Math.max(0, m.currentFrame - 1) }))}
                  className="px-3 py-1.5 text-xs bg-slate-700 hover:bg-slate-600 text-white rounded-lg">◀ Prev</button>
                <button onClick={toggleClipPlay}
                  className={`px-5 py-1.5 text-xs font-bold rounded-lg transition-all ${clipModal.playing ? 'bg-yellow-600 hover:bg-yellow-500 text-white' : 'bg-purple-600 hover:bg-purple-500 text-white'}`}>
                  {clipModal.playing ? '⏸ Pause' : '▶ Play'}
                </button>
                <button onClick={() => setClipModal(m => ({ ...m, currentFrame: Math.min(m.frames.length - 1, m.currentFrame + 1) }))}
                  className="px-3 py-1.5 text-xs bg-slate-700 hover:bg-slate-600 text-white rounded-lg">Next ▶</button>
                <button onClick={() => setClipModal(m => ({ ...m, currentFrame: m.frames.length - 1, playing: false }))}
                  className="px-3 py-1.5 text-xs bg-slate-700 hover:bg-slate-600 text-white rounded-lg">Last ⏭</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
