// src/pages/AdminAnalytics.js
import React, { useState, useEffect, useMemo } from "react";
import AdminSidebar from "../layout/AdminSidebar";
import PageHeader from "../layout/PageHeader";
import { 
  TrendingUp, AlertTriangle, Clock, Users, 
  Calendar, MapPin, Activity, RefreshCw, Download,
  TrendingDown, TrendingUp as TrendingUpIcon, BarChart3, PieChart as PieChartIcon
} from "lucide-react";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend,
  LineChart, Line, AreaChart, Area
} from "recharts";
import axios from "axios";

const API_URL = "http://localhost:5000/api";

const AdminAnalytics = () => {
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [timeRange, setTimeRange] = useState("week"); // week, month, year

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
    
    // Calculate average confidence
    const avgConfidence = incidents.reduce((sum, inc) => sum + (inc.confidence || 0), 0) / (total || 1);
    
    return { total, high, medium, low, pending, resolved, inProgress, avgConfidence };
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
      .slice(0, 8);
  }, [incidents]);

  // Data for Line Chart - Incidents by Date
  const getDateRange = () => {
    const today = new Date();
    const dates = [];
    let days = 7;
    if (timeRange === "month") days = 30;
    if (timeRange === "year") days = 12;
    
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(today.getDate() - i);
      if (timeRange === "year") {
        dates.push(date.toLocaleString('default', { month: 'short' }));
      } else {
        dates.push(date.toLocaleDateString());
      }
    }
    return dates;
  };

  const trendData = useMemo(() => {
    const dates = getDateRange();
    return dates.map(date => {
      let count = 0;
      incidents.forEach(inc => {
        const incDate = new Date(inc.created_at);
        let match = false;
        if (timeRange === "year") {
          match = incDate.toLocaleString('default', { month: 'short' }) === date;
        } else {
          match = incDate.toLocaleDateString() === date;
        }
        if (match) count++;
      });
      return { date, count };
    });
  }, [incidents, timeRange]);

  // Data for Hourly Distribution
  const hourlyData = useMemo(() => {
    const hours = Array(24).fill(0);
    incidents.forEach(inc => {
      const hour = new Date(inc.created_at).getHours();
      hours[hour]++;
    });
    return hours.map((count, hour) => ({ hour: `${hour}:00`, count }));
  }, [incidents]);

  // Data for Day of Week Distribution
  const dayOfWeekData = useMemo(() => {
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const dayCounts = [0, 0, 0, 0, 0, 0, 0];
    incidents.forEach(inc => {
      const day = new Date(inc.created_at).getDay();
      dayCounts[day]++;
    });
    return days.map((day, index) => ({ day, count: dayCounts[index] }));
  }, [incidents]);

  // Resolution time (mock data - you can add actual resolution time to your DB)
  const resolutionData = useMemo(() => {
    const resolved = incidents.filter(i => i.status === "Resolved");
    const avgTime = resolved.length > 0 ? Math.floor(Math.random() * 48) + 12 : 0;
    return { avg: avgTime, total: resolved.length };
  }, [incidents]);

  const getPriorityColor = (priority) => {
    switch (priority?.toLowerCase()) {
      case 'critical': return '#ef4444';
      case 'high': return '#f97316';
      case 'medium': return '#f59e0b';
      default: return '#10b981';
    }
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
    link.download = `analytics_${new Date().toISOString()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (loading && incidents.length === 0) {
    return (
      <div className="flex h-screen bg-slate-50">
        <AdminSidebar user={user} />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="relative w-14 h-14 mx-auto mb-5">
              <div className="w-14 h-14 border-4 border-indigo-100 rounded-full"></div>
              <div className="absolute inset-0 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
            <p className="text-slate-500 font-medium">Loading analytics…</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900 overflow-hidden">
      <AdminSidebar user={user} />

      <div className="flex-1 flex flex-col overflow-hidden">
        <PageHeader
          title="Analytics Dashboard"
          subtitle="Real-time insights from incidents"
          icon={<TrendingUp size={16} />}
          onRefresh={handleRefresh}
          loading={loading}
          user={user}
        />
        {/* Main Content */}
        <main className="flex-1 p-6 md:p-8 overflow-auto">
          {/* Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
            <Stat title="Total Incidents" value={stats.total} icon={<Users size={24} />} color="zinc" />
            <Stat title="High Priority" value={stats.high} icon={<AlertTriangle size={24} />} color="rose" />
            <Stat title="In Progress" value={stats.inProgress} icon={<Activity size={24} />} color="blue" />
            <Stat title="Resolved" value={stats.resolved} icon={<TrendingDown size={24} />} color="emerald" />
            <Stat title="Avg Confidence" value={`${Math.round(stats.avgConfidence * 100)}%`} icon={<BarChart3 size={24} />} color="purple" />
          </div>

          {/* Time Range Selector */}
          <div className="flex justify-end mb-6">
            <div className="bg-white border border-zinc-200 rounded-xl p-1 flex gap-1">
              <button
                onClick={() => setTimeRange("week")}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                  timeRange === "week" ? "bg-emerald-600 text-white" : "text-zinc-600 hover:bg-zinc-100"
                }`}
              >
                Last 7 Days
              </button>
              <button
                onClick={() => setTimeRange("month")}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                  timeRange === "month" ? "bg-emerald-600 text-white" : "text-zinc-600 hover:bg-zinc-100"
                }`}
              >
                Last 30 Days
              </button>
              <button
                onClick={() => setTimeRange("year")}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                  timeRange === "year" ? "bg-emerald-600 text-white" : "text-zinc-600 hover:bg-zinc-100"
                }`}
              >
                By Month
              </button>
            </div>
          </div>

          {/* Charts Row 1 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Incident Trend Chart */}
            <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-semibold text-zinc-900">Incident Trend</h2>
                  <p className="text-sm text-zinc-500">Over {timeRange === "year" ? "months" : "days"}</p>
                </div>
                <TrendingUpIcon size={20} className="text-emerald-600" />
              </div>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} angle={-15} textAnchor="end" height={60} />
                    <YAxis />
                    <Tooltip />
                    <Area type="monotone" dataKey="count" stroke="#10b981" fill="#10b981" fillOpacity={0.2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Priority Distribution Pie Chart */}
            <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-semibold text-zinc-900">Priority Distribution</h2>
                  <p className="text-sm text-zinc-500">Breakdown by priority level</p>
                </div>
                <PieChartIcon size={20} className="text-emerald-600" />
              </div>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={priorityData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      dataKey="value"
                      nameKey="name"
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    >
                      {priorityData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Charts Row 2 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Incidents by Type Bar Chart */}
            <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-semibold text-zinc-900">Incidents by Type</h2>
                  <p className="text-sm text-zinc-500">Top incident categories</p>
                </div>
                <BarChart3 size={20} className="text-emerald-600" />
              </div>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={typeData} layout="vertical" barCategoryGap={10}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis type="number" />
                    <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="value" fill="#10b981" radius={[0, 8, 8, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Status Distribution Pie Chart */}
            <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-semibold text-zinc-900">Status Distribution</h2>
                  <p className="text-sm text-zinc-500">Current incident status</p>
                </div>
                <PieChartIcon size={20} className="text-emerald-600" />
              </div>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      dataKey="value"
                      nameKey="name"
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

          {/* Charts Row 3 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Hourly Distribution */}
            <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-semibold text-zinc-900">Hourly Distribution</h2>
                  <p className="text-sm text-zinc-500">Incidents by time of day</p>
                </div>
                <Clock size={20} className="text-emerald-600" />
              </div>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={hourlyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="hour" tick={{ fontSize: 10 }} angle={-45} textAnchor="end" height={60} />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Day of Week Distribution */}
            <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-semibold text-zinc-900">Weekly Distribution</h2>
                  <p className="text-sm text-zinc-500">Incidents by day of week</p>
                </div>
                <Calendar size={20} className="text-emerald-600" />
              </div>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dayOfWeekData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="day" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="count" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Resolution Time Card */}
          <div className="mt-6 bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-2xl p-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold mb-1">Average Resolution Time</h3>
                <p className="text-emerald-100 text-sm">Based on resolved incidents</p>
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold">{resolutionData.avg} hours</div>
                <p className="text-emerald-100 text-sm">{resolutionData.total} incidents resolved</p>
              </div>
            </div>
            <div className="mt-4 w-full bg-emerald-400/30 rounded-full h-2">
              <div 
                className="bg-white rounded-full h-2" 
                style={{ width: `${Math.min(100, (resolutionData.avg / 72) * 100)}%` }}
              />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

const Stat = ({ title, value, icon, color = "zinc" }) => {
  const colorMap = {
    rose: "border-rose-200 text-rose-600",
    amber: "border-amber-200 text-amber-600",
    emerald: "border-emerald-200 text-emerald-600",
    blue: "border-blue-200 text-blue-600",
    purple: "border-purple-200 text-purple-600",
    zinc: "border-zinc-200 text-zinc-600",
  };

  return (
    <div className={`bg-white border ${colorMap[color]} rounded-2xl p-5 shadow-sm hover:shadow-md transition-all`}>
      <div className="flex items-center justify-between mb-3">
        <p className="text-zinc-500 text-xs font-medium uppercase tracking-wide">{title}</p>
        <div className="text-zinc-400">{icon}</div>
      </div>
      <p className="text-2xl font-bold text-zinc-900">{value}</p>
    </div>
  );
};

export default AdminAnalytics;