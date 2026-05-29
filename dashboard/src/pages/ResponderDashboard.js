// src/pages/ResponderDashboard.js
import React, { useEffect, useState, useMemo, useRef } from "react";
import ResponderSidebar from "../layout/ResponderSidebar";
import MapView from "../components/MapView";
import axios from "axios";
import io from "socket.io-client";
import {
  Shield, MapPin, Clock, CheckCircle, AlertTriangle,
  RefreshCw, Navigation, Phone, Eye, Activity,
  X, Users, BellRing, Video, Wifi, WifiOff, Zap,
  Cpu, ChevronRight, Target, Flame, Radio
} from "lucide-react";

const API_URL = "http://localhost:5000/api";
const SOCKET_URL = "http://localhost:5000";

const RESPONDER_EMOJI = {
  "Fire Brigade": "🔥", "Armed Police": "🚔", "Ambulance": "🚑",
  "Construction Safety": "🏗️", "Traffic Police": "🚦", "Crowd Control": "👥",
  "Emergency Patrol": "🛡️", "Site Inspector": "🔍", "General Responder": "⚠️",
};

const SEV_CLS = {
  "Critical Emergency": "bg-red-500/15 border-red-500/40 text-red-300",
  "High Risk":          "bg-orange-500/15 border-orange-500/40 text-orange-300",
  "Medium Risk":        "bg-yellow-500/15 border-yellow-500/40 text-yellow-300",
  "Low Risk":           "bg-emerald-500/15 border-emerald-500/40 text-emerald-300",
};

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

export default function ResponderDashboard() {
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const socketRef = useRef(null);

  const [myIncidents, setMyIncidents]       = useState([]);
  const [aiIncidents, setAiIncidents]       = useState([]);
  const [emergencyContacts, setContacts]    = useState([]);
  const [cameraStats, setCameraStats]       = useState({ total: 0, active: 0, alerts: 0 });
  const [loading, setLoading]               = useState(true);
  const [lastUpdated, setLastUpdated]       = useState(new Date());
  const [isConnected, setIsConnected]       = useState(false);
  const [assignAlert, setAssignAlert]       = useState(null);
  const [selectedInc, setSelectedInc]       = useState(null);
  const [filterStatus, setFilterStatus]     = useState("all");
  const [toast, setToast]                   = useState(null);
  const [updatingId, setUpdatingId]         = useState(null);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  /* ── fetch all ── */
  const fetchAll = async () => {
    try {
      let u = JSON.parse(localStorage.getItem("user") || "{}");
      if (!u.responder_type && u.id) {
        try {
          const pr = await axios.get(`${API_URL}/users/${u.id}`);
          if (pr.data?.responder_type) {
            u = { ...u, responder_type: pr.data.responder_type };
            localStorage.setItem("user", JSON.stringify(u));
          }
        } catch {}
      }

      const rtype = u.responder_type || u.responderType || "";

      const [aiRes, contactsRes, statsRes] = await Promise.allSettled([
        rtype
          ? axios.get(`${API_URL}/super-responder/my-incidents?responderType=${encodeURIComponent(rtype)}&limit=100`)
          : Promise.resolve({ data: { incidents: [] } }),
        axios.get(`${API_URL}/emergency-contacts`),
        axios.get(`${API_URL}/cctv/stats`),
      ]);

      if (aiRes.status === "fulfilled") {
        setAiIncidents(aiRes.value.data?.incidents || []);
      }
      if (contactsRes.status === "fulfilled") {
        const raw = contactsRes.value.data;
        setContacts(Array.isArray(raw) ? raw : raw.contacts || []);
      }
      if (statsRes.status === "fulfilled") {
        const s = statsRes.value.data;
        setCameraStats({
          total:  s.total_cameras ?? s.total ?? 0,
          active: s.active_cameras ?? s.active ?? 0,
          alerts: s.total_alerts  ?? s.alerts ?? 0,
        });
      }

      setLastUpdated(new Date());
    } catch (e) {
      console.error("Dashboard fetch error:", e);
    } finally {
      setLoading(false);
    }
  };

  /* ── socket ── */
  useEffect(() => {
    fetchAll();
    const iv = setInterval(fetchAll, 30000);

    const socket = io(SOCKET_URL, { transports: ["websocket", "polling"] });
    socketRef.current = socket;
    socket.on("connect",    () => setIsConnected(true));
    socket.on("disconnect", () => setIsConnected(false));

    socket.on("incident-assigned", (inc) => {
      const types = parseTypes(inc.assignedTypes ?? inc.assigned_to_types);
      const rtype = user.responder_type || "";
      if (!rtype || types.includes(rtype)) {
        setAssignAlert({ ...inc, assignedTypes: types });
        fetchAll();
        try { new Audio("/alert.mp3").play().catch(() => {}); } catch {}
      }
    });

    socket.on("new-ai-incident", (data) => {
      const types = parseTypes(data.assignedTypes ?? data.assigned_to_types);
      const rtype = user.responder_type || "";
      if (!rtype || types.includes(rtype)) fetchAll();
    });

    return () => { clearInterval(iv); socket.disconnect(); };
  }, [user.id]);

  /* ── derived ── */
  const allInc = useMemo(() => [
    ...myIncidents.map(i => ({ ...i, _src: "reporter" })),
    ...aiIncidents.map(i => ({ ...i, _src: "cctv" })),
  ], [myIncidents, aiIncidents]);

  const filtered = useMemo(() => {
    if (filterStatus === "all") return allInc;
    return allInc.filter(i => (i.status || "").toLowerCase() === filterStatus);
  }, [allInc, filterStatus]);

  const stats = useMemo(() => ({
    total:    allInc.length,
    pending:  allInc.filter(i => ["pending","Pending","pending_review"].includes(i.status)).length,
    assigned: allInc.filter(i => ["assigned","In Progress","in_progress"].includes(i.status)).length,
    resolved: allInc.filter(i => ["resolved","Resolved"].includes(i.status)).length,
    critical: allInc.filter(i => ["Critical Emergency","critical"].includes(i.severity || i.priority)).length,
    cctv:     aiIncidents.length,
  }), [allInc, aiIncidents]);

  /* ── status update ── */
  const updateStatus = async (inc, status) => {
    setUpdatingId(inc.id);
    try {
      if (inc._src === "cctv") {
        await axios.put(`${API_URL}/super-responder/incidents/${inc.id}/status`, { status });
      } else {
        await axios.put(`${API_URL}/incidents/${inc.id}`, { status });
      }
      setAiIncidents(prev => prev.map(i => i.id === inc.id ? { ...i, status } : i));
      setMyIncidents(prev => prev.map(i => i.id === inc.id ? { ...i, status } : i));
      if (selectedInc?.id === inc.id) setSelectedInc(prev => ({ ...prev, status }));
      showToast(`Status updated to ${status}`);
    } catch {
      showToast("Failed to update status", "error");
    } finally {
      setUpdatingId(null);
    }
  };

  /* ── KPI card ── */
  const KpiCard = ({ label, value, icon: Icon, accent, bg, border, badge }) => (
    <div className={`${bg} border ${border} rounded-xl p-4 flex flex-col gap-2 relative overflow-hidden`}>
      <div className={`absolute top-0 right-0 w-14 h-14 rounded-bl-full opacity-10 ${bg}`} />
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{label}</span>
        <div className={`p-1.5 rounded-lg ${bg} border ${border} ${accent}`}><Icon size={13} /></div>
      </div>
      <p className={`text-3xl font-black ${accent}`}>{loading ? "—" : value}</p>
      {badge && <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full w-fit ${bg} border ${border} ${accent}`}>{badge}</span>}
    </div>
  );

  return (
    <div className="flex h-screen bg-slate-950 text-white overflow-hidden">
      <ResponderSidebar activeTab="dashboard" setActiveTab={() => {}} user={user} />

      <div className="flex-1 flex flex-col overflow-hidden">

        {/* ── Toast ── */}
        {toast && (
          <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold shadow-xl ${toast.type === "error" ? "bg-red-600" : "bg-emerald-600"}`}>
            {toast.type === "error" ? <AlertTriangle size={15} /> : <CheckCircle size={15} />}
            {toast.msg}
          </div>
        )}

        {/* ── Incoming alert modal ── */}
        {assignAlert && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
            <div className="bg-slate-900 border-2 border-red-600/60 rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
              <div className="bg-red-900/40 border-b border-red-700/40 px-5 py-4 flex items-center gap-3">
                <div className="w-10 h-10 bg-red-500/20 rounded-full flex items-center justify-center flex-shrink-0 animate-pulse border border-red-500/40">
                  <BellRing size={20} className="text-red-400" />
                </div>
                <div className="flex-1">
                  <p className="text-white font-bold">🚨 Incident Assigned to You</p>
                  <p className="text-red-300 text-xs">Immediate response required</p>
                </div>
                <button onClick={() => setAssignAlert(null)} className="text-slate-500 hover:text-white"><X size={16} /></button>
              </div>
              <div className="p-5 space-y-3">
                <div className="bg-red-950/40 border border-red-800/40 rounded-xl p-3">
                  <p className="text-sm font-semibold text-white">{assignAlert.decision || "New Incident Detected"}</p>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {[
                    ["Severity",    assignAlert.severity || "Unknown"],
                    ["Category",    assignAlert.incidentCategory || "General"],
                    ["Location",    assignAlert.location || "Unknown"],
                    ["Assigned by", assignAlert.assignedBy || "system"],
                  ].map(([k, v]) => (
                    <div key={k} className="bg-slate-800/60 border border-slate-700/40 rounded-xl p-2.5">
                      <p className="text-slate-500 mb-0.5">{k}</p>
                      <p className="font-bold text-white truncate capitalize">{v}</p>
                    </div>
                  ))}
                </div>
                {assignAlert.assignedTypes?.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {assignAlert.assignedTypes.map(t => (
                      <span key={t} className="text-xs bg-blue-900/40 border border-blue-700/40 text-blue-300 font-semibold px-2.5 py-1 rounded-full">
                        {RESPONDER_EMOJI[t] || "🛡️"} {t}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="px-5 pb-5 flex gap-2">
                <button onClick={() => setAssignAlert(null)}
                  className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-colors">
                  <CheckCircle size={14} /> Acknowledge
                </button>
                <button onClick={() => setAssignAlert(null)}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 rounded-xl text-sm font-bold transition-colors">
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Header ── */}
        <header className="h-14 bg-slate-900 border-b border-slate-800 px-6 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
              <Shield size={15} className="text-blue-400" />
            </div>
            <div>
              <h1 className="text-sm font-bold leading-none">Responder Dashboard</h1>
              <p className="text-[10px] text-slate-500 mt-0.5">Field Operations · {lastUpdated.toLocaleTimeString()}</p>
            </div>
            {user?.responder_type && (
              <span className="hidden sm:inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-300">
                {RESPONDER_EMOJI[user.responder_type] || "🛡️"} {user.responder_type}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className={`flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1.5 rounded-lg border ${isConnected ? "bg-emerald-500/8 border-emerald-500/20 text-emerald-400" : "bg-slate-800 border-slate-700 text-slate-500"}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? "bg-emerald-400 animate-pulse" : "bg-slate-600"}`} />
              {isConnected ? "LIVE" : "OFFLINE"}
            </span>
            <button onClick={fetchAll} className="p-1.5 bg-slate-800 border border-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors">
              <RefreshCw size={13} />
            </button>
            <div className="flex items-center gap-2 pl-3 border-l border-slate-800">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-700 rounded-xl flex items-center justify-center font-bold text-xs">
                {(user?.fullName || user?.full_name || "R").charAt(0).toUpperCase()}
              </div>
              <div className="hidden sm:block text-right">
                <p className="text-xs font-semibold">{user?.fullName || user?.full_name || "Responder"}</p>
                <p className="text-[10px] text-blue-400">● Online</p>
              </div>
            </div>
          </div>
        </header>

        {/* ── Main ── */}
        <main className="flex-1 overflow-y-auto p-4 space-y-4">

          {/* KPI row */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <KpiCard label="Total"       value={stats.total}    icon={Target}        accent="text-slate-300"   bg="bg-slate-800/40"    border="border-white/5"          badge="ALL" />
            <KpiCard label="Pending"     value={stats.pending}  icon={Clock}         accent="text-yellow-400"  bg="bg-yellow-500/5"   border="border-yellow-500/15"    badge="QUEUE" />
            <KpiCard label="In Progress" value={stats.assigned} icon={Activity}      accent="text-blue-400"    bg="bg-blue-500/5"     border="border-blue-500/15"      badge="ACTIVE" />
            <KpiCard label="Resolved"    value={stats.resolved} icon={CheckCircle}   accent="text-emerald-400" bg="bg-emerald-500/5"  border="border-emerald-500/15"   badge="DONE" />
            <KpiCard label="Critical"    value={stats.critical} icon={Flame}         accent="text-red-400"     bg="bg-red-500/5"      border="border-red-500/20"       badge="URGENT" />
            <KpiCard label="AI / CCTV"   value={stats.cctv}    icon={Cpu}           accent="text-purple-400"  bg="bg-purple-500/5"   border="border-purple-500/15"    badge="AI" />
          </div>

          {/* Two-col: incident list + side panel */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">

            {/* Incident list — 2/3 width */}
            <div className="xl:col-span-2 bg-slate-900 border border-slate-800 rounded-xl overflow-hidden flex flex-col">
              {/* list header */}
              <div className="px-4 py-3 border-b border-slate-800 flex items-center gap-2 flex-shrink-0">
                <Shield size={13} className="text-blue-400" />
                <span className="text-xs font-bold text-slate-300">My Assigned Incidents</span>
                <span className="text-[10px] font-bold bg-blue-500/10 border border-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded-full ml-1">{allInc.length}</span>
                <div className="flex items-center gap-1 ml-auto">
                  {[["all","All"],["pending","Pending"],["assigned","Active"],["resolved","Resolved"]].map(([k,l]) => (
                    <button key={k} onClick={() => setFilterStatus(k)}
                      className={`px-2 py-0.5 text-[10px] font-bold rounded-lg transition-all ${filterStatus === k ? "bg-blue-700 text-white" : "text-slate-500 hover:text-slate-300"}`}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>

              {/* list body */}
              <div className="flex-1 overflow-y-auto divide-y divide-slate-800/60" style={{ maxHeight: 480 }}>
                {loading ? (
                  <div className="py-16 flex flex-col items-center justify-center text-slate-600">
                    <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-3" />
                    <p className="text-sm">Loading incidents…</p>
                  </div>
                ) : filtered.length === 0 ? (
                  <div className="py-16 flex flex-col items-center justify-center text-slate-600">
                    <Target size={32} className="mb-3 opacity-30" />
                    <p className="text-sm font-semibold text-slate-500">No incidents found</p>
                    <p className="text-xs text-slate-600 mt-1">You're all clear for this filter</p>
                  </div>
                ) : filtered.map(inc => {
                  const isAI = inc._src === "cctv";
                  const sevCls = SEV_CLS[inc.severity] || "bg-slate-700/50 border-slate-600/50 text-slate-400";
                  const isSelected = selectedInc?.id === inc.id && selectedInc?._src === inc._src;
                  return (
                    <div key={`${inc._src}-${inc.id}`}
                      onClick={() => setSelectedInc(isSelected ? null : inc)}
                      className={`px-4 py-3 cursor-pointer transition-all hover:bg-slate-800/40 ${isSelected ? "bg-slate-800/60 border-l-2 border-blue-500" : ""}`}>
                      <div className="flex items-start gap-3">
                        <div className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${inc.severity === "Critical Emergency" ? "bg-red-500 animate-pulse" : inc.severity === "Medium Risk" ? "bg-yellow-400" : "bg-emerald-400"}`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <p className="text-xs font-semibold text-white truncate">{inc.decision || inc.incident_category || inc.type || `Incident #${inc.id}`}</p>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              {isAI && <span className="text-[8px] font-bold px-1 py-0.5 rounded bg-purple-500/10 border border-purple-500/20 text-purple-400">🤖 AI</span>}
                              <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full border ${sevCls}`}>{(inc.severity || "Low Risk").replace(" Risk","").replace(" Emergency","")}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 text-[10px] text-slate-500">
                            {inc.location && <span className="flex items-center gap-1"><MapPin size={9} />{inc.location}</span>}
                            {inc.accident_confidence > 0 && <span className="flex items-center gap-1"><Cpu size={9} />{inc.accident_confidence}%</span>}
                            <span className="flex items-center gap-1 ml-auto"><Clock size={9} />{fmtTime(inc.created_at || inc.detected_at)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Side panel: incident detail OR quick actions */}
            <div className="flex flex-col gap-3">

              {/* Incident detail card */}
              {selectedInc ? (
                <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden flex flex-col">
                  <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-300">Incident #{selectedInc.id}</span>
                    <button onClick={() => setSelectedInc(null)} className="text-slate-600 hover:text-white"><X size={14} /></button>
                  </div>
                  <div className="p-4 space-y-3">
                    <p className="text-sm font-bold text-white leading-snug">{selectedInc.decision || selectedInc.incident_category || selectedInc.type || "Unknown"}</p>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        ["Severity",  selectedInc.severity || "—"],
                        ["Status",    (selectedInc.status || "pending").replace("_"," ")],
                        ["Location",  selectedInc.location || "—"],
                        ["AI Conf",   selectedInc.accident_confidence ? `${selectedInc.accident_confidence}%` : "—"],
                      ].map(([k,v]) => (
                        <div key={k} className="bg-slate-800/60 border border-slate-700/40 rounded-lg p-2">
                          <p className="text-[9px] text-slate-500 mb-0.5">{k}</p>
                          <p className="text-[10px] font-bold text-white capitalize truncate">{v}</p>
                        </div>
                      ))}
                    </div>
                    {parseTypes(selectedInc.assigned_to_types).length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {parseTypes(selectedInc.assigned_to_types).map(t => (
                          <span key={t} className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-blue-900/40 border border-blue-700/30 text-blue-300">
                            {RESPONDER_EMOJI[t]} {t}
                          </span>
                        ))}
                      </div>
                    )}
                    {selectedInc.notes && (
                      <p className="text-[10px] text-slate-400 bg-slate-800/40 rounded-lg p-2 border border-slate-700/30">{selectedInc.notes}</p>
                    )}
                    {/* Action buttons */}
                    <div className="grid grid-cols-1 gap-1.5 pt-1">
                      {!["resolved","Resolved"].includes(selectedInc.status) && (
                        <>
                          <button
                            onClick={() => updateStatus(selectedInc, selectedInc._src === "cctv" ? "in_progress" : "In Progress")}
                            disabled={updatingId === selectedInc.id}
                            className="w-full py-2 bg-blue-600/20 border border-blue-600/30 hover:bg-blue-600/30 text-blue-300 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1.5 transition-colors disabled:opacity-40">
                            <Activity size={11} /> Mark In Progress
                          </button>
                          <button
                            onClick={() => updateStatus(selectedInc, selectedInc._src === "cctv" ? "resolved" : "Resolved")}
                            disabled={updatingId === selectedInc.id}
                            className="w-full py-2 bg-emerald-600/20 border border-emerald-600/30 hover:bg-emerald-600/30 text-emerald-300 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1.5 transition-colors disabled:opacity-40">
                            <CheckCircle size={11} /> Mark Resolved
                          </button>
                        </>
                      )}
                      {(selectedInc.latitude || selectedInc.longitude) && (
                        <button
                          onClick={() => window.open(`https://maps.google.com?q=${selectedInc.latitude},${selectedInc.longitude}`, "_blank")}
                          className="w-full py-2 bg-slate-800 border border-slate-700 hover:bg-slate-700 text-slate-300 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1.5 transition-colors">
                          <Navigation size={11} /> Navigate
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                /* Quick actions */
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                  <p className="text-xs font-bold text-slate-400 mb-3 flex items-center gap-1.5"><Zap size={12} className="text-yellow-400" /> Quick Actions</p>
                  <div className="space-y-1.5">
                    {[
                      { label: "View All Incidents", icon: Eye,       href: "/responder/incidents", cls: "text-blue-300 bg-blue-500/8 border-blue-500/15 hover:bg-blue-500/15" },
                      { label: "Live CCTV Feeds",    icon: Video,     href: "/responder/cctv",      cls: "text-purple-300 bg-purple-500/8 border-purple-500/15 hover:bg-purple-500/15" },
                      { label: "Analytics",          icon: Activity,  href: "/responder/analytics", cls: "text-emerald-300 bg-emerald-500/8 border-emerald-500/15 hover:bg-emerald-500/15" },
                    ].map(({ label, icon: Icon, href, cls }) => (
                      <button key={label} onClick={() => window.location.href = href}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 border rounded-xl text-xs font-bold transition-all ${cls}`}>
                        <Icon size={13} /> {label} <ChevronRight size={12} className="ml-auto opacity-40" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Camera stats */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                <p className="text-xs font-bold text-slate-400 mb-3 flex items-center gap-1.5">
                  <Video size={12} className="text-cyan-400" /> Camera Overview
                </p>
                <div className="space-y-2">
                  {[
                    { label: "Total Cameras",  value: cameraStats.total,  icon: Video, cls: "text-slate-300" },
                    { label: "Active / Live",  value: cameraStats.active,  icon: cameraStats.active > 0 ? Wifi : WifiOff, cls: "text-emerald-400" },
                    { label: "Total Alerts",   value: cameraStats.alerts,  icon: AlertTriangle, cls: "text-red-400" },
                  ].map(({ label, value, icon: Icon, cls }) => (
                    <div key={label} className="flex items-center justify-between px-3 py-2 bg-slate-800/50 rounded-lg border border-slate-700/40">
                      <div className="flex items-center gap-2">
                        <Icon size={12} className={cls} />
                        <span className="text-[10px] text-slate-400">{label}</span>
                      </div>
                      <span className={`text-sm font-black ${cls}`}>{loading ? "—" : value}</span>
                    </div>
                  ))}
                </div>
                <button onClick={() => window.location.href = "/responder/cctv"}
                  className="mt-2 w-full py-1.5 text-[10px] font-bold text-cyan-400 bg-cyan-500/8 border border-cyan-500/15 rounded-lg hover:bg-cyan-500/15 transition-colors">
                  Open CCTV Dashboard →
                </button>
              </div>

              {/* Emergency contacts */}
              {emergencyContacts.length > 0 && (
                <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                  <div className="px-4 py-3 border-b border-slate-800 flex items-center gap-2">
                    <Phone size={12} className="text-emerald-400" />
                    <span className="text-xs font-bold text-slate-300">Emergency Contacts</span>
                  </div>
                  <div className="divide-y divide-slate-800/60">
                    {emergencyContacts.slice(0, 4).map(c => (
                      <div key={c.id} className="px-4 py-2.5 flex items-center gap-3 group hover:bg-slate-800/40 transition-colors">
                        <div className="w-7 h-7 rounded-full flex items-center justify-center text-sm flex-shrink-0" style={{ background: (c.color || "#E63939") + "20" }}>
                          {c.icon === "fire" ? "🔥" : c.icon === "shield" ? "🛡️" : "📞"}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] font-semibold text-white truncate">{c.name}</p>
                          <p className="text-[9px] text-slate-500 truncate">{c.description || ""}</p>
                        </div>
                        <a href={`tel:${c.number}`}
                          className="text-[9px] font-bold text-emerald-400 opacity-0 group-hover:opacity-100 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-lg flex items-center gap-1 transition-opacity">
                          <Phone size={9} /> {c.number}
                        </a>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Live incident map */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-800 flex items-center gap-2">
              <MapPin size={13} className="text-blue-400" />
              <span className="text-xs font-bold text-slate-300">Incident Map</span>
              <span className="text-[10px] font-bold bg-blue-500/10 border border-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded-full ml-1">LIVE</span>
              <span className="text-[10px] text-slate-500 ml-auto">{allInc.length} active</span>
            </div>
            <div className="h-72">
              <MapView incidents={allInc} />
            </div>
          </div>

        </main>
      </div>
    </div>
  );
}
