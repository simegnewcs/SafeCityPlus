// src/pages/AdminDashboard.js
import React, { useState, useEffect, useMemo } from "react";
import AdminSidebar from "../layout/AdminSidebar";
import MapView from "../components/MapView";
import {
  Menu, X, Bell, RefreshCw, Download,
  AlertTriangle, TrendingUp, Clock, CheckCircle,
  Activity, Shield, Zap, BarChart2
} from "lucide-react";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend,
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  LineChart, Line, defs, linearGradient, stop
} from "recharts";
import axios from "axios";

const API_URL = "http://localhost:5000/api";

/* ── Gradient-icon Stat Card ── */
const StatCard = ({ title, value, icon, gradient, change, sub }) => (
  <div className="relative bg-white rounded-2xl p-5 shadow-sm border border-slate-100 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 overflow-hidden group">
    <div className={`absolute top-0 right-0 w-24 h-24 rounded-full opacity-[0.07] -translate-y-6 translate-x-6 ${gradient}`} />
    <div className="flex items-start justify-between mb-4">
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-white shadow-md ${gradient}`}>
        {icon}
      </div>
      {change !== undefined && (
        <span className={`text-xs font-semibold px-2 py-1 rounded-full ${change >= 0 ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"}`}>
          {change >= 0 ? "+" : ""}{change}%
        </span>
      )}
    </div>
    <p className="text-3xl font-bold text-slate-900 tracking-tight mb-1">{value}</p>
    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{title}</p>
    {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
  </div>
);

/* ── Custom Tooltip ── */
const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-100 rounded-xl px-4 py-3 shadow-xl text-sm">
      <p className="font-semibold text-slate-700 mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }} className="font-medium">{p.name}: {p.value}</p>
      ))}
    </div>
  );
};

const AdminDashboard = () => {
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [now, setNow] = useState(new Date());
  const user = JSON.parse(localStorage.getItem("user") || "{}");

  useEffect(() => {
    const tick = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(tick);
  }, []);

  const fetchIncidents = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/incidents`);
      setIncidents(response.data);
      setLastUpdated(new Date());
    } catch (error) {
      console.error("Error fetching incidents:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIncidents();
    const interval = setInterval(fetchIncidents, 30000);
    return () => clearInterval(interval);
  }, []);

  const stats = useMemo(() => {
    const total = incidents.length;
    const high = incidents.filter((i) => i.priority === "High" || i.priority === "Critical").length;
    const medium = incidents.filter((i) => i.priority === "Medium").length;
    const low = incidents.filter((i) => i.priority === "Low" || i.priority === "Normal").length;
    const pending = incidents.filter((i) => i.status === "Pending").length;
    const resolved = incidents.filter((i) => i.status === "Resolved").length;
    const inProgress = incidents.filter((i) => i.status === "In Progress").length;
    const resolutionRate = total > 0 ? Math.round((resolved / total) * 100) : 0;
    return { total, high, medium, low, pending, resolved, inProgress, resolutionRate };
  }, [incidents]);

  const priorityData = useMemo(() => [
    { name: "Critical / High", value: stats.high, fill: "#ef4444" },
    { name: "Medium", value: stats.medium, fill: "#f59e0b" },
    { name: "Low", value: stats.low, fill: "#10b981" },
  ], [stats]);

  const statusData = useMemo(() => [
    { name: "Pending", value: stats.pending, fill: "#f59e0b" },
    { name: "In Progress", value: stats.inProgress, fill: "#6366f1" },
    { name: "Resolved", value: stats.resolved, fill: "#10b981" },
  ], [stats]);

  const typeData = useMemo(() => {
    const typeCount = incidents.reduce((acc, inc) => {
      const type = inc.type || "Unknown";
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {});
    return Object.entries(typeCount)
      .map(([name, value]) => ({ name: name.length > 14 ? name.substring(0, 11) + "…" : name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [incidents]);

  const trendData = useMemo(() => {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      const fullStr = date.toLocaleDateString();
      const count = incidents.filter(inc => new Date(inc.created_at).toLocaleDateString() === fullStr).length;
      const resolved = incidents.filter(inc =>
        new Date(inc.created_at).toLocaleDateString() === fullStr && inc.status === "Resolved"
      ).length;
      days.push({ date: dateStr, Incidents: count, Resolved: resolved });
    }
    return days;
  }, [incidents]);

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleString();
  };

  const handleExport = () => {
    const dataStr = JSON.stringify(incidents, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `incidents_${new Date().toISOString()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const priorityBadge = (priority) => {
    switch (priority?.toLowerCase()) {
      case 'critical': return 'bg-red-100 text-red-700 border border-red-200';
      case 'high':     return 'bg-orange-100 text-orange-700 border border-orange-200';
      case 'medium':   return 'bg-amber-100 text-amber-700 border border-amber-200';
      default:         return 'bg-emerald-100 text-emerald-700 border border-emerald-200';
    }
  };

  const statusBadge = (status) => {
    switch (status?.toLowerCase()) {
      case 'resolved':    return 'bg-emerald-100 text-emerald-700 border border-emerald-200';
      case 'in progress': return 'bg-indigo-100 text-indigo-700 border border-indigo-200';
      default:            return 'bg-amber-100 text-amber-700 border border-amber-200';
    }
  };

  const recentIncidents = useMemo(() =>
    [...incidents].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 10),
    [incidents]
  );

  const pendingCount = incidents.filter(i => i.status === "Pending").length;

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900 overflow-hidden font-sans">

      {/* ── Sidebar ── */}
      <div className={`${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
                      md:translate-x-0 fixed md:static inset-y-0 left-0 z-50
                      transition-transform duration-300 ease-in-out shadow-xl md:shadow-none`}>
        <AdminSidebar user={user} onClose={() => setSidebarOpen(false)} />
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">

        {/* ── Top Header ── */}
        <header className="h-16 bg-white/80 backdrop-blur border-b border-slate-200 px-6 flex items-center justify-between z-40 sticky top-0">
          <div className="flex items-center gap-4">
            <button onClick={() => setSidebarOpen(!sidebarOpen)}
              className="md:hidden p-2 hover:bg-slate-100 rounded-xl transition-colors">
              {sidebarOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-slate-900 leading-none">Command Center</h1>
              <p className="text-[11px] text-slate-400 mt-0.5 font-medium">
                {now.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
                &nbsp;&mdash;&nbsp;{now.toLocaleTimeString()}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Live pulse */}
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-full mr-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="text-xs font-semibold text-emerald-700">Live</span>
            </div>

            <button onClick={fetchIncidents}
              className="p-2 hover:bg-slate-100 rounded-xl transition-all text-slate-500 hover:text-slate-800">
              <RefreshCw size={18} className={loading ? "animate-spin text-indigo-500" : ""} />
            </button>

            <button className="relative p-2 hover:bg-slate-100 rounded-xl transition-all text-slate-500 hover:text-slate-800">
              <Bell size={18} />
              {pendingCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-rose-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                  {pendingCount > 9 ? "9+" : pendingCount}
                </span>
              )}
            </button>

            <div className="flex items-center gap-3 pl-3 ml-1 border-l border-slate-200">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-semibold text-slate-800 leading-none">{user?.fullName || "Admin"}</p>
                <p className="text-[11px] text-emerald-600 mt-0.5 font-medium">● Online</p>
              </div>
              <div className="w-9 h-9 bg-gradient-to-br from-indigo-500 to-sky-400 rounded-xl flex items-center justify-center font-bold text-white text-sm shadow-md">
                {user?.fullName?.charAt(0)?.toUpperCase() || "A"}
              </div>
            </div>
          </div>
        </header>

        {/* ── Main Content ── */}
        <main className="flex-1 overflow-auto p-6 md:p-7 space-y-7 bg-slate-50">

          {loading && incidents.length === 0 ? (
            <div className="flex items-center justify-center h-72">
              <div className="text-center">
                <div className="relative w-14 h-14 mx-auto mb-5">
                  <div className="w-14 h-14 border-4 border-indigo-100 rounded-full"></div>
                  <div className="absolute inset-0 w-14 h-14 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                </div>
                <p className="text-slate-500 font-medium">Loading command data…</p>
              </div>
            </div>
          ) : (
            <>
              {/* ── KPI Stats Row ── */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                <StatCard title="Total Incidents" value={stats.total}
                  icon={<Shield size={18} />}
                  gradient="bg-gradient-to-br from-indigo-500 to-indigo-600"
                  sub="All time" />
                <StatCard title="Pending" value={stats.pending}
                  icon={<Clock size={18} />}
                  gradient="bg-gradient-to-br from-amber-400 to-orange-500"
                  sub="Awaiting action" />
                <StatCard title="In Progress" value={stats.inProgress}
                  icon={<Zap size={18} />}
                  gradient="bg-gradient-to-br from-violet-500 to-purple-600"
                  sub="Active response" />
                <StatCard title="Resolved" value={stats.resolved}
                  icon={<CheckCircle size={18} />}
                  gradient="bg-gradient-to-br from-emerald-500 to-teal-500"
                  sub={`${stats.resolutionRate}% rate`} />
                <StatCard title="High Priority" value={stats.high}
                  icon={<AlertTriangle size={18} />}
                  gradient="bg-gradient-to-br from-rose-500 to-red-600"
                  sub="Needs attention" />
                <StatCard title="Resolution Rate" value={`${stats.resolutionRate}%`}
                  icon={<TrendingUp size={18} />}
                  gradient="bg-gradient-to-br from-sky-500 to-blue-600"
                  sub="Overall efficiency" />
              </div>

              {/* ── Charts Row 1 ── */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

                {/* Area Trend Chart — spans 2 cols */}
                <div className="lg:col-span-2 bg-white border border-slate-100 rounded-2xl shadow-sm p-6">
                  <div className="flex items-center justify-between mb-1">
                    <div>
                      <h2 className="text-base font-bold text-slate-800">Incident Trend</h2>
                      <p className="text-xs text-slate-400 mt-0.5">New vs Resolved — last 7 days</p>
                    </div>
                    <BarChart2 size={18} className="text-slate-300" />
                  </div>
                  <div className="h-[260px] mt-4">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={trendData}>
                        <defs>
                          <linearGradient id="gradIncidents" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.18} />
                            <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                          </linearGradient>
                          <linearGradient id="gradResolved" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.18} />
                            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                        <Tooltip content={<ChartTooltip />} />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                        <Area type="monotone" dataKey="Incidents" stroke="#6366f1" strokeWidth={2.5}
                          fill="url(#gradIncidents)" dot={{ fill: "#6366f1", r: 4, strokeWidth: 0 }} />
                        <Area type="monotone" dataKey="Resolved" stroke="#10b981" strokeWidth={2.5}
                          fill="url(#gradResolved)" dot={{ fill: "#10b981", r: 4, strokeWidth: 0 }} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Priority Donut */}
                <div className="bg-white border border-slate-100 rounded-2xl shadow-sm p-6">
                  <h2 className="text-base font-bold text-slate-800 mb-0.5">Priority Split</h2>
                  <p className="text-xs text-slate-400 mb-2">Incidents by severity</p>
                  <div className="h-[260px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={priorityData} cx="50%" cy="45%" innerRadius={60} outerRadius={90}
                          dataKey="value" paddingAngle={3}
                          label={({ name, percent }) => percent > 0 ? `${(percent * 100).toFixed(0)}%` : ""}>
                          {priorityData.map((entry, i) => (
                            <Cell key={i} fill={entry.fill} stroke="none" />
                          ))}
                        </Pie>
                        <Tooltip content={<ChartTooltip />} />
                        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* ── Charts Row 2 ── */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

                {/* Incident Types Bar */}
                <div className="lg:col-span-2 bg-white border border-slate-100 rounded-2xl shadow-sm p-6">
                  <div className="flex items-center justify-between mb-1">
                    <div>
                      <h2 className="text-base font-bold text-slate-800">Incidents by Type</h2>
                      <p className="text-xs text-slate-400 mt-0.5">Top 6 incident categories</p>
                    </div>
                  </div>
                  <div className="h-[240px] mt-4">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={typeData} barCategoryGap="35%">
                        <defs>
                          <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#6366f1" />
                            <stop offset="100%" stopColor="#818cf8" />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                        <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} angle={-10} textAnchor="end" height={44} />
                        <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                        <Tooltip content={<ChartTooltip />} />
                        <Bar dataKey="value" fill="url(#barGrad)" radius={[8, 8, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Status Donut */}
                <div className="bg-white border border-slate-100 rounded-2xl shadow-sm p-6">
                  <h2 className="text-base font-bold text-slate-800 mb-0.5">Status Overview</h2>
                  <p className="text-xs text-slate-400 mb-2">Current incident states</p>
                  <div className="h-[240px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={statusData} cx="50%" cy="45%" innerRadius={55} outerRadius={82}
                          dataKey="value" paddingAngle={4}
                          label={({ name, percent }) => percent > 0 ? `${(percent * 100).toFixed(0)}%` : ""}>
                          {statusData.map((entry, i) => (
                            <Cell key={i} fill={entry.fill} stroke="none" />
                          ))}
                        </Pie>
                        <Tooltip content={<ChartTooltip />} />
                        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* ── Live Map ── */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <h2 className="text-base font-bold text-slate-800">Live Incident Map</h2>
                    <span className="flex items-center gap-1.5 text-[11px] px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full font-semibold">
                      <span className="relative flex h-1.5 w-1.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                      </span>
                      LIVE
                    </span>
                  </div>
                  <span className="text-xs text-slate-400">{incidents.length} incidents on map</span>
                </div>
                <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden h-[400px] md:h-[480px]">
                  <MapView incidents={incidents} />
                </div>
              </div>

              {/* ── Recent Incidents Table ── */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-base font-bold text-slate-800">Recent Incidents</h2>
                    <p className="text-xs text-slate-400 mt-0.5">Latest 10 reported incidents</p>
                  </div>
                  <button onClick={handleExport}
                    className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50 rounded-xl text-sm font-medium transition-all text-slate-600 hover:text-indigo-700 shadow-sm">
                    <Download size={15} /> Export JSON
                  </button>
                </div>

                <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-100">
                          {["#", "Type", "Priority", "Status", "Location", "Reported"].map(h => (
                            <th key={h} className="px-5 py-3.5 text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {recentIncidents.map((inc, idx) => (
                          <tr key={inc.id}
                            className={`border-b border-slate-50 hover:bg-indigo-50/40 transition-colors cursor-default ${idx % 2 === 0 ? "" : "bg-slate-50/40"}`}>
                            <td className="px-5 py-3.5 font-mono text-xs text-slate-400 font-medium">#{inc.id}</td>
                            <td className="px-5 py-3.5 font-semibold text-slate-800 text-sm">{inc.type || "Unknown"}</td>
                            <td className="px-5 py-3.5">
                              <span className={`inline-flex items-center px-2.5 py-0.5 text-[11px] font-bold rounded-lg ${priorityBadge(inc.priority)}`}>
                                {inc.priority || "Normal"}
                              </span>
                            </td>
                            <td className="px-5 py-3.5">
                              <span className={`inline-flex items-center px-2.5 py-0.5 text-[11px] font-bold rounded-lg ${statusBadge(inc.status)}`}>
                                {inc.status === "In Progress" && <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 mr-1.5 animate-pulse"></span>}
                                {inc.status || "Pending"}
                              </span>
                            </td>
                            <td className="px-5 py-3.5 text-slate-500 text-xs font-mono">
                              {inc.latitude && inc.longitude
                                ? `${parseFloat(inc.latitude).toFixed(4)}, ${parseFloat(inc.longitude).toFixed(4)}`
                                : <span className="text-slate-300">—</span>}
                            </td>
                            <td className="px-5 py-3.5 text-slate-400 text-xs">{formatDate(inc.created_at)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {recentIncidents.length === 0 && (
                    <div className="py-20 text-center">
                      <Shield size={32} className="mx-auto text-slate-200 mb-3" />
                      <p className="text-slate-400 font-medium">No incidents reported yet</p>
                    </div>
                  )}
                </div>
              </div>

            </>
          )}
        </main>
      </div>

      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div className="md:hidden fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
          onClick={() => setSidebarOpen(false)} />
      )}
    </div>
  );
};

export default AdminDashboard;