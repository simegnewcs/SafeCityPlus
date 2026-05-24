import React, { useState, useEffect, useRef } from "react";
import SuperResponderSidebar from "../layout/SuperResponderSidebar";
import {
  AlertTriangle, CheckCircle, Clock, MapPin, Cpu, Shield,
  Radio, Users, Activity, AlertCircle,
  X, RefreshCw, Zap, ToggleLeft, ToggleRight
} from "lucide-react";
import axios from "axios";
import io from "socket.io-client";

const API_URL = "http://localhost:5000/api";
const SOCKET_URL = "http://localhost:5000";

const RESPONDER_TYPES = [
  { value: "Traffic Police",      emoji: "🚔", color: "bg-blue-500/20 border-blue-500/40 text-blue-300" },
  { value: "Ambulance / Medical", emoji: "🚑", color: "bg-red-500/20 border-red-500/40 text-red-300" },
  { value: "Fire Brigade",        emoji: "🔥", color: "bg-orange-500/20 border-orange-500/40 text-orange-300" },
  { value: "Road Safety",         emoji: "🛣️", color: "bg-yellow-500/20 border-yellow-500/40 text-yellow-300" },
  { value: "Construction Safety", emoji: "🏗️", color: "bg-amber-500/20 border-amber-500/40 text-amber-300" },
  { value: "Disaster Management", emoji: "🌊", color: "bg-cyan-500/20 border-cyan-500/40 text-cyan-300" },
  { value: "Armed Police",        emoji: "🔫", color: "bg-purple-500/20 border-purple-500/40 text-purple-300" },
  { value: "Municipal Emergency", emoji: "🏙️", color: "bg-indigo-500/20 border-indigo-500/40 text-indigo-300" },
  { value: "Technical Investigation", emoji: "🔍", color: "bg-slate-500/20 border-slate-500/40 text-slate-300" },
];

const SEVERITY_STYLES = {
  "Critical Emergency": "bg-red-500/20 border-red-500/50 text-red-300",
  "Medium Risk":        "bg-yellow-500/20 border-yellow-500/40 text-yellow-300",
  "Low Risk":           "bg-emerald-500/20 border-emerald-500/40 text-emerald-300",
};

const SeverityDot = ({ severity }) => {
  const color = severity === "Critical Emergency" ? "bg-red-500"
              : severity === "Medium Risk"        ? "bg-yellow-400"
              : "bg-emerald-400";
  return <span className={`inline-block w-2 h-2 rounded-full ${color} flex-shrink-0`} />;
};

const TypeBadge = ({ type }) => {
  const meta = RESPONDER_TYPES.find(r => r.value === type);
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${meta?.color || 'bg-slate-700 border-slate-600 text-slate-300'}`}>
      {meta?.emoji} {type}
    </span>
  );
};

export default function SuperResponderDashboard() {
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const socketRef = useRef(null);

  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [aiAutoAssign, setAiAutoAssign] = useState(true);
  const [togglingAI, setTogglingAI] = useState(false);
  const [selectedIncident, setSelectedIncident] = useState(null);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignTypes, setAssignTypes] = useState([]);
  const [assignNotes, setAssignNotes] = useState("");
  const [assigning, setAssigning] = useState(false);
  const [liveAlerts, setLiveAlerts] = useState([]);
  const [filterStatus, setFilterStatus] = useState("all");
  const [showSettingsPanel, setShowSettingsPanel] = useState(false);

  const stats = {
    total: incidents.length,
    pending: incidents.filter(i => i.status === "pending").length,
    assigned: incidents.filter(i => i.status === "assigned").length,
    resolved: incidents.filter(i => i.status === "resolved").length,
    critical: incidents.filter(i => i.severity === "Critical Emergency").length,
  };

  useEffect(() => {
    fetchIncidents();
    fetchSettings();
    connectSocket();
    return () => { if (socketRef.current) socketRef.current.disconnect(); };
  }, []);

  const fetchIncidents = async () => {
    try {
      const res = await axios.get(`${API_URL}/super-responder/incidents?limit=100`);
      setIncidents(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Fetch incidents:", err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchSettings = async () => {
    try {
      const res = await axios.get(`${API_URL}/super-responder/settings`);
      setAiAutoAssign(res.data?.ai_auto_assign === "true");
    } catch {}
  };

  const connectSocket = () => {
    const userData = JSON.parse(localStorage.getItem("user") || "{}");
    const socket = io(SOCKET_URL, {
      transports: ["websocket", "polling"],
      auth: { token: userData?.id ? String(userData.id) : null },
    });
    socket.on("connect", () => setIsConnected(true));
    socket.on("disconnect", () => setIsConnected(false));

    socket.on("new-ai-incident", (incident) => {
      setIncidents(prev => [incident, ...prev]);
      setLiveAlerts(prev => [{ ...incident, _new: true }, ...prev].slice(0, 8));
    });

    socket.on("incident-assigned", (incident) => {
      setIncidents(prev => prev.map(i => i.id === incident.id ? { ...i, ...incident } : i));
    });

    socketRef.current = socket;
  };

  const toggleAiAutoAssign = async () => {
    setTogglingAI(true);
    const newVal = !aiAutoAssign;
    try {
      await axios.put(`${API_URL}/super-responder/settings`, { key: "ai_auto_assign", value: String(newVal) });
      setAiAutoAssign(newVal);
    } catch (err) {
      console.error("Toggle error:", err.message);
    } finally {
      setTogglingAI(false);
    }
  };

  const openAssignModal = (incident) => {
    setSelectedIncident(incident);
    const existing = Array.isArray(incident.assigned_to_types)
      ? incident.assigned_to_types
      : JSON.parse(incident.assigned_to_types || "[]");
    setAssignTypes(existing);
    setAssignNotes(incident.notes || "");
    setShowAssignModal(true);
  };

  const submitAssignment = async () => {
    if (!selectedIncident || assignTypes.length === 0) return;
    setAssigning(true);
    try {
      const res = await axios.post(`${API_URL}/super-responder/incidents/${selectedIncident.id}/assign`, {
        assignedTypes: assignTypes,
        notes: assignNotes,
      });
      setIncidents(prev => prev.map(i => i.id === selectedIncident.id ? res.data.incident : i));
      setShowAssignModal(false);
    } catch (err) {
      console.error("Assign error:", err.message);
    } finally {
      setAssigning(false);
    }
  };

  const resolveIncident = async (id) => {
    try {
      await axios.put(`${API_URL}/super-responder/incidents/${id}/status`, { status: "resolved" });
      setIncidents(prev => prev.map(i => i.id === id ? { ...i, status: "resolved" } : i));
    } catch (err) {
      console.error("Resolve error:", err.message);
    }
  };

  const toggleAssignType = (type) => {
    setAssignTypes(prev => prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]);
  };

  const filteredIncidents = filterStatus === "all"
    ? incidents
    : incidents.filter(i => i.status === filterStatus);

  const formatTime = (ts) => {
    if (!ts) return "—";
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) + " · " + d.toLocaleDateString([], { month: "short", day: "numeric" });
  };

  const parseTypes = (raw) => {
    if (Array.isArray(raw)) return raw;
    try { return JSON.parse(raw || "[]"); } catch { return []; }
  };

  if (loading) {
    return (
      <div className="flex h-screen bg-slate-950">
        <SuperResponderSidebar user={user} />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-red-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-slate-400 text-sm">Loading Command Center...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-950 text-white overflow-hidden">
      <SuperResponderSidebar user={user} />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="h-14 bg-slate-900 border-b border-slate-800 px-6 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <Shield size={18} className="text-red-400" />
            <div>
              <h1 className="text-sm font-bold text-white leading-none">Super Responder Command Center</h1>
              <p className="text-[10px] text-slate-500 mt-0.5">Real-time incident coordination & AI dispatch</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className={`flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full border ${isConnected ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-slate-800 border-slate-700 text-slate-500'}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`} />
              {isConnected ? "Live" : "Offline"}
            </span>
            <button onClick={() => setShowSettingsPanel(!showSettingsPanel)}
              className={`flex items-center gap-2 text-xs font-bold px-3 py-1.5 rounded-xl border transition-all ${aiAutoAssign ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300' : 'bg-slate-800 border-slate-700 text-slate-400'}`}>
              {aiAutoAssign ? <ToggleRight size={16} className="text-emerald-400" /> : <ToggleLeft size={16} />}
              AI Auto-Assign {aiAutoAssign ? "ON" : "OFF"}
            </button>
            <button onClick={() => { setRefreshing(true); fetchIncidents(); }}
              className={`p-2 hover:bg-slate-800 rounded-xl text-slate-400 hover:text-white transition-all ${refreshing ? "animate-spin" : ""}`}>
              <RefreshCw size={15} />
            </button>
          </div>
        </header>

        <div className="flex-1 flex overflow-hidden">
          {/* Main content */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Stats row */}
            <div className="grid grid-cols-5 gap-3 p-4 pb-0 flex-shrink-0">
              {[
                { label: "Total Incidents", value: stats.total, color: "text-white", icon: <Activity size={16} className="text-slate-400" /> },
                { label: "Pending", value: stats.pending, color: "text-yellow-400", icon: <Clock size={16} className="text-yellow-500" /> },
                { label: "Assigned", value: stats.assigned, color: "text-blue-400", icon: <Users size={16} className="text-blue-500" /> },
                { label: "Resolved", value: stats.resolved, color: "text-emerald-400", icon: <CheckCircle size={16} className="text-emerald-500" /> },
                { label: "Critical", value: stats.critical, color: "text-red-400", icon: <AlertCircle size={16} className="text-red-500 animate-pulse" /> },
              ].map(({ label, value, color, icon }) => (
                <div key={label} className="bg-slate-900 rounded-xl border border-slate-800 px-4 py-3">
                  <div className="flex items-center justify-between mb-1">{icon}<span className={`text-2xl font-bold ${color}`}>{value}</span></div>
                  <p className="text-[10px] text-slate-500">{label}</p>
                </div>
              ))}
            </div>

            {/* Live alert ticker */}
            {liveAlerts.length > 0 && (
              <div className="mx-4 mt-3 bg-red-950/30 border border-red-800/40 rounded-xl px-4 py-2.5 flex items-center gap-3 flex-shrink-0">
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <Radio size={12} className="text-red-400 animate-pulse" />
                  <span className="text-[10px] font-bold text-red-400 uppercase tracking-wider">Live Alert</span>
                </div>
                <div className="flex-1 overflow-hidden">
                  <p className="text-xs text-white font-semibold truncate">
                    🚨 {liveAlerts[0].decision} — <span className="text-slate-400">{liveAlerts[0].cameraName || liveAlerts[0].camera_name}</span>
                    <span className="ml-2 text-[10px] text-slate-500">{formatTime(liveAlerts[0].timestamp || liveAlerts[0].created_at)}</span>
                  </p>
                </div>
                <button onClick={() => setLiveAlerts([])} className="text-slate-600 hover:text-slate-400 flex-shrink-0"><X size={14} /></button>
              </div>
            )}

            {/* Filter tabs */}
            <div className="flex items-center gap-2 px-4 pt-4 pb-2 flex-shrink-0">
              {["all", "pending", "assigned", "resolved"].map(s => (
                <button key={s} onClick={() => setFilterStatus(s)}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg capitalize transition-all border ${filterStatus === s ? 'bg-red-900/40 border-red-700/50 text-red-300' : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-300'}`}>
                  {s === "all" ? `All (${stats.total})` : `${s.charAt(0).toUpperCase() + s.slice(1)} (${stats[s]})`}
                </button>
              ))}
            </div>

            {/* Incident list */}
            <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-2">
              {filteredIncidents.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-600">
                  <Shield size={40} className="mb-3 opacity-30" />
                  <p className="text-sm font-medium">No incidents</p>
                  <p className="text-xs mt-1">AI alerts will appear here in real-time</p>
                </div>
              ) : (
                filteredIncidents.map((inc) => {
                  const types = parseTypes(inc.assigned_to_types);
                  const isNew = liveAlerts.some(a => a.id === inc.id);
                  return (
                    <div key={inc.id}
                      className={`bg-slate-900 rounded-xl border transition-all ${inc.severity === "Critical Emergency" ? "border-red-800/60" : inc.status === "pending" ? "border-yellow-800/40" : inc.status === "resolved" ? "border-slate-700/40" : "border-slate-800"} ${isNew ? "ring-1 ring-red-500/50" : ""}`}>
                      <div className="p-4">
                        <div className="flex items-start gap-3">
                          <SeverityDot severity={inc.severity} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2 mb-1.5">
                              <div className="min-w-0">
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${SEVERITY_STYLES[inc.severity] || SEVERITY_STYLES["Low Risk"]}`}>
                                  {inc.severity}
                                </span>
                                {inc.incident_category && (
                                  <span className="ml-1.5 text-[10px] font-semibold text-slate-400">{inc.incident_category}</span>
                                )}
                              </div>
                              <div className="flex items-center gap-1.5 flex-shrink-0">
                                <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${inc.status === "resolved" ? "bg-emerald-900/40 text-emerald-400" : inc.status === "assigned" ? "bg-blue-900/40 text-blue-400" : "bg-yellow-900/40 text-yellow-400"}`}>
                                  {inc.status?.toUpperCase()}
                                </span>
                                {inc.assigned_by === "ai" && (
                                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-purple-900/40 text-purple-400 border border-purple-800/40">🤖 AI</span>
                                )}
                              </div>
                            </div>
                            <p className="text-sm font-semibold text-white mb-1 line-clamp-1">{inc.decision}</p>
                            <p className="text-xs text-slate-500 mb-2 flex items-center gap-1"><MapPin size={9} />{inc.location} · {inc.camera_name || inc.cameraName}</p>
                            {types.length > 0 && (
                              <div className="flex flex-wrap gap-1.5 mb-2">
                                {types.map(t => <TypeBadge key={t} type={t} />)}
                              </div>
                            )}
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3 text-[10px] text-slate-600">
                                <span className="flex items-center gap-1"><Cpu size={9} />{inc.accident_confidence}% confidence</span>
                                <span className="flex items-center gap-1"><Clock size={9} />{formatTime(inc.created_at)}</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                {inc.status !== "resolved" && (
                                  <>
                                    <button onClick={() => openAssignModal(inc)}
                                      className="flex items-center gap-1 px-2.5 py-1 bg-blue-900/40 border border-blue-800/50 text-blue-300 rounded-lg text-[10px] font-bold hover:bg-blue-900/60 transition-colors">
                                      <Users size={10} /> {types.length > 0 ? "Reassign" : "Assign"}
                                    </button>
                                    <button onClick={() => resolveIncident(inc.id)}
                                      className="flex items-center gap-1 px-2.5 py-1 bg-emerald-900/40 border border-emerald-800/50 text-emerald-300 rounded-lg text-[10px] font-bold hover:bg-emerald-900/60 transition-colors">
                                      <CheckCircle size={10} /> Resolve
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Settings side panel */}
          {showSettingsPanel && (
            <div className="w-72 bg-slate-900 border-l border-slate-800 flex flex-col overflow-hidden flex-shrink-0">
              <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Zap size={14} className="text-yellow-400" />
                  <span className="text-sm font-bold">AI Auto-Assignment</span>
                </div>
                <button onClick={() => setShowSettingsPanel(false)} className="text-slate-600 hover:text-slate-400"><X size={14} /></button>
              </div>
              <div className="p-4 space-y-4 overflow-y-auto flex-1">
                {/* Toggle */}
                <div className={`rounded-xl p-4 border ${aiAutoAssign ? 'bg-emerald-950/30 border-emerald-800/40' : 'bg-slate-800 border-slate-700'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-bold">AI Auto-Assign</span>
                    <button onClick={toggleAiAutoAssign} disabled={togglingAI}
                      className={`relative inline-flex items-center w-12 h-6 rounded-full transition-all ${aiAutoAssign ? 'bg-emerald-500' : 'bg-slate-600'} ${togglingAI ? 'opacity-50' : ''}`}>
                      <span className={`inline-block w-4 h-4 bg-white rounded-full shadow transition-transform ${aiAutoAssign ? 'translate-x-7' : 'translate-x-1'}`} />
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    {aiAutoAssign
                      ? "🟢 AI is automatically assigning incidents to specialized responders based on incident category and severity."
                      : "🔴 Manual mode. You must review and assign each incident to the appropriate responder teams."}
                  </p>
                </div>

                {/* Assignment logic */}
                <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
                  <div className="px-3 py-2 border-b border-slate-700">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">AI Assignment Logic</span>
                  </div>
                  <div className="divide-y divide-slate-700/50">
                    {[
                      { cat: "Vehicle Collision", types: ["Traffic Police", "Ambulance / Medical"] },
                      { cat: "Fire / Smoke",       types: ["Fire Brigade"] },
                      { cat: "Medical Emergency",  types: ["Ambulance / Medical"] },
                      { cat: "Construction Accident", types: ["Construction Safety"] },
                      { cat: "Flood / Disaster",   types: ["Disaster Management"] },
                      { cat: "Violence / Crime",   types: ["Armed Police"] },
                      { cat: "Road Blockage",      types: ["Traffic Police", "Road Safety"] },
                    ].map(({ cat, types }) => (
                      <div key={cat} className="px-3 py-2.5">
                        <p className="text-[10px] font-semibold text-white mb-1">{cat}</p>
                        <div className="flex flex-wrap gap-1">
                          {types.map(t => {
                            const meta = RESPONDER_TYPES.find(r => r.value === t);
                            return <span key={t} className="text-[9px] font-bold">{meta?.emoji} {t}</span>;
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Manual Assignment Modal */}
      {showAssignModal && selectedIncident && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={() => setShowAssignModal(false)}>
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-slate-700 flex items-center justify-between bg-slate-800/60">
              <div>
                <h3 className="font-bold text-white">Assign Responders</h3>
                <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">{selectedIncident.decision}</p>
              </div>
              <button onClick={() => setShowAssignModal(false)} className="text-slate-500 hover:text-white"><X size={18} /></button>
            </div>

            {/* Incident summary */}
            <div className="px-5 py-3 border-b border-slate-800 bg-slate-900/60">
              <div className="flex items-center gap-3 text-xs text-slate-400">
                <span className={`font-bold px-2 py-0.5 rounded-full border ${SEVERITY_STYLES[selectedIncident.severity] || SEVERITY_STYLES["Low Risk"]}`}>{selectedIncident.severity}</span>
                <span className="flex items-center gap-1"><MapPin size={10} />{selectedIncident.location}</span>
                <span className="flex items-center gap-1"><Cpu size={10} />{selectedIncident.accident_confidence}%</span>
              </div>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Select Responder Teams</p>
                <div className="grid grid-cols-2 gap-2">
                  {RESPONDER_TYPES.map((rt) => {
                    const selected = assignTypes.includes(rt.value);
                    return (
                      <button key={rt.value} onClick={() => toggleAssignType(rt.value)}
                        className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-left text-xs font-semibold transition-all ${selected ? rt.color + ' ring-1 ring-white/20' : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600'}`}>
                        <span className="text-base">{rt.emoji}</span>
                        <span className="leading-tight">{rt.value}</span>
                        {selected && <CheckCircle size={12} className="ml-auto flex-shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Emergency Notes</p>
                <textarea value={assignNotes} onChange={e => setAssignNotes(e.target.value)}
                  placeholder="Optional briefing notes for responders..."
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-white placeholder-slate-600 resize-none h-20 focus:outline-none focus:border-slate-500" />
              </div>
            </div>

            <div className="px-5 pb-5 flex gap-2">
              <button onClick={() => setShowAssignModal(false)}
                className="flex-1 py-2.5 bg-slate-800 border border-slate-700 text-slate-300 rounded-xl text-sm font-bold hover:bg-slate-700 transition-colors">
                Cancel
              </button>
              <button onClick={submitAssignment} disabled={assignTypes.length === 0 || assigning}
                className={`flex-1 py-2.5 bg-red-600 text-white rounded-xl text-sm font-bold hover:bg-red-500 transition-colors flex items-center justify-center gap-2 ${(assignTypes.length === 0 || assigning) ? 'opacity-50 cursor-not-allowed' : ''}`}>
                {assigning ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Users size={14} />}
                Assign {assignTypes.length > 0 ? `(${assignTypes.length})` : ""}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
