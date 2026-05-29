// src/pages/SuperResponderDashboard.js
import React, { useState, useEffect, useRef, useMemo } from "react";
import SuperResponderSidebar from "../layout/SuperResponderSidebar";
import {
  AlertTriangle, CheckCircle, Clock, MapPin, Cpu, Shield,
  Users, Activity, X, RefreshCw, Zap, TrendingUp,
  Bell, Eye, Target, Flame, ChevronRight, Video,
  BarChart3, Radio, Navigation
} from "lucide-react";
import {
  AreaChart, Area, ResponsiveContainer, Tooltip
} from "recharts";
import axios from "axios";
import io from "socket.io-client";

const API_URL   = "http://localhost:5000/api";
const SOCKET_URL = "http://localhost:5000";

const RESPONDER_TYPES = [
  { value: "Fire Brigade",        emoji: "🔥", color: "bg-orange-500/20 border-orange-500/40 text-orange-300" },
  { value: "Armed Police",        emoji: "🚔", color: "bg-red-500/20 border-red-500/40 text-red-300" },
  { value: "Ambulance",           emoji: "🚑", color: "bg-pink-500/20 border-pink-500/40 text-pink-300" },
  { value: "Construction Safety", emoji: "🏗️", color: "bg-amber-500/20 border-amber-500/40 text-amber-300" },
  { value: "Traffic Police",      emoji: "🚦", color: "bg-blue-500/20 border-blue-500/40 text-blue-300" },
  { value: "Crowd Control",       emoji: "👥", color: "bg-purple-500/20 border-purple-500/40 text-purple-300" },
  { value: "Emergency Patrol",    emoji: "🛡️", color: "bg-emerald-500/20 border-emerald-500/40 text-emerald-300" },
  { value: "Site Inspector",      emoji: "🔍", color: "bg-yellow-500/20 border-yellow-500/40 text-yellow-300" },
  { value: "General Responder",   emoji: "⚠️", color: "bg-slate-500/20 border-slate-500/40 text-slate-300" },
];

const SEVERITY_STYLES = {
  "Critical Emergency": { badge: "bg-red-500/15 border-red-500/40 text-red-300",     dot: "bg-red-500",     bar: "bg-red-500",     ring: "border-red-800/60" },
  "High Risk":          { badge: "bg-orange-500/15 border-orange-500/40 text-orange-300", dot: "bg-orange-400", bar: "bg-orange-400", ring: "border-orange-800/50" },
  "Medium Risk":        { badge: "bg-amber-500/15 border-amber-500/40 text-amber-300",  dot: "bg-amber-400",  bar: "bg-amber-400",  ring: "border-amber-800/40" },
  "Low Risk":           { badge: "bg-emerald-500/15 border-emerald-500/40 text-emerald-300", dot: "bg-emerald-400", bar: "bg-emerald-500", ring: "border-slate-700/40" },
};

const STATUS_META = {
  pending:      { label: "PENDING",     cls: "bg-amber-500/10 text-amber-400 border border-amber-500/20" },
  assigned:     { label: "ASSIGNED",    cls: "bg-blue-500/10 text-blue-400 border border-blue-500/20" },
  in_progress:  { label: "IN PROGRESS", cls: "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20" },
  resolved:     { label: "RESOLVED",    cls: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" },
};

const DISPATCH_RULES = [
  { cat: "Vehicle Collision",     types: ["Traffic Police", "Ambulance"] },
  { cat: "Fire / Smoke",          types: ["Fire Brigade"] },
  { cat: "Medical Emergency",     types: ["Ambulance"] },
  { cat: "Construction Accident", types: ["Construction Safety"] },
  { cat: "Violence / Crime",      types: ["Armed Police"] },
  { cat: "Road Blockage",         types: ["Traffic Police"] },
  { cat: "Crowd Panic",           types: ["Crowd Control", "Ambulance"] },
  { cat: "Flood / Disaster",      types: ["Emergency Patrol"] },
];

const fmtTime = (ts) => {
  if (!ts) return "—";
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) +
    " · " + d.toLocaleDateString([], { month: "short", day: "numeric" });
};

const parseTypes = (raw) => {
  if (Array.isArray(raw)) return raw;
  try { return JSON.parse(raw || "[]"); } catch { return []; }
};

const TypeBadge = ({ type }) => {
  const meta = RESPONDER_TYPES.find(r => r.value === type);
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${meta?.color || "bg-slate-700 border-slate-600 text-slate-300"}`}>
      {meta?.emoji} {type}
    </span>
  );
};

const MiniTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-[10px]">
      <p className="text-white font-bold">{payload[0].value}</p>
    </div>
  );
};

export default function SuperResponderDashboard() {
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const socketRef = useRef(null);

  const [incidents, setIncidents]         = useState([]);
  const [loading, setLoading]             = useState(true);
  const [refreshing, setRefreshing]       = useState(false);
  const [isConnected, setIsConnected]     = useState(false);
  const [aiAutoAssign, setAiAutoAssign]   = useState(true);
  const [togglingAI, setTogglingAI]       = useState(false);
  const [selectedInc, setSelectedInc]     = useState(null);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignTypes, setAssignTypes]     = useState([]);
  const [assignNotes, setAssignNotes]     = useState("");
  const [assigning, setAssigning]         = useState(false);
  const [liveAlerts, setLiveAlerts]       = useState([]);
  const [filterStatus, setFilterStatus]   = useState("all");
  const [activePanel, setActivePanel]     = useState("analytics"); // analytics | dispatch
  const [toast, setToast]                 = useState(null);
  const [hourlyTrend, setHourlyTrend]     = useState([]);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  /* ── stats ── */
  const stats = useMemo(() => ({
    total:    incidents.length,
    pending:  incidents.filter(i => i.status === "pending").length,
    assigned: incidents.filter(i => i.status === "assigned" || i.status === "in_progress").length,
    resolved: incidents.filter(i => i.status === "resolved").length,
    critical: incidents.filter(i => i.severity === "Critical Emergency").length,
    aiAuto:   incidents.filter(i => i.assigned_by === "ai" || i.assigned_by === "auto").length,
  }), [incidents]);

  /* ── hourly sparkline (last 12h) ── */
  const buildHourly = (incs) => {
    const now = new Date();
    return Array.from({ length: 12 }, (_, i) => {
      const h = new Date(now - (11 - i) * 3600000);
      const label = h.toLocaleTimeString([], { hour: "2-digit" });
      const count = incs.filter(inc => {
        const d = new Date(inc.created_at);
        return d >= h && d < new Date(h.getTime() + 3600000);
      }).length;
      return { h: label, v: count };
    });
  };

  /* ── responder type breakdown ── */
  const responderBreakdown = useMemo(() => {
    const map = {};
    incidents.forEach(i => {
      parseTypes(i.assigned_to_types).forEach(t => { map[t] = (map[t] || 0) + 1; });
    });
    return Object.entries(map).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
  }, [incidents]);

  /* ── category breakdown ── */
  const categoryBreakdown = useMemo(() => {
    const map = {};
    incidents.forEach(i => { const c = i.incident_category || "Other"; map[c] = (map[c] || 0) + 1; });
    return Object.entries(map).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 6);
  }, [incidents]);

  /* ── fetch ── */
  const fetchIncidents = async () => {
    try {
      const res = await axios.get(`${API_URL}/super-responder/incidents?limit=200`);
      const data = Array.isArray(res.data) ? res.data : [];
      setIncidents(data);
      setHourlyTrend(buildHourly(data));
    } catch (e) {
      console.error("Fetch error:", e.message);
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

  /* ── socket ── */
  const connectSocket = () => {
    const socket = io(SOCKET_URL, {
      transports: ["websocket", "polling"],
      auth: { token: user?.id ? String(user.id) : null },
    });
    socket.on("connect",    () => setIsConnected(true));
    socket.on("disconnect", () => setIsConnected(false));

    socket.on("new-ai-incident", (inc) => {
      setIncidents(prev => {
        const next = [inc, ...prev];
        setHourlyTrend(buildHourly(next));
        return next;
      });
      setLiveAlerts(prev => [{ ...inc, _new: true }, ...prev].slice(0, 10));
    });

    socket.on("incident-assigned", (inc) => {
      setIncidents(prev => prev.map(i => i.id === inc.id ? { ...i, ...inc } : i));
    });

    socketRef.current = socket;
  };

  useEffect(() => {
    fetchIncidents();
    fetchSettings();
    connectSocket();
    const iv = setInterval(fetchIncidents, 30000);
    return () => { clearInterval(iv); socketRef.current?.disconnect(); };
  }, []);

  /* ── AI toggle ── */
  const toggleAI = async () => {
    setTogglingAI(true);
    const newVal = !aiAutoAssign;
    try {
      await axios.put(`${API_URL}/super-responder/settings`, { key: "ai_auto_assign", value: String(newVal) });
      setAiAutoAssign(newVal);
      showToast(`AI Auto-Assign ${newVal ? "enabled" : "disabled"}`);
    } catch { showToast("Toggle failed", "error"); }
    finally { setTogglingAI(false); }
  };

  /* ── assign modal ── */
  const openAssignModal = (inc) => {
    setSelectedInc(inc);
    setAssignTypes(parseTypes(inc.assigned_to_types));
    setAssignNotes(inc.notes || "");
    setShowAssignModal(true);
  };

  const submitAssignment = async () => {
    if (!selectedInc || assignTypes.length === 0) return;
    setAssigning(true);
    try {
      const res = await axios.post(`${API_URL}/super-responder/incidents/${selectedInc.id}/assign`, {
        assignedTypes: assignTypes, notes: assignNotes,
      });
      setIncidents(prev => prev.map(i => i.id === selectedInc.id ? res.data.incident : i));
      setShowAssignModal(false);
      showToast("Responders dispatched");
    } catch { showToast("Dispatch failed", "error"); }
    finally { setAssigning(false); }
  };

  const resolveIncident = async (id) => {
    try {
      await axios.put(`${API_URL}/super-responder/incidents/${id}/status`, { status: "resolved" });
      setIncidents(prev => prev.map(i => i.id === id ? { ...i, status: "resolved" } : i));
      showToast("Incident resolved");
    } catch { showToast("Failed to resolve", "error"); }
  };

  const toggleAssignType = (t) =>
    setAssignTypes(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);

  const filteredInc = filterStatus === "all"
    ? incidents
    : incidents.filter(i => i.status === filterStatus);

  const sev = (s) => SEVERITY_STYLES[s] || SEVERITY_STYLES["Low Risk"];
  const stm = (s) => STATUS_META[s] || STATUS_META["pending"];

  /* ── loading screen ── */
  if (loading) return (
    <div className="flex h-screen bg-[#0a0c12]">
      <SuperResponderSidebar user={user} />
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto">
            <Shield size={22} className="text-red-400 animate-pulse" />
          </div>
          <p className="text-slate-400 text-sm font-medium">Loading Command Center…</p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-[#0a0c12] text-white overflow-hidden">
      <SuperResponderSidebar user={user} />

      <div className="flex-1 flex flex-col overflow-hidden">

        {/* ── Toast ── */}
        {toast && (
          <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold shadow-xl ${toast.type === "error" ? "bg-red-600" : "bg-emerald-600"}`}>
            {toast.type === "error" ? <AlertTriangle size={13} /> : <CheckCircle size={13} />}
            {toast.msg}
          </div>
        )}

        {/* ── Header ── */}
        <header className="h-14 bg-[#0d1017] border-b border-white/[0.06] px-6 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center">
              <Shield size={15} className="text-red-400" />
            </div>
            <div>
              <h1 className="text-sm font-bold leading-none tracking-tight">Command Center</h1>
              <p className="text-[10px] text-slate-500 mt-0.5">Real-time incident coordination</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* LIVE badge */}
            <span className={`flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1.5 rounded-lg border ${isConnected ? "bg-emerald-500/8 border-emerald-500/20 text-emerald-400" : "bg-slate-800/60 border-white/5 text-slate-500"}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? "bg-emerald-400 animate-pulse" : "bg-slate-600"}`} />
              {isConnected ? "LIVE" : "OFFLINE"}
            </span>

            {/* AI toggle */}
            <button onClick={toggleAI} disabled={togglingAI}
              className={`flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all ${aiAutoAssign ? "bg-violet-500/10 border-violet-500/25 text-violet-300 hover:bg-violet-500/15" : "bg-slate-800/60 border-white/5 text-slate-400 hover:border-white/10"}`}>
              <Cpu size={12} className={aiAutoAssign ? "text-violet-400" : "text-slate-500"} />
              AI Auto-Assign
              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${aiAutoAssign ? "bg-violet-500/20 text-violet-300" : "bg-slate-700 text-slate-500"}`}>
                {aiAutoAssign ? "ON" : "OFF"}
              </span>
            </button>

            <button onClick={() => { setRefreshing(true); fetchIncidents(); }}
              className={`w-8 h-8 flex items-center justify-center rounded-lg border border-white/5 bg-slate-800/60 text-slate-400 hover:text-white transition-all ${refreshing ? "animate-spin" : ""}`}>
              <RefreshCw size={13} />
            </button>
          </div>
        </header>

        {/* ── Body: list + right panel ── */}
        <div className="flex-1 flex overflow-hidden">

          {/* ── Left: incident feed ── */}
          <div className="flex-1 flex flex-col overflow-hidden min-w-0">

            {/* KPI strip */}
            <div className="grid grid-cols-6 gap-2.5 p-4 pb-3 flex-shrink-0">
              {[
                { label: "Total",    value: stats.total,    icon: <BarChart3 size={13} />, accent: "text-slate-300",  bg: "bg-slate-800/40",  border: "border-white/5"         },
                { label: "Pending",  value: stats.pending,  icon: <Clock size={13} />,     accent: "text-amber-400",  bg: "bg-amber-500/5",   border: "border-amber-500/15"    },
                { label: "Assigned", value: stats.assigned, icon: <Users size={13} />,     accent: "text-blue-400",   bg: "bg-blue-500/5",    border: "border-blue-500/15"     },
                { label: "Resolved", value: stats.resolved, icon: <CheckCircle size={13} />, accent: "text-emerald-400", bg: "bg-emerald-500/5", border: "border-emerald-500/15" },
                { label: "Critical", value: stats.critical, icon: <Flame size={13} />,     accent: "text-red-400",    bg: "bg-red-500/5",     border: "border-red-500/20"      },
                { label: "AI Auto",  value: stats.aiAuto,   icon: <Cpu size={13} />,       accent: "text-violet-400", bg: "bg-violet-500/5",  border: "border-violet-500/15"   },
              ].map(({ label, value, icon, accent, bg, border }) => (
                <div key={label} className={`${bg} border ${border} rounded-xl px-3 py-2.5 flex items-center justify-between`}>
                  <div>
                    <p className="text-[9px] text-slate-500 font-bold uppercase tracking-wider mb-1">{label}</p>
                    <p className={`text-xl font-black leading-none ${accent}`}>{value}</p>
                  </div>
                  <div className={`w-7 h-7 rounded-lg ${bg} border ${border} flex items-center justify-center ${accent} opacity-60`}>{icon}</div>
                </div>
              ))}
            </div>

            {/* Live alert banner */}
            {liveAlerts.length > 0 && (
              <div className="mx-4 mb-3 flex-shrink-0 bg-red-500/8 border border-red-500/20 rounded-xl px-4 py-2.5 flex items-center gap-3">
                <div className="relative flex items-center gap-2 flex-shrink-0">
                  <span className="absolute w-2 h-2 rounded-full bg-red-500 animate-ping" />
                  <span className="relative w-2 h-2 rounded-full bg-red-500" />
                  <span className="text-[10px] font-bold text-red-400 uppercase tracking-widest">New Alert</span>
                </div>
                <p className="flex-1 text-xs text-white font-semibold truncate">
                  {liveAlerts[0].decision}
                  <span className="mx-2 text-slate-600">·</span>
                  <span className="text-slate-400 font-normal">{liveAlerts[0].camera_name || liveAlerts[0].cameraName || "CCTV"}</span>
                </p>
                <button onClick={() => setLiveAlerts([])} className="text-slate-600 hover:text-slate-400 w-5 h-5 flex items-center justify-center rounded hover:bg-white/5 flex-shrink-0"><X size={12} /></button>
              </div>
            )}

            {/* Filter tabs */}
            <div className="flex items-center gap-1.5 px-4 mb-3 flex-shrink-0">
              {[
                { key: "all",      label: "All",      count: stats.total    },
                { key: "pending",  label: "Pending",  count: stats.pending  },
                { key: "assigned", label: "Assigned", count: stats.assigned },
                { key: "resolved", label: "Resolved", count: stats.resolved },
              ].map(({ key, label, count }) => (
                <button key={key} onClick={() => setFilterStatus(key)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${filterStatus === key ? "bg-white/8 border border-white/10 text-white" : "text-slate-500 hover:text-slate-300 border border-transparent hover:border-white/5"}`}>
                  {label}
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md ${filterStatus === key ? "bg-white/10 text-slate-300" : "bg-slate-800 text-slate-500"}`}>{count}</span>
                </button>
              ))}
              <span className="ml-auto text-[10px] text-slate-600">{filteredInc.length} showing</span>
            </div>

            {/* Incident list */}
            <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-1.5"
              style={{ scrollbarWidth: "thin", scrollbarColor: "#1e2535 transparent" }}>
              {filteredInc.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-slate-700">
                  <div className="w-16 h-16 rounded-2xl bg-slate-800/60 border border-white/5 flex items-center justify-center mb-4">
                    <Target size={28} className="opacity-40" />
                  </div>
                  <p className="text-sm font-semibold text-slate-500">No incidents</p>
                  <p className="text-xs mt-1 text-slate-600">AI alerts will appear here in real-time</p>
                </div>
              ) : filteredInc.map(inc => {
                const types = parseTypes(inc.assigned_to_types);
                const isNew = liveAlerts.some(a => a.id === inc.id);
                const sv = sev(inc.severity);
                const sm = stm(inc.status);
                return (
                  <div key={inc.id}
                    className={`group bg-[#0d1117] border ${sv.ring} rounded-xl overflow-hidden transition-all hover:border-white/10 ${isNew ? "ring-1 ring-red-500/30" : ""}`}>
                    <div className={`h-0.5 w-full ${sv.bar} opacity-60`} />
                    <div className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="mt-1 flex-shrink-0">
                          <span className={`inline-block w-2 h-2 rounded-full ${sv.dot} ${inc.severity === "Critical Emergency" ? "animate-pulse" : ""}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          {/* Header */}
                          <div className="flex items-center justify-between gap-2 mb-1.5">
                            <div className="flex items-center gap-2 min-w-0 flex-wrap">
                              <span className={`text-[9px] font-bold px-2 py-0.5 rounded-md border ${sv.badge}`}>{inc.severity}</span>
                              {inc.incident_category && <span className="text-[10px] text-slate-500 font-medium">{inc.incident_category}</span>}
                              {isNew && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-red-500/15 text-red-400 border border-red-500/20 animate-pulse">NEW</span>}
                            </div>
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              {(inc.assigned_by === "ai" || inc.assigned_by === "auto") && (
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-violet-500/10 text-violet-400 border border-violet-500/20">🤖 AI</span>
                              )}
                              <span className={`text-[9px] font-bold px-2 py-0.5 rounded-md ${sm.cls}`}>{sm.label}</span>
                            </div>
                          </div>

                          {/* Decision */}
                          <p className="text-sm font-semibold text-white mb-1.5 leading-snug">{inc.decision}</p>

                          {/* Meta */}
                          <div className="flex items-center gap-3 text-[10px] text-slate-600 mb-2.5 flex-wrap">
                            {inc.location && <span className="flex items-center gap-1"><MapPin size={9} />{inc.location}</span>}
                            {inc.camera_name && <span className="flex items-center gap-1"><Eye size={9} />{inc.camera_name}</span>}
                            <span className="flex items-center gap-1"><Cpu size={9} />{inc.accident_confidence || 0}%</span>
                            <span className="flex items-center gap-1 ml-auto"><Clock size={9} />{fmtTime(inc.created_at)}</span>
                          </div>

                          {/* Assigned types */}
                          {types.length > 0 && (
                            <div className="flex flex-wrap gap-1 mb-2.5">
                              {types.map(t => <TypeBadge key={t} type={t} />)}
                            </div>
                          )}

                          {/* Actions */}
                          {inc.status !== "resolved" && (
                            <div className="flex items-center gap-2 pt-2 border-t border-white/[0.04]">
                              <button onClick={() => openAssignModal(inc)}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/10 border border-blue-500/20 text-blue-300 rounded-lg text-[10px] font-semibold hover:bg-blue-500/15 transition-colors">
                                <Users size={10} /> {types.length > 0 ? "Reassign" : "Assign Responders"}
                              </button>
                              <button onClick={() => resolveIncident(inc.id)}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 rounded-lg text-[10px] font-semibold hover:bg-emerald-500/15 transition-colors">
                                <CheckCircle size={10} /> Resolve
                              </button>
                              {inc.location && (
                                <button onClick={() => window.open(`https://maps.google.com?q=${encodeURIComponent(inc.location)}`, "_blank")}
                                  className="flex items-center gap-1.5 px-2 py-1.5 bg-slate-800/60 border border-white/5 text-slate-400 rounded-lg text-[10px] font-semibold hover:text-white transition-colors ml-auto">
                                  <Navigation size={10} />
                                </button>
                              )}
                            </div>
                          )}
                          {inc.status === "resolved" && (
                            <div className="flex items-center gap-1.5 pt-2 border-t border-white/[0.04] text-[10px] text-emerald-600">
                              <CheckCircle size={10} /> Incident resolved
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Right panel ── */}
          <div className="w-72 bg-[#0d1017] border-l border-white/[0.06] flex flex-col overflow-hidden flex-shrink-0">

            {/* Panel tabs */}
            <div className="flex border-b border-white/[0.06] flex-shrink-0">
              {[["analytics","Analytics",BarChart3],["dispatch","Dispatch",Radio]].map(([id, label, Icon]) => (
                <button key={id} onClick={() => setActivePanel(id)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-[11px] font-bold transition-all ${activePanel === id ? "text-white border-b-2 border-violet-500" : "text-slate-600 hover:text-slate-400"}`}>
                  <Icon size={11} /> {label}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-3" style={{ scrollbarWidth: "thin", scrollbarColor: "#1e2535 transparent" }}>

              {/* ── ANALYTICS panel ── */}
              {activePanel === "analytics" && (
                <>
                  {/* Sparkline */}
                  <div className="bg-slate-800/40 border border-white/5 rounded-xl p-3">
                    <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-2">Incident Activity (12h)</p>
                    <div className="h-20">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={hourlyTrend}>
                          <defs>
                            <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%"  stopColor="#ef4444" stopOpacity={0.3} />
                              <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <Area type="monotone" dataKey="v" stroke="#ef4444" fill="url(#grad)" strokeWidth={1.5} dot={false} />
                          <Tooltip content={<MiniTooltip />} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* AI stats */}
                  <div className="bg-slate-800/40 border border-white/5 rounded-xl p-3 space-y-2">
                    <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">AI Performance</p>
                    {[
                      { label: "Auto-Assign Rate", value: stats.total > 0 ? `${Math.round((stats.aiAuto / stats.total) * 100)}%` : "0%", cls: "text-violet-400" },
                      { label: "Avg AI Confidence", value: incidents.length > 0
                        ? `${Math.round(incidents.reduce((s, i) => s + (i.accident_confidence || 0), 0) / incidents.length)}%`
                        : "—", cls: "text-blue-400" },
                      { label: "Resolution Rate", value: stats.total > 0 ? `${Math.round((stats.resolved / stats.total) * 100)}%` : "0%", cls: "text-emerald-400" },
                    ].map(({ label, value, cls }) => (
                      <div key={label} className="flex items-center justify-between">
                        <span className="text-[10px] text-slate-400">{label}</span>
                        <span className={`text-sm font-black ${cls}`}>{value}</span>
                      </div>
                    ))}
                  </div>

                  {/* Responder breakdown */}
                  <div className="bg-slate-800/40 border border-white/5 rounded-xl p-3">
                    <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-2">Dispatch by Type</p>
                    <div className="space-y-1.5">
                      {responderBreakdown.length === 0
                        ? <p className="text-[10px] text-slate-600 text-center py-2">No dispatch data</p>
                        : responderBreakdown.map(({ name, count }) => {
                          const meta = RESPONDER_TYPES.find(r => r.value === name);
                          const pct = Math.round((count / (responderBreakdown[0]?.count || 1)) * 100);
                          return (
                            <div key={name}>
                              <div className="flex items-center justify-between mb-0.5">
                                <span className="text-[10px] text-slate-300">{meta?.emoji} {name}</span>
                                <span className="text-[10px] font-bold text-slate-400">{count}</span>
                              </div>
                              <div className="h-1 bg-slate-700/50 rounded-full overflow-hidden">
                                <div className="h-full bg-violet-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                              </div>
                            </div>
                          );
                        })
                      }
                    </div>
                  </div>

                  {/* Category breakdown */}
                  <div className="bg-slate-800/40 border border-white/5 rounded-xl p-3">
                    <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-2">Top Categories</p>
                    <div className="space-y-1.5">
                      {categoryBreakdown.map(({ name, count }, i) => {
                        const colors = ["bg-red-500","bg-orange-500","bg-yellow-500","bg-emerald-500","bg-blue-500","bg-purple-500"];
                        const pct = Math.round((count / (categoryBreakdown[0]?.count || 1)) * 100);
                        return (
                          <div key={name}>
                            <div className="flex items-center justify-between mb-0.5">
                              <span className="text-[10px] text-slate-300 truncate flex-1 pr-2">{name}</span>
                              <span className="text-[10px] font-bold text-slate-400">{count}</span>
                            </div>
                            <div className="h-1 bg-slate-700/50 rounded-full overflow-hidden">
                              <div className={`h-full ${colors[i % colors.length]} rounded-full transition-all`} style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Quick nav */}
                  <div className="bg-slate-800/40 border border-white/5 rounded-xl p-3 space-y-1.5">
                    <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-1">Quick Nav</p>
                    {[
                      { label: "Incident Queue", href: "/super-responder/incidents", icon: AlertTriangle, cls: "text-red-300" },
                      { label: "CCTV Monitor",   href: "/super-responder/cctv",      icon: Video,         cls: "text-purple-300" },
                      { label: "Analytics",       href: "/super-responder/analytics", icon: TrendingUp,    cls: "text-blue-300"   },
                    ].map(({ label, href, icon: Icon, cls }) => (
                      <button key={label} onClick={() => window.location.href = href}
                        className="w-full flex items-center gap-2 px-2.5 py-2 bg-slate-900/50 border border-white/5 rounded-lg text-[10px] font-semibold text-slate-400 hover:text-white hover:border-white/10 transition-all">
                        <Icon size={11} className={cls} /> {label} <ChevronRight size={10} className="ml-auto opacity-40" />
                      </button>
                    ))}
                  </div>
                </>
              )}

              {/* ── DISPATCH panel ── */}
              {activePanel === "dispatch" && (
                <>
                  {/* AI toggle card */}
                  <div className={`rounded-xl p-4 border transition-all ${aiAutoAssign ? "bg-violet-500/8 border-violet-500/20" : "bg-slate-800/40 border-white/5"}`}>
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="text-xs font-bold text-white">Auto-Assignment</p>
                        <p className="text-[10px] text-slate-500 mt-0.5">AI dispatches responders</p>
                      </div>
                      <button onClick={toggleAI} disabled={togglingAI}
                        className={`relative inline-flex items-center w-10 h-5 rounded-full transition-all ${aiAutoAssign ? "bg-violet-500" : "bg-slate-600"} ${togglingAI ? "opacity-50" : ""}`}>
                        <span className={`inline-block w-3.5 h-3.5 bg-white rounded-full shadow transition-transform ${aiAutoAssign ? "translate-x-5" : "translate-x-0.5"}`} />
                      </button>
                    </div>
                    <p className={`text-[10px] leading-relaxed ${aiAutoAssign ? "text-violet-300/70" : "text-slate-500"}`}>
                      {aiAutoAssign ? "AI actively routes incidents to specialized teams." : "Manual mode — each incident needs your review."}
                    </p>
                  </div>

                  {/* Dispatch rules */}
                  <div>
                    <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-2 px-1">Dispatch Rules</p>
                    <div className="bg-slate-800/40 border border-white/5 rounded-xl overflow-hidden divide-y divide-white/[0.04]">
                      {DISPATCH_RULES.map(({ cat, types }) => (
                        <div key={cat} className="px-3 py-2.5 hover:bg-white/[0.02] transition-colors">
                          <p className="text-[10px] font-semibold text-slate-300 mb-1.5">{cat}</p>
                          <div className="flex flex-wrap gap-1">
                            {types.map(t => {
                              const meta = RESPONDER_TYPES.find(r => r.value === t);
                              return <span key={t} className="text-[9px] text-slate-400">{meta?.emoji} {t}</span>;
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Recent live alerts */}
                  {liveAlerts.length > 0 && (
                    <div>
                      <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-2 px-1">Recent Alerts</p>
                      <div className="space-y-1.5">
                        {liveAlerts.slice(0, 5).map((a, i) => (
                          <div key={i} className="bg-red-500/5 border border-red-500/15 rounded-lg px-3 py-2">
                            <p className="text-[10px] text-white font-semibold truncate">{a.decision || "Alert"}</p>
                            <p className="text-[9px] text-slate-500 mt-0.5">{fmtTime(a.created_at)}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Assignment modal ── */}
      {showAssignModal && selectedInc && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => setShowAssignModal(false)}>
          <div className="bg-[#0d1117] border border-white/10 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl"
            onClick={e => e.stopPropagation()}>

            <div className="px-5 py-4 border-b border-white/[0.06] flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center flex-shrink-0">
                  <Users size={15} className="text-blue-400" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Assign Responders</h3>
                  <p className="text-[10px] text-slate-500 mt-0.5 line-clamp-1">{selectedInc.decision}</p>
                </div>
              </div>
              <button onClick={() => setShowAssignModal(false)}
                className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-500 hover:text-white hover:bg-white/8 transition-colors flex-shrink-0">
                <X size={14} />
              </button>
            </div>

            <div className="px-5 py-2.5 bg-white/[0.02] border-b border-white/[0.04] flex items-center gap-3 text-[10px] text-slate-500">
              <span className={`font-bold px-2 py-0.5 rounded-md border ${sev(selectedInc.severity).badge}`}>{selectedInc.severity}</span>
              {selectedInc.location && <span className="flex items-center gap-1"><MapPin size={9} />{selectedInc.location}</span>}
              <span className="flex items-center gap-1"><Cpu size={9} />{selectedInc.accident_confidence || 0}% conf</span>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">Select Response Teams</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {RESPONDER_TYPES.map(rt => {
                    const selected = assignTypes.includes(rt.value);
                    return (
                      <button key={rt.value} onClick={() => toggleAssignType(rt.value)}
                        className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-left text-xs font-semibold transition-all ${selected ? rt.color + " ring-1 ring-white/10" : "bg-slate-800/50 border-white/5 text-slate-400 hover:border-white/10 hover:text-slate-300"}`}>
                        <span className="text-sm leading-none">{rt.emoji}</span>
                        <span className="leading-tight flex-1 text-[11px]">{rt.value}</span>
                        {selected && <CheckCircle size={11} className="flex-shrink-0 opacity-80" />}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Briefing Notes</p>
                <textarea value={assignNotes} onChange={e => setAssignNotes(e.target.value)}
                  placeholder="Optional notes for responders…"
                  className="w-full bg-slate-800/50 border border-white/5 rounded-xl px-3 py-2.5 text-xs text-white placeholder-slate-600 resize-none h-16 focus:outline-none focus:border-white/10 transition-colors" />
              </div>
            </div>

            <div className="px-5 pb-5 flex gap-2">
              <button onClick={() => setShowAssignModal(false)}
                className="flex-1 py-2.5 bg-slate-800/60 border border-white/5 text-slate-300 rounded-xl text-xs font-semibold hover:bg-slate-700/60 transition-colors">
                Cancel
              </button>
              <button onClick={submitAssignment} disabled={assignTypes.length === 0 || assigning}
                className={`flex-1 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-500 transition-colors flex items-center justify-center gap-2 ${(assignTypes.length === 0 || assigning) ? "opacity-40 cursor-not-allowed" : ""}`}>
                {assigning
                  ? <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  : <Users size={12} />}
                Dispatch {assignTypes.length > 0 ? `(${assignTypes.length})` : ""}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
