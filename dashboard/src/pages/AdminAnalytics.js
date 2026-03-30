// src/pages/AdminAnalytics.js
import React, { useMemo } from "react";
import AdminSidebar from "../layout/AdminSidebar";
import { useSocket } from "../hooks/useSocket";
import IncidentChart from "../components/IncidentChart";
import { TrendingUp, AlertTriangle, Clock, Users } from "lucide-react";

const AdminAnalytics = () => {
  const incidents = useSocket();
  const user = JSON.parse(localStorage.getItem("user") || "{}");

  const stats = useMemo(() => {
    const total = incidents.length;
    const high = incidents.filter((i) => i.ai_priority === "High" || i.ai_priority === "Critical").length;
    const medium = incidents.filter((i) => i.ai_priority === "Medium").length;
    const low = incidents.filter((i) => i.ai_priority === "Low" || i.ai_priority === "Normal").length;

    return { total, high, medium, low };
  }, [incidents]);

  return (
    <div className="flex h-screen bg-zinc-50 text-zinc-900 overflow-hidden">
      <AdminSidebar user={user} />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Navbar */}
        <header className="h-16 bg-white border-b border-zinc-200 px-6 md:px-8 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-4">
            <TrendingUp className="w-7 h-7 text-emerald-600" />
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Analytics Dashboard</h1>
              <p className="text-sm text-zinc-500">Real-time insights from incidents</p>
            </div>
          </div>

          <div className="text-sm text-zinc-500 font-mono">
            Last updated: Just now
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 p-6 md:p-8 overflow-auto">
          {/* Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
            <Stat 
              title="Total Incidents" 
              value={stats.total} 
              icon={<Users size={28} />} 
              color="zinc" 
            />
            <Stat 
              title="High Priority" 
              value={stats.high} 
              icon={<AlertTriangle size={28} className="text-rose-500" />} 
              color="rose" 
            />
            <Stat 
              title="Medium Priority" 
              value={stats.medium} 
              icon="🟠" 
              color="amber" 
            />
            <Stat 
              title="Low Priority" 
              value={stats.low} 
              icon="🟢" 
              color="emerald" 
            />
          </div>

          {/* Charts Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Priority Overview Chart */}
            <div className="bg-white rounded-3xl shadow-sm border border-zinc-100 p-8">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-semibold text-zinc-900">Priority Distribution</h2>
                  <p className="text-sm text-zinc-500">Breakdown by priority level</p>
                </div>
                <div className="text-xs px-4 py-2 bg-emerald-50 text-emerald-700 rounded-2xl font-medium">
                  Real-time
                </div>
              </div>
              <div className="h-[420px]">
                <IncidentChart incidents={incidents} />
              </div>
            </div>

            {/* Additional Insights Card (Ready for more charts) */}
            <div className="bg-white rounded-3xl shadow-sm border border-zinc-100 p-8 flex flex-col">
              <h2 className="text-xl font-semibold mb-6">Incident Insights</h2>
              
              <div className="flex-1 flex items-center justify-center text-center">
                <div>
                  <div className="text-6xl mb-4">📊</div>
                  <p className="text-zinc-500 text-sm max-w-xs mx-auto">
                    More analytics charts (Trends over time, Heatmap, Response time, etc.) 
                    can be added here.
                  </p>
                </div>
              </div>

              <div className="pt-6 border-t border-zinc-100 text-xs text-zinc-400 text-center">
                Tip: Connect more data sources to unlock deeper insights
              </div>
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
    zinc: "border-zinc-200 text-zinc-600",
  };

  return (
    <div className={`bg-white border ${colorMap[color]} rounded-3xl p-7 shadow-sm hover:shadow transition-all group`}>
      <div className="flex items-start justify-between mb-4">
        <div className="text-4xl opacity-80 group-hover:scale-110 transition-transform">
          {icon}
        </div>
      </div>
      <p className="text-zinc-500 text-sm tracking-wide mb-1">{title}</p>
      <h2 className="text-5xl font-semibold tabular-nums tracking-tighter text-zinc-900">
        {value}
      </h2>
    </div>
  );
};

export default AdminAnalytics;