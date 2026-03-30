// src/pages/AdminDashboard.js
import React, { useState, useMemo } from "react";
import { useSocket } from "../hooks/useSocket";
import AdminSidebar from "../layout/AdminSidebar";
import MapView from "../components/MapView";
import IncidentTable from "../components/IncidentTable";
import { 
  Menu, X, Bell, RefreshCw, Download, 
  AlertTriangle, Users 
} from "lucide-react";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend
} from "recharts";

const AdminDashboard = () => {
  const incidents = useSocket();
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const stats = useMemo(() => {
    const total = incidents.length;
    const high = incidents.filter((i) => i.ai_priority === "High" || i.ai_priority === "Critical").length;
    const medium = incidents.filter((i) => i.ai_priority === "Medium").length;
    const low = incidents.filter((i) => i.ai_priority === "Low" || i.ai_priority === "Normal").length;
    return { total, high, medium, low };
  }, [incidents]);

  // Data for Pie Chart (Priority Distribution)
  const priorityData = useMemo(() => [
    { name: "High", value: stats.high, fill: "#f43f5e" },
    { name: "Medium", value: stats.medium, fill: "#f59e0b" },
    { name: "Low", value: stats.low, fill: "#10b981" },
  ], [stats]);

  // Mock data for Bar Chart - Incidents by Type (you can make this dynamic later)
  const typeData = useMemo(() => {
    const typeCount = incidents.reduce((acc, inc) => {
      const type = inc.ai_type || inc.type || "Other";
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {});

    return Object.entries(typeCount)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6); // Show top 6 types
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
            <button className="p-2.5 hover:bg-zinc-100 rounded-2xl transition-all text-zinc-600">
              <RefreshCw size={20} />
            </button>
            <button className="p-2.5 hover:bg-zinc-100 rounded-2xl transition-all relative text-zinc-600">
              <Bell size={20} />
              {incidents.length > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-rose-500 text-white text-[10px] font-medium rounded-full flex items-center justify-center">
                  {incidents.length}
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
          {/* Stats Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
            <Stat title="Total Incidents" value={stats.total} icon={<Users size={28} />} color="zinc" />
            <Stat title="High Priority" value={stats.high} icon={<AlertTriangle size={28} className="text-rose-500" />} color="rose" />
            <Stat title="Medium Priority" value={stats.medium} icon="🟠" color="amber" />
            <Stat title="Low Priority" value={stats.low} icon="🟢" color="emerald" />
          </div>

          {/* Interactive Charts Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Priority Pie Chart */}
            <div className="bg-white border border-zinc-200 rounded-3xl shadow-sm p-6">
              <h2 className="text-xl font-semibold mb-1">Priority Distribution</h2>
              <p className="text-sm text-zinc-500 mb-6">Interactive pie chart - hover for details</p>
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

            {/* Incidents by Type Bar Chart */}
            <div className="bg-white border border-zinc-200 rounded-3xl shadow-sm p-6">
              <h2 className="text-xl font-semibold mb-1">Incidents by Type</h2>
              <p className="text-sm text-zinc-500 mb-6">Top incident categories</p>
              <div className="h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={typeData} barCategoryGap={20}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
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
          </div>

          {/* Live Map */}
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-3">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                Live Incident Map
                <span className="text-xs px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full font-medium">LIVE</span>
              </h2>
              <p className="text-sm text-zinc-500">Click markers for details • Real-time updates</p>
            </div>
            <div className="bg-white border border-zinc-200 rounded-3xl shadow-sm overflow-hidden h-[380px] md:h-[480px] lg:h-[520px]">
              <MapView incidents={incidents} />
            </div>
          </div>

          {/* Recent Incidents Table */}
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-3">
              <h2 className="text-xl font-semibold">Recent Incidents</h2>
              <button className="flex items-center gap-2 px-5 py-2.5 bg-white border border-zinc-200 hover:border-emerald-300 rounded-2xl text-sm font-medium transition-all">
                <Download size={18} className="text-emerald-600" /> Export Report
              </button>
            </div>
            <div className="bg-white border border-zinc-200 rounded-3xl shadow-sm overflow-hidden">
              <IncidentTable data={incidents} isAdmin={true} />
            </div>
          </div>
        </main>
      </div>

      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div className="md:hidden fixed inset-0 bg-black/60 z-40" onClick={() => setSidebarOpen(false)} />
      )}
    </div>
  );
};

const Stat = ({ title, value, icon, color = "zinc" }) => {
  const colorMap = {
    rose: "border-rose-200 text-rose-600",
    amber: "border-amber-200 text-amber-600",
    emerald: "border-emerald-200 text-emerald-600",
    zinc: "border-zinc-200 text-zinc-600",
  };

  return (
    <div className={`group bg-white border ${colorMap[color]} p-7 rounded-3xl shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5`}>
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="text-zinc-500 text-sm tracking-wide mb-1">{title}</p>
          <h3 className="text-5xl font-semibold tabular-nums tracking-tighter text-zinc-900">{value}</h3>
        </div>
        <div className="text-4xl opacity-90 group-hover:scale-110 transition-transform">{icon}</div>
      </div>
    </div>
  );
};

export default AdminDashboard;