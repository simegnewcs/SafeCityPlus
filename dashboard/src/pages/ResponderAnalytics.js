// src/pages/ResponderAnalytics.js
import React, { useState, useEffect, useMemo } from "react";
import ResponderSidebar from "../layout/ResponderSidebar";
import {
  TrendingUp, AlertTriangle, Clock, Activity, RefreshCw,
  BarChart3, CheckCircle, Cpu, MapPin, Video, Users,
  Zap, Shield, TrendingDown, Calendar
} from "lucide-react";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  AreaChart, Area, RadarChart, Radar, PolarGrid,
  PolarAngleAxis, PolarRadiusAxis
} from "recharts";
import axios from "axios";

const API_URL = "http://localhost:5000/api";

const CHART_COLORS = ["#ef4444","#f97316","#eab308","#22c55e","#3b82f6","#8b5cf6","#ec4899","#14b8a6"];
const SEVERITY_COLOR = { "Critical Emergency": "#ef4444", "High Risk": "#f97316", "Medium Risk": "#eab308", "Low Risk": "#22c55e" };

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 shadow-xl text-xs">
      {label && <p className="text-slate-400 mb-1">{label}</p>}
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color || p.fill }} className="font-bold">{p.name}: {p.value}</p>
      ))}
    </div>
  );
};

const ResponderAnalytics = () => {
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const [incidents, setIncidents] = useState([]);
  const [recordings, setRecordings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [timeRange, setTimeRange] = useState("week");
  const [activeSection, setActiveSection] = useState("overview");

  const fetchAll = async () => {
    try {
      setLoading(true);
      const [incRes, recRes] = await Promise.all([
        axios.get(`${API_URL}/super-responder/incidents?limit=500`),
        axios.get(`${API_URL}/super-responder/recordings`),
      ]);
      setIncidents(Array.isArray(incRes.data) ? incRes.data : []);
      setRecordings(Array.isArray(recRes.data) ? recRes.data : []);
      setLastUpdated(new Date());
    } catch (e) {
      console.error("Analytics fetch error:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
    const iv = setInterval(fetchAll, 60000);
    return () => clearInterval(iv);
  }, []);

  // ── Filter by time range ──
  const filtered = useMemo(() => {
    const now = new Date();
    const days = timeRange === "week" ? 7 : timeRange === "month" ? 30 : 365;
    const cutoff = new Date(now - days * 86400000);
    return incidents.filter(i => !i.created_at || new Date(i.created_at) >= cutoff);
  }, [incidents, timeRange]);

  // ── KPI stats ──
  const stats = useMemo(() => {
    const total = filtered.length;
    const assigned = filtered.filter(i => i.status === "assigned").length;
    const pending = filtered.filter(i => i.status === "pending" || i.status === "pending_review").length;
    const resolved = filtered.filter(i => i.status === "resolved").length;
    const inProgress = filtered.filter(i => i.status === "in_progress").length;
    const aiAssigned = filtered.filter(i => i.assigned_by === "ai" || i.assigned_by === "auto").length;
    const manualAssigned = filtered.filter(i => i.assigned_by === "manual").length;
    const critical = filtered.filter(i => i.severity === "Critical Emergency").length;
    const avgConf = filtered.length
      ? Math.round(filtered.reduce((s, i) => s + (i.accident_confidence || i.ai_confidence || 0), 0) / filtered.length)
      : 0;
    const autoRate = total > 0 ? Math.round((aiAssigned / total) * 100) : 0;
    const resolveRate = total > 0 ? Math.round(((resolved + inProgress) / total) * 100) : 0;
    return { total, assigned, pending, resolved, inProgress, aiAssigned, manualAssigned, critical, avgConf, autoRate, resolveRate };
  }, [filtered]);

  // ── Severity pie ──
  const severityData = useMemo(() => {
    const map = {};
    filtered.forEach(i => { const s = i.severity || "Unknown"; map[s] = (map[s] || 0) + 1; });
    return Object.entries(map).map(([name, value]) => ({ name, value, fill: SEVERITY_COLOR[name] || "#64748b" }));
  }, [filtered]);

  // ── Status pie ──
  const statusData = useMemo(() => [
    { name: "Assigned", value: stats.assigned, fill: "#22c55e" },
    { name: "Pending", value: stats.pending, fill: "#eab308" },
    { name: "In Progress", value: stats.inProgress, fill: "#3b82f6" },
    { name: "Resolved", value: stats.resolved, fill: "#8b5cf6" },
  ].filter(d => d.value > 0), [stats]);

  // ── AI vs Manual assignment ──
  const assignmentData = useMemo(() => [
    { name: "AI Auto", value: stats.aiAssigned, fill: "#8b5cf6" },
    { name: "Manual", value: stats.manualAssigned, fill: "#3b82f6" },
  ], [stats]);

  // ── Incident category bar ──
  const categoryData = useMemo(() => {
    const map = {};
    filtered.forEach(i => { const c = i.incident_category || "Unknown"; map[c] = (map[c] || 0) + 1; });
    return Object.entries(map)
      .map(([name, value]) => ({ name: name.length > 18 ? name.slice(0, 16) + "…" : name, value }))
      .sort((a, b) => b.value - a.value).slice(0, 8);
  }, [filtered]);

  // ── Responder types bar ──
  const responderData = useMemo(() => {
    const map = {};
    filtered.forEach(i => {
      let types = [];
      try { types = typeof i.assigned_to_types === "string" ? JSON.parse(i.assigned_to_types) : (i.assigned_to_types || []); } catch {}
      types.forEach(t => { map[t] = (map[t] || 0) + 1; });
    });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [filtered]);

  // ── AI confidence histogram ──
  const confidenceBuckets = useMemo(() => {
    const buckets = [{r:"0-20",v:0},{r:"20-40",v:0},{r:"40-60",v:0},{r:"60-70",v:0},{r:"70-80",v:0},{r:"80-90",v:0},{r:"90-100",v:0}];
    filtered.forEach(i => {
      const c = i.accident_confidence || i.ai_confidence || 0;
      if (c < 20) buckets[0].v++;
      else if (c < 40) buckets[1].v++;
      else if (c < 60) buckets[2].v++;
      else if (c < 70) buckets[3].v++;
      else if (c < 80) buckets[4].v++;
      else if (c < 90) buckets[5].v++;
      else buckets[6].v++;
    });
    return buckets.map(b => ({ name: b.r, value: b.v, fill: b.r.startsWith("7") || b.r.startsWith("8") || b.r.startsWith("9") ? "#8b5cf6" : "#334155" }));
  }, [filtered]);

  // ── Daily trend ──
  const trendData = useMemo(() => {
    const days = timeRange === "week" ? 7 : timeRange === "month" ? 30 : 90;
    const result = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const key = d.toISOString().split("T")[0];
      const label = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      const dayInc = filtered.filter(inc => inc.created_at?.startsWith(key));
      result.push({
        date: label,
        total: dayInc.length,
        ai: dayInc.filter(x => x.assigned_by === "ai" || x.assigned_by === "auto").length,
        critical: dayInc.filter(x => x.severity === "Critical Emergency").length,
      });
    }
    return result;
  }, [filtered, timeRange]);

  // ── Top locations ──
  const locationData = useMemo(() => {
    const map = {};
    filtered.forEach(i => { const l = i.location || "Unknown"; map[l] = (map[l] || 0) + 1; });
    return Object.entries(map)
      .map(([name, value]) => ({ name: name.length > 22 ? name.slice(0, 20) + "…" : name, value }))
      .sort((a, b) => b.value - a.value).slice(0, 6);
  }, [filtered]);

  // ── Radar: response profile ──
  const radarData = useMemo(() => [
    { subject: "AI Rate", value: stats.autoRate },
    { subject: "Resolve Rate", value: stats.resolveRate },
    { subject: "Avg Confidence", value: stats.avgConf },
    { subject: "Critical %", value: stats.total > 0 ? Math.round((stats.critical / stats.total) * 100) : 0 },
    { subject: "Coverage", value: Math.min(100, recordings.length * 5) },
  ], [stats, recordings]);

  if (loading) return (
    <div className="flex h-screen bg-slate-950 text-white">
      <ResponderSidebar user={user} />
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-slate-400 text-sm">Loading analytics…</p>
        </div>
      </div>
    </div>
  );

  const KpiCard = ({ label, value, sub, icon: Icon, color, trend }) => (
    <div className={`bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col gap-2 relative overflow-hidden`}>
      <div className={`absolute top-0 right-0 w-16 h-16 rounded-bl-full opacity-10 ${color}`} />
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{label}</span>
        <div className={`p-1.5 rounded-lg ${color} bg-opacity-20`}><Icon size={13} className="opacity-80" /></div>
      </div>
      <p className="text-3xl font-black text-white">{value}</p>
      {sub && <p className="text-[10px] text-slate-500">{sub}</p>}
      {trend !== undefined && (
        <div className={`flex items-center gap-1 text-[10px] font-semibold ${trend >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
          {trend >= 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />} {Math.abs(trend)}% vs prev period
        </div>
      )}
    </div>
  );

  return (
    <div className="flex h-screen bg-slate-950 text-white overflow-hidden">
      <ResponderSidebar user={user} />
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Header */}
        <header className="h-14 bg-slate-900 border-b border-slate-800 px-6 flex items-center gap-3 flex-shrink-0">
          <BarChart3 size={16} className="text-purple-400" />
          <div>
            <h1 className="text-sm font-bold">Analytics</h1>
            <p className="text-[10px] text-slate-500">{filtered.length} incidents · {timeRange} view · updated {lastUpdated.toLocaleTimeString()}</p>
          </div>
          <div className="flex items-center gap-2 ml-auto">
            {/* Time range */}
            <div className="flex items-center gap-1 bg-slate-800 border border-slate-700 rounded-lg p-0.5">
              {["week","month","year"].map(r => (
                <button key={r} onClick={() => setTimeRange(r)}
                  className={`px-3 py-1 text-[10px] font-bold rounded-md capitalize transition-all ${
                    timeRange === r ? "bg-purple-700 text-white" : "text-slate-400 hover:text-white"
                  }`}>{r}</button>
              ))}
            </div>
            <button onClick={fetchAll} className="p-1.5 bg-slate-800 border border-slate-700 rounded-lg hover:text-white text-slate-500 transition-colors">
              <RefreshCw size={13} />
            </button>
          </div>
        </header>

        {/* Section nav */}
        <div className="flex items-center gap-1 px-6 pt-4 pb-0 flex-shrink-0">
          {[["overview","Overview",BarChart3],["trends","Trends",TrendingUp],["ai","AI Insights",Cpu],["responders","Responders",Users]].map(([id, label, Icon]) => (
            <button key={id} onClick={() => setActiveSection(id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold rounded-xl border transition-all ${
                activeSection === id
                  ? "bg-purple-700/30 border-purple-600/50 text-purple-300"
                  : "bg-transparent border-transparent text-slate-500 hover:text-slate-300"
              }`}>
              <Icon size={12} />{label}
            </button>
          ))}
        </div>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto p-4 space-y-4">

          {/* ── KPI row ── */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <KpiCard label="Total" value={stats.total} sub={`All time in range`} icon={BarChart3} color="bg-slate-500" />
            <KpiCard label="Critical" value={stats.critical} sub={`Highest severity`} icon={AlertTriangle} color="bg-red-500" />
            <KpiCard label="AI Auto" value={stats.aiAssigned} sub={`${stats.autoRate}% auto-assign rate`} icon={Cpu} color="bg-purple-500" />
            <KpiCard label="Pending" value={stats.pending} sub={`Awaiting assignment`} icon={Clock} color="bg-yellow-500" />
            <KpiCard label="Resolved" value={stats.resolved} sub={`${stats.resolveRate}% resolution rate`} icon={CheckCircle} color="bg-emerald-500" />
            <KpiCard label="Avg AI Conf" value={`${stats.avgConf}%`} sub={`Detection confidence`} icon={Zap} color="bg-blue-500" />
          </div>

          {/* ── OVERVIEW ── */}
          {activeSection === "overview" && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">

              {/* Severity Distribution */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                <p className="text-xs font-bold text-slate-300 mb-3 flex items-center gap-2"><Shield size={13} className="text-red-400" /> Severity Distribution</p>
                <div className="h-52">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={severityData} cx="50%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={4} dataKey="value">
                        {severityData.map((e, i) => <Cell key={i} fill={e.fill} />)}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                      <Legend wrapperStyle={{ fontSize: 10, color: "#94a3b8" }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Status Breakdown */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                <p className="text-xs font-bold text-slate-300 mb-3 flex items-center gap-2"><Activity size={13} className="text-blue-400" /> Status Breakdown</p>
                <div className="h-52">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={statusData} cx="50%" cy="50%" outerRadius={75} paddingAngle={4} dataKey="value">
                        {statusData.map((e, i) => <Cell key={i} fill={e.fill} />)}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                      <Legend wrapperStyle={{ fontSize: 10, color: "#94a3b8" }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Response Profile Radar */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                <p className="text-xs font-bold text-slate-300 mb-3 flex items-center gap-2"><Zap size={13} className="text-purple-400" /> Response Profile</p>
                <div className="h-52">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart data={radarData} cx="50%" cy="50%" outerRadius={65}>
                      <PolarGrid stroke="#334155" />
                      <PolarAngleAxis dataKey="subject" tick={{ fill: "#94a3b8", fontSize: 9 }} />
                      <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fill: "#64748b", fontSize: 8 }} />
                      <Radar name="Score" dataKey="value" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.25} />
                      <Tooltip content={<CustomTooltip />} />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Top Incident Categories */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 md:col-span-2">
                <p className="text-xs font-bold text-slate-300 mb-3 flex items-center gap-2"><AlertTriangle size={13} className="text-orange-400" /> Incident Categories</p>
                <div className="h-52">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={categoryData} layout="vertical" margin={{ left: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
                      <XAxis type="number" stroke="#475569" tick={{ fontSize: 9, fill: "#64748b" }} />
                      <YAxis dataKey="name" type="category" width={110} tick={{ fontSize: 9, fill: "#94a3b8" }} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="value" radius={[0,4,4,0]}>
                        {categoryData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Top Locations */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                <p className="text-xs font-bold text-slate-300 mb-3 flex items-center gap-2"><MapPin size={13} className="text-emerald-400" /> Top Locations</p>
                <div className="space-y-2">
                  {locationData.map((l, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-[10px] text-slate-400 w-4 flex-shrink-0">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between mb-0.5">
                          <span className="text-[10px] text-slate-300 truncate">{l.name}</span>
                          <span className="text-[10px] text-slate-500 flex-shrink-0 ml-2">{l.value}</span>
                        </div>
                        <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden">
                          <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${Math.round((l.value / (locationData[0]?.value || 1)) * 100)}%` }} />
                        </div>
                      </div>
                    </div>
                  ))}
                  {locationData.length === 0 && <p className="text-[10px] text-slate-600 text-center py-4">No location data</p>}
                </div>
              </div>

            </div>
          )}

          {/* ── TRENDS ── */}
          {activeSection === "trends" && (
            <div className="grid grid-cols-1 gap-4">

              {/* Daily trend area */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                <p className="text-xs font-bold text-slate-300 mb-3 flex items-center gap-2"><TrendingUp size={13} className="text-blue-400" /> Daily Incident Volume</p>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={trendData} margin={{ left: -10 }}>
                      <defs>
                        <linearGradient id="totalGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="aiGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.4} />
                          <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis dataKey="date" stroke="#475569" tick={{ fontSize: 9, fill: "#64748b" }} />
                      <YAxis stroke="#475569" tick={{ fontSize: 9, fill: "#64748b" }} />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend wrapperStyle={{ fontSize: 10, color: "#94a3b8" }} />
                      <Area type="monotone" dataKey="total" name="Total" stroke="#3b82f6" fill="url(#totalGrad)" strokeWidth={2} />
                      <Area type="monotone" dataKey="ai" name="AI Auto" stroke="#8b5cf6" fill="url(#aiGrad)" strokeWidth={2} />
                      <Area type="monotone" dataKey="critical" name="Critical" stroke="#ef4444" fill="none" strokeWidth={1.5} strokeDasharray="4 2" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Recordings trend */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                  <p className="text-xs font-bold text-slate-300 mb-3 flex items-center gap-2"><Video size={13} className="text-purple-400" /> Recordings Saved</p>
                  <div className="flex items-center justify-center h-32">
                    <div className="text-center">
                      <p className="text-5xl font-black text-purple-400">{recordings.length}</p>
                      <p className="text-[10px] text-slate-500 mt-1">total stream recordings</p>
                    </div>
                  </div>
                </div>
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                  <p className="text-xs font-bold text-slate-300 mb-3 flex items-center gap-2"><Calendar size={13} className="text-blue-400" /> Incidents This Period</p>
                  <div className="flex items-end gap-1 h-32 items-end">
                    {trendData.slice(-14).map((d, i) => (
                      <div key={i} className="flex-1 flex flex-col items-center justify-end gap-0.5">
                        <div className="w-full bg-blue-600 rounded-sm transition-all" style={{ height: `${Math.max(2, (d.total / (Math.max(...trendData.map(x => x.total)) || 1)) * 80)}px` }} />
                      </div>
                    ))}
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* ── AI INSIGHTS ── */}
          {activeSection === "ai" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

              {/* AI vs Manual */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                <p className="text-xs font-bold text-slate-300 mb-3 flex items-center gap-2"><Cpu size={13} className="text-purple-400" /> Assignment Method</p>
                <div className="h-52">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={assignmentData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={6} dataKey="value">
                        {assignmentData.map((e, i) => <Cell key={i} fill={e.fill} />)}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                      <Legend wrapperStyle={{ fontSize: 10, color: "#94a3b8" }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <div className="bg-slate-800 rounded-lg p-2 text-center">
                    <p className="text-xl font-black text-purple-400">{stats.autoRate}%</p>
                    <p className="text-[9px] text-slate-500">AI Auto-Assign Rate</p>
                  </div>
                  <div className="bg-slate-800 rounded-lg p-2 text-center">
                    <p className="text-xl font-black text-blue-400">{stats.avgConf}%</p>
                    <p className="text-[9px] text-slate-500">Avg Detection Conf.</p>
                  </div>
                </div>
              </div>

              {/* Confidence histogram */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                <p className="text-xs font-bold text-slate-300 mb-1 flex items-center gap-2"><Zap size={13} className="text-yellow-400" /> AI Confidence Distribution</p>
                <p className="text-[9px] text-slate-600 mb-3">Purple bars = ≥70% (auto-assign threshold)</p>
                <div className="h-52">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={confidenceBuckets} margin={{ left: -10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                      <XAxis dataKey="name" stroke="#475569" tick={{ fontSize: 9, fill: "#64748b" }} />
                      <YAxis stroke="#475569" tick={{ fontSize: 9, fill: "#64748b" }} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="value" name="Incidents" radius={[4,4,0,0]}>
                        {confidenceBuckets.map((e, i) => <Cell key={i} fill={e.fill} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* AI incidents list */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 md:col-span-2">
                <p className="text-xs font-bold text-slate-300 mb-3 flex items-center gap-2"><Cpu size={13} className="text-purple-400" /> Recent AI Auto-Assigned Incidents</p>
                <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                  {filtered.filter(i => i.assigned_by === "ai" || i.assigned_by === "auto").slice(0, 20).map(inc => (
                    <div key={inc.id} className="flex items-center gap-3 px-3 py-2 bg-slate-800/60 rounded-lg border border-slate-700/40">
                      <span className="text-[9px] font-bold text-purple-400 w-8">#{inc.id}</span>
                      <span className="flex-1 text-[10px] text-slate-300 truncate">{inc.decision || inc.incident_category || "Unknown"}</span>
                      <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full ${
                        inc.severity === "Critical Emergency" ? "bg-red-900/60 text-red-300" :
                        inc.severity === "Medium Risk" ? "bg-yellow-900/60 text-yellow-300" : "bg-emerald-900/60 text-emerald-300"
                      }`}>{inc.severity || "?"}</span>
                      <span className="text-[9px] text-purple-400 flex-shrink-0">{inc.accident_confidence || inc.ai_confidence || 0}%</span>
                      <span className="text-[8px] text-slate-600 flex-shrink-0">{inc.created_at ? new Date(inc.created_at).toLocaleDateString() : ""}</span>
                    </div>
                  ))}
                  {filtered.filter(i => i.assigned_by === "ai" || i.assigned_by === "auto").length === 0 && (
                    <p className="text-[10px] text-slate-600 text-center py-6">No AI auto-assigned incidents in this period</p>
                  )}
                </div>
              </div>

            </div>
          )}

          {/* ── RESPONDERS ── */}
          {activeSection === "responders" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                <p className="text-xs font-bold text-slate-300 mb-3 flex items-center gap-2"><Users size={13} className="text-emerald-400" /> Dispatch by Responder Type</p>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={responderData} layout="vertical" margin={{ left: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
                      <XAxis type="number" stroke="#475569" tick={{ fontSize: 9, fill: "#64748b" }} />
                      <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 9, fill: "#94a3b8" }} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="value" name="Dispatches" radius={[0,4,4,0]}>
                        {responderData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                <p className="text-xs font-bold text-slate-300 mb-3 flex items-center gap-2"><CheckCircle size={13} className="text-emerald-400" /> Responder Summary</p>
                <div className="space-y-2">
                  {responderData.map((r, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                      <span className="text-[11px] text-slate-300 flex-1">{r.name}</span>
                      <span className="text-[11px] font-bold text-white">{r.value}</span>
                      <div className="w-24 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${Math.round((r.value / (responderData[0]?.value || 1)) * 100)}%`, background: CHART_COLORS[i % CHART_COLORS.length] }} />
                      </div>
                    </div>
                  ))}
                  {responderData.length === 0 && <p className="text-[10px] text-slate-600 text-center py-6">No dispatch data in this period</p>}
                </div>
              </div>

              {/* Status by responder type */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 md:col-span-2">
                <p className="text-xs font-bold text-slate-300 mb-3 flex items-center gap-2"><Activity size={13} className="text-blue-400" /> All Incidents — Quick Table</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-[10px]">
                    <thead>
                      <tr className="border-b border-slate-800">
                        {["#","Decision","Severity","Status","Assigned By","Confidence","Date"].map(h => (
                          <th key={h} className="text-left text-slate-500 font-semibold pb-2 pr-3">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.slice(0, 30).map(inc => (
                        <tr key={inc.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                          <td className="py-1.5 pr-3 text-slate-500">#{inc.id}</td>
                          <td className="py-1.5 pr-3 text-slate-300 max-w-[180px] truncate">{inc.decision || inc.incident_category || "—"}</td>
                          <td className="py-1.5 pr-3">
                            <span className={`px-1.5 py-0.5 rounded-full font-bold ${
                              inc.severity === "Critical Emergency" ? "bg-red-900/60 text-red-300" :
                              inc.severity === "Medium Risk" ? "bg-yellow-900/60 text-yellow-300" :
                              "bg-emerald-900/60 text-emerald-300"
                            }`}>{(inc.severity || "?").replace(" Risk","").replace(" Emergency","")}</span>
                          </td>
                          <td className="py-1.5 pr-3">
                            <span className={`px-1.5 py-0.5 rounded-full font-bold ${
                              inc.status === "assigned" ? "bg-emerald-900/60 text-emerald-300" :
                              inc.status === "resolved" ? "bg-blue-900/60 text-blue-300" :
                              "bg-yellow-900/60 text-yellow-300"
                            }`}>{(inc.status || "?").replace("_"," ")}</span>
                          </td>
                          <td className="py-1.5 pr-3">
                            <span className={inc.assigned_by === "ai" || inc.assigned_by === "auto" ? "text-purple-400" : "text-blue-400"}>
                              {inc.assigned_by === "ai" || inc.assigned_by === "auto" ? "🤖 AI" : "👤 Manual"}
                            </span>
                          </td>
                          <td className="py-1.5 pr-3 text-slate-400">{inc.accident_confidence || inc.ai_confidence || 0}%</td>
                          <td className="py-1.5 text-slate-600">{inc.created_at ? new Date(inc.created_at).toLocaleDateString() : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {filtered.length > 30 && <p className="text-[9px] text-slate-600 mt-2 text-center">Showing 30 of {filtered.length}</p>}
                </div>
              </div>

            </div>
          )}

        </main>
      </div>
    </div>
  );
};

export default ResponderAnalytics;
