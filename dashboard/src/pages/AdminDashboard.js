// src/pages/AdminDashboard.js
import React, { useState, useEffect, useMemo } from "react";
import AdminSidebar from "../layout/AdminSidebar";
import MapView from "../components/MapView";
import IncidentTable from "../components/IncidentTable";
import { 
  Menu, X, Bell, RefreshCw, Download, 
  AlertTriangle, Users, TrendingUp, Clock, CheckCircle
} from "lucide-react";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  LineChart, Line
} from "recharts";
import axios from "axios";

const API_URL = "http://localhost:5000/api";

// StatCard Component
const StatCard = ({ title, value, icon, color }) => {
  const colorMap = {
    blue: "border-blue-500 bg-blue-50",
    yellow: "border-yellow-500 bg-yellow-50",
    emerald: "border-emerald-500 bg-emerald-50",
    red: "border-red-500 bg-red-50",
    amber: "border-amber-500 bg-amber-50",
    green: "border-green-500 bg-green-50",
  };

  return (
    <div className={`bg-white border-l-4 ${colorMap[color] || colorMap.blue} rounded-xl p-4 shadow-sm`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-zinc-500 text-xs font-medium">{title}</p>
          <p className="text-2xl font-bold text-zinc-900 mt-1">{value}</p>
        </div>
        <div className="text-zinc-400">{icon}</div>
      </div>
    </div>
  );
};

const AdminDashboard = () => {
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Fetch incidents from API
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
    // Refresh every 30 seconds
    const interval = setInterval(fetchIncidents, 30000);
    return () => clearInterval(interval);
  }, []);

  // Calculate statistics
  const stats = useMemo(() => {
    const total = incidents.length;
    const high = incidents.filter((i) => i.priority === "High" || i.priority === "Critical").length;
    const medium = incidents.filter((i) => i.priority === "Medium").length;
    const low = incidents.filter((i) => i.priority === "Low" || i.priority === "Normal").length;
    const pending = incidents.filter((i) => i.status === "Pending").length;
    const resolved = incidents.filter((i) => i.status === "Resolved").length;
    const inProgress = incidents.filter((i) => i.status === "In Progress").length;
    return { total, high, medium, low, pending, resolved, inProgress };
  }, [incidents]);

  // Data for Pie Chart (Priority Distribution)
  const priorityData = useMemo(() => [
    { name: "High", value: stats.high, fill: "#ef4444" },
    { name: "Medium", value: stats.medium, fill: "#f59e0b" },
    { name: "Low", value: stats.low, fill: "#10b981" },
  ], [stats]);

  // Data for Status Chart
  const statusData = useMemo(() => [
    { name: "Pending", value: stats.pending, fill: "#f59e0b" },
    { name: "In Progress", value: stats.inProgress, fill: "#3b82f6" },
    { name: "Resolved", value: stats.resolved, fill: "#10b981" },
  ], [stats]);

  // Data for Bar Chart - Incidents by Type
  const typeData = useMemo(() => {
    const typeCount = incidents.reduce((acc, inc) => {
      const type = inc.type || "Unknown";
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {});

    return Object.entries(typeCount)
      .map(([name, value]) => ({ name: name.length > 15 ? name.substring(0, 12) + "..." : name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [incidents]);

  // Data for Line Chart - Incidents by Date (last 7 days)
  const trendData = useMemo(() => {
    const last7Days = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toLocaleDateString();
      const count = incidents.filter(inc => {
        const incDate = new Date(inc.created_at);
        return incDate.toLocaleDateString() === dateStr;
      }).length;
      last7Days.push({ date: dateStr, count });
    }
    return last7Days;
  }, [incidents]);

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  const handleRefresh = () => {
    fetchIncidents();
  };

  const handleExport = () => {
    const dataStr = JSON.stringify(incidents, null, 2);
    const dataBlob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `incidents_${new Date().toISOString()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const getPriorityColor = (priority) => {
    switch (priority?.toLowerCase()) {
      case 'critical': return 'bg-red-100 text-red-700';
      case 'high': return 'bg-orange-100 text-orange-700';
      case 'medium': return 'bg-yellow-100 text-yellow-700';
      default: return 'bg-green-100 text-green-700';
    }
  };

  // Recent incidents for table (last 10)
  const recentIncidents = useMemo(() => {
    return [...incidents].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 10);
  }, [incidents]);

  return (
    <div className="flex h-screen bg-zinc-50 text-zinc-900 overflow-hidden font-sans">
      {/* Sidebar */}
      <div className={`${sidebarOpen ? "translate-x-0" : "-translate-x-full"} 
                      md:translate-x-0 fixed md:static inset-y-0 left-0 z-50 w-64 
                      transition-transform duration-300 ease-in-out bg-white border-r border-zinc-200 shadow-sm`}>
        <AdminSidebar user={user} onClose={() => setSidebarOpen(false)} />
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Navbar */}
        <header className="h-16 bg-white border-b border-zinc-200 px-6 flex items-center justify-between shadow-sm z-40">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="md:hidden p-2 hover:bg-zinc-100 rounded-xl transition-colors"
            >
              {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Command Center</h1>
              <p className="text-xs text-zinc-500">Real-time Incident Monitoring</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden md:block text-xs text-zinc-400">
              Last updated: {lastUpdated.toLocaleTimeString()}
            </div>
            <button 
              onClick={handleRefresh}
              className="p-2.5 hover:bg-zinc-100 rounded-2xl transition-all text-zinc-600"
            >
              <RefreshCw size={20} className={loading ? "animate-spin" : ""} />
            </button>
            <button className="p-2.5 hover:bg-zinc-100 rounded-2xl transition-all relative text-zinc-600">
              <Bell size={20} />
              {incidents.filter(i => i.status === "Pending").length > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-rose-500 text-white text-[10px] font-medium rounded-full flex items-center justify-center">
                  {incidents.filter(i => i.status === "Pending").length}
                </span>
              )}
            </button>

            <div className="flex items-center gap-3 pl-4 border-l border-zinc-200">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-medium">{user?.fullName || "Admin"}</p>
                <p className="text-xs text-emerald-600">● Online</p>
              </div>
              <div className="w-9 h-9 bg-gradient-to-br from-emerald-500 to-sky-500 rounded-2xl flex items-center justify-center font-semibold text-white">
                {user?.fullName?.charAt(0) || "A"}
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-6 md:p-8 space-y-8 bg-zinc-50">
          {loading && incidents.length === 0 ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <div className="animate-spin w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full mx-auto mb-4"></div>
                <p className="text-zinc-500">Loading dashboard data...</p>
              </div>
            </div>
          ) : (
            <>
              {/* Stats Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 mb-6">
                <StatCard title="Total" value={stats.total} icon={<AlertTriangle size={16} />} color="blue" />
                <StatCard title="Pending" value={stats.pending} icon={<Clock size={16} />} color="yellow" />
                <StatCard title="In Progress" value={stats.inProgress} icon={<TrendingUp size={16} />} color="blue" />
                <StatCard title="Resolved" value={stats.resolved} icon={<CheckCircle size={16} />} color="emerald" />
                <StatCard title="High" value={stats.high} icon={<AlertTriangle size={16} />} color="red" />
                <StatCard title="Medium" value={stats.medium} icon={<AlertTriangle size={16} />} color="amber" />
                <StatCard title="Low" value={stats.low} icon={<AlertTriangle size={16} />} color="green" />
              </div>

              {/* Interactive Charts Section */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Priority Pie Chart */}
                <div className="bg-white border border-zinc-200 rounded-3xl shadow-sm p-6">
                  <h2 className="text-xl font-semibold mb-1">Priority Distribution</h2>
                  <p className="text-sm text-zinc-500 mb-6">Incidents by priority level</p>
                  <div className="h-[320px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={priorityData}
                          cx="50%"
                          cy="50%"
                          innerRadius={70}
                          outerRadius={110}
                          dataKey="value"
                          nameKey="name"
                          paddingAngle={3}
                          label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                        >
                          {priorityData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.fill} />
                          ))}
                        </Pie>
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: "#fff", 
                            border: "none", 
                            borderRadius: "12px", 
                            boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)" 
                          }} 
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Status Pie Chart */}
                <div className="bg-white border border-zinc-200 rounded-3xl shadow-sm p-6">
                  <h2 className="text-xl font-semibold mb-1">Status Distribution</h2>
                  <p className="text-sm text-zinc-500 mb-6">Current incident status</p>
                  <div className="h-[320px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={statusData}
                          cx="50%"
                          cy="50%"
                          innerRadius={70}
                          outerRadius={110}
                          dataKey="value"
                          nameKey="name"
                          paddingAngle={3}
                          label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                        >
                          {statusData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.fill} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* Second Row Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Incidents by Type Bar Chart */}
                <div className="bg-white border border-zinc-200 rounded-3xl shadow-sm p-6">
                  <h2 className="text-xl font-semibold mb-1">Incidents by Type</h2>
                  <p className="text-sm text-zinc-500 mb-6">Top incident categories</p>
                  <div className="h-[320px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={typeData} barCategoryGap={20}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey="name" tick={{ fontSize: 12 }} angle={-15} textAnchor="end" height={60} />
                        <YAxis />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: "#fff", 
                            border: "none", 
                            borderRadius: "12px" 
                          }} 
                        />
                        <Bar dataKey="value" fill="#10b981" radius={[8, 8, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Trend Line Chart */}
                <div className="bg-white border border-zinc-200 rounded-3xl shadow-sm p-6">
                  <h2 className="text-xl font-semibold mb-1">Incident Trend</h2>
                  <p className="text-sm text-zinc-500 mb-6">Last 7 days</p>
                  <div className="h-[320px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={trendData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                        <YAxis />
                        <Tooltip />
                        <Line type="monotone" dataKey="count" stroke="#10b981" strokeWidth={3} dot={{ fill: "#10b981", r: 6 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* Live Map */}
              <div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-3">
                  <h2 className="text-xl font-semibold flex items-center gap-2">
                    Live Incident Map
                    <span className="text-xs px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full font-medium">LIVE</span>
                  </h2>
                  <p className="text-sm text-zinc-500">{incidents.length} incidents reported</p>
                </div>
                <div className="bg-white border border-zinc-200 rounded-3xl shadow-sm overflow-hidden h-[380px] md:h-[480px] lg:h-[520px]">
                  <MapView incidents={incidents} />
                </div>
              </div>

              {/* Recent Incidents Table */}
              <div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-3">
                  <h2 className="text-xl font-semibold">Recent Incidents</h2>
                  <button 
                    onClick={handleExport}
                    className="flex items-center gap-2 px-5 py-2.5 bg-white border border-zinc-200 hover:border-emerald-300 rounded-2xl text-sm font-medium transition-all"
                  >
                    <Download size={18} className="text-emerald-600" /> Export Report
                  </button>
                </div>
                <div className="bg-white border border-zinc-200 rounded-3xl shadow-sm overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-zinc-50 border-b border-zinc-200">
                        <tr>
                          <th className="px-6 py-4 text-left font-medium text-zinc-500 text-xs uppercase tracking-wider">ID</th>
                          <th className="px-6 py-4 text-left font-medium text-zinc-500 text-xs uppercase tracking-wider">Type</th>
                          <th className="px-6 py-4 text-left font-medium text-zinc-500 text-xs uppercase tracking-wider">Priority</th>
                          <th className="px-6 py-4 text-left font-medium text-zinc-500 text-xs uppercase tracking-wider">Status</th>
                          <th className="px-6 py-4 text-left font-medium text-zinc-500 text-xs uppercase tracking-wider">Location</th>
                          <th className="px-6 py-4 text-left font-medium text-zinc-500 text-xs uppercase tracking-wider">Reported</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100">
                        {recentIncidents.map((incident) => (
                          <tr key={incident.id} className="hover:bg-zinc-50/50 transition-colors">
                            <td className="px-6 py-4 font-mono text-xs text-zinc-500">#{incident.id}</td>
                            <td className="px-6 py-4 font-medium text-zinc-900">{incident.type || "Unknown"}</td>
                            <td className="px-6 py-4">
                              <span className={`inline-flex px-3 py-1 text-xs font-semibold rounded-full ${getPriorityColor(incident.priority)}`}>
                                {incident.priority || "Normal"}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <span className={`inline-flex px-3 py-1 text-xs font-semibold rounded-full ${
                                incident.status === "Resolved" ? "bg-green-100 text-green-700" :
                                incident.status === "In Progress" ? "bg-blue-100 text-blue-700" :
                                "bg-yellow-100 text-yellow-700"
                              }`}>
                                {incident.status || "Pending"}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-zinc-600 text-xs">
                              {incident.latitude && incident.longitude 
                                ? `${parseFloat(incident.latitude).toFixed(4)}, ${parseFloat(incident.longitude).toFixed(4)}`
                                : "Unknown"}
                            </td>
                            <td className="px-6 py-4 text-zinc-500 text-xs">
                              {formatDate(incident.created_at)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {recentIncidents.length === 0 && (
                    <div className="py-20 text-center">
                      <p className="text-zinc-500">No incidents reported yet</p>
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
        <div className="md:hidden fixed inset-0 bg-black/60 z-40" onClick={() => setSidebarOpen(false)} />
      )}
    </div>
  );
};

export default AdminDashboard;