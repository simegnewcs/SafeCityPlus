import React, { useState, useEffect } from "react";
import SuperResponderSidebar from "../layout/SuperResponderSidebar";
import { AlertTriangle, MapPin, Cpu, Clock, CheckCircle, ChevronDown } from "lucide-react";
import axios from "axios";

const API_URL = "http://localhost:5000/api";

const SEVERITY_STYLES = {
  "Critical Emergency": "bg-red-500/20 border-red-500/50 text-red-300",
  "Medium Risk":        "bg-yellow-500/20 border-yellow-500/40 text-yellow-300",
  "Low Risk":           "bg-emerald-500/20 border-emerald-500/40 text-emerald-300",
};

const RESPONDER_TYPES = [
  { value: "Traffic Police",          emoji: "🚔" },
  { value: "Ambulance / Medical",     emoji: "🚑" },
  { value: "Fire Brigade",            emoji: "🔥" },
  { value: "Road Safety",             emoji: "🛣️" },
  { value: "Construction Safety",     emoji: "🏗️" },
  { value: "Disaster Management",     emoji: "🌊" },
  { value: "Armed Police",            emoji: "🔫" },
  { value: "Municipal Emergency",     emoji: "🏙️" },
  { value: "Technical Investigation", emoji: "🔍" },
];

const parseTypes = (raw) => {
  if (Array.isArray(raw)) return raw;
  try { return JSON.parse(raw || "[]"); } catch { return []; }
};

export default function SuperResponderIncidents() {
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);
  const [filter, setFilter] = useState("all");
  const [resolving, setResolving] = useState(null);

  useEffect(() => { fetchIncidents(); }, []);

  const fetchIncidents = async () => {
    try {
      const res = await axios.get(`${API_URL}/super-responder/incidents?limit=200`);
      setIncidents(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error(err.message);
    } finally { setLoading(false); }
  };

  const resolve = async (id) => {
    setResolving(id);
    try {
      await axios.put(`${API_URL}/super-responder/incidents/${id}/status`, { status: "resolved" });
      setIncidents(prev => prev.map(i => i.id === id ? { ...i, status: "resolved" } : i));
    } catch {} finally { setResolving(null); }
  };

  const filtered = filter === "all" ? incidents : incidents.filter(i => i.status === filter);
  const formatTime = (ts) => ts ? new Date(ts).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

  if (loading) return (
    <div className="flex h-screen bg-slate-950">
      <SuperResponderSidebar user={user} />
      <div className="flex-1 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-red-500 border-t-transparent rounded-full animate-spin" />
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-slate-950 text-white overflow-hidden">
      <SuperResponderSidebar user={user} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-14 bg-slate-900 border-b border-slate-800 px-6 flex items-center gap-3 flex-shrink-0">
          <AlertTriangle size={16} className="text-red-400" />
          <div>
            <h1 className="text-sm font-bold">Incident Queue</h1>
            <p className="text-[10px] text-slate-500">All AI-detected incidents · {incidents.length} total</p>
          </div>
          <div className="flex items-center gap-2 ml-auto">
            {["all", "pending", "assigned", "resolved"].map(s => (
              <button key={s} onClick={() => setFilter(s)}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg capitalize border transition-all ${filter === s ? 'bg-red-900/40 border-red-700/50 text-red-300' : 'bg-slate-800 border-slate-700 text-slate-500 hover:text-slate-300'}`}>
                {s}
              </button>
            ))}
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-600">
              <AlertTriangle size={40} className="mb-3 opacity-30" />
              <p className="text-sm">No incidents</p>
            </div>
          ) : filtered.map((inc) => {
            const types = parseTypes(inc.assigned_to_types);
            const isOpen = expanded === inc.id;
            return (
              <div key={inc.id} className={`bg-slate-900 rounded-xl border transition-all ${inc.severity === "Critical Emergency" ? "border-red-800/50" : "border-slate-800"}`}>
                <div className="p-4 flex items-start gap-3 cursor-pointer" onClick={() => setExpanded(isOpen ? null : inc.id)}>
                  <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${inc.severity === "Critical Emergency" ? "bg-red-500 animate-pulse" : inc.severity === "Medium Risk" ? "bg-yellow-400" : "bg-emerald-400"}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <p className="text-sm font-semibold text-white line-clamp-1">{inc.decision}</p>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${inc.status === "resolved" ? "bg-emerald-900/40 text-emerald-400" : inc.status === "assigned" ? "bg-blue-900/40 text-blue-400" : "bg-yellow-900/40 text-yellow-400"}`}>
                          {inc.status?.toUpperCase()}
                        </span>
                        <ChevronDown size={14} className={`text-slate-600 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                      </div>
                    </div>
                    <div className="flex items-center gap-3 text-[10px] text-slate-500">
                      <span className={`font-bold px-1.5 py-0.5 rounded-full border ${SEVERITY_STYLES[inc.severity] || SEVERITY_STYLES["Low Risk"]}`}>{inc.severity}</span>
                      <span className="flex items-center gap-1"><MapPin size={9} />{inc.location}</span>
                      <span className="flex items-center gap-1"><Cpu size={9} />{inc.accident_confidence}%</span>
                      <span className="flex items-center gap-1"><Clock size={9} />{formatTime(inc.created_at)}</span>
                    </div>
                    {types.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {types.map(t => {
                          const meta = RESPONDER_TYPES.find(r => r.value === t);
                          return <span key={t} className="text-[9px] bg-slate-800 border border-slate-700 text-slate-300 px-2 py-0.5 rounded-full">{meta?.emoji} {t}</span>;
                        })}
                        {inc.assigned_by === "ai" && <span className="text-[9px] bg-purple-900/30 border border-purple-800/40 text-purple-400 px-2 py-0.5 rounded-full">🤖 AI Assigned</span>}
                      </div>
                    )}
                  </div>
                </div>

                {isOpen && (
                  <div className="border-t border-slate-800 px-4 pb-4 pt-3 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-slate-800 rounded-lg p-3 border border-slate-700">
                        <p className="text-[9px] text-slate-500 mb-1">Camera</p>
                        <p className="text-xs font-semibold">{inc.camera_name || "—"}</p>
                      </div>
                      <div className="bg-slate-800 rounded-lg p-3 border border-slate-700">
                        <p className="text-[9px] text-slate-500 mb-1">Category</p>
                        <p className="text-xs font-semibold">{inc.incident_category || "—"}</p>
                      </div>
                    </div>
                    {inc.response_action && (
                      <div className="bg-slate-800 rounded-lg p-3 border border-slate-700">
                        <p className="text-[9px] text-slate-500 mb-1">Suggested Action</p>
                        <p className="text-xs text-white">{inc.response_action}</p>
                      </div>
                    )}
                    {inc.notes && (
                      <div className="bg-slate-800 rounded-lg p-3 border border-slate-700">
                        <p className="text-[9px] text-slate-500 mb-1">Notes</p>
                        <p className="text-xs text-white">{inc.notes}</p>
                      </div>
                    )}
                    {inc.status !== "resolved" && (
                      <div className="flex gap-2">
                        <button onClick={() => resolve(inc.id)} disabled={resolving === inc.id}
                          className="flex items-center gap-1.5 px-3 py-2 bg-emerald-900/40 border border-emerald-800/50 text-emerald-300 rounded-lg text-xs font-bold hover:bg-emerald-900/60 transition-colors">
                          <CheckCircle size={12} />
                          {resolving === inc.id ? "Resolving..." : "Mark Resolved"}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
