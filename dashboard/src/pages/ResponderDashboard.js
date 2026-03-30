// src/pages/ResponderDashboard.js
import React, { useEffect, useState, useMemo } from "react";
import ResponderSidebar from "../layout/ResponderSidebar";
import MapView from "../components/MapView";
import IncidentTable from "../components/IncidentTable";
import axios from "axios";
import { Shield, MapPin, Clock, CheckCircle, AlertTriangle } from "lucide-react";

const ResponderDashboard = () => {
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchIncidents = async () => {
      try {
        const res = await axios.get(`http://localhost:5000/api/incidents/assigned/${user.id}`);
        setIncidents(res.data);
      } catch (err) {
        console.error("Error fetching assigned incidents:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchIncidents();
  }, [user.id]);

  const stats = useMemo(() => {
    const total = incidents.length;
    const inProgress = incidents.filter((i) => i.status === "In Progress").length;
    const resolved = incidents.filter((i) => i.status === "Resolved").length;
    const pending = incidents.filter((i) => i.status === "Pending" || !i.status).length;

    return { total, inProgress, resolved, pending };
  }, [incidents]);

  return (
    <div className="flex h-screen bg-zinc-50 text-zinc-900 overflow-hidden">
      <ResponderSidebar 
        activeTab="dashboard" 
        setActiveTab={() => {}} 
        user={user} 
      />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Navbar - Blue Theme */}
        <header className="h-16 bg-white border-b border-zinc-200 px-6 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-4">
            <Shield className="w-7 h-7 text-blue-600" />
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Responder Dashboard</h1>
              <p className="text-sm text-zinc-500">Field Operations • Real-time</p>
            </div>
          </div>

          <div className="text-sm text-zinc-500 font-medium">
            Welcome back, <span className="text-blue-600">{user?.fullName || user?.full_name}</span>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 p-6 md:p-8 overflow-auto bg-zinc-50">
          {/* Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
            <StatCard 
              title="Total Assigned" 
              value={stats.total} 
              icon={<MapPin size={28} />} 
              color="blue" 
            />
            <StatCard 
              title="In Progress" 
              value={stats.inProgress} 
              icon={<Clock size={28} />} 
              color="amber" 
            />
            <StatCard 
              title="Resolved" 
              value={stats.resolved} 
              icon={<CheckCircle size={28} />} 
              color="emerald" 
            />
            <StatCard 
              title="Pending" 
              value={stats.pending} 
              icon={<AlertTriangle size={28} />} 
              color="rose" 
            />
          </div>

          {/* Live Map Section */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                My Assigned Incidents Map
                <span className="text-xs px-3 py-1 bg-blue-100 text-blue-700 rounded-full font-medium">LIVE</span>
              </h2>
              <p className="text-sm text-zinc-500">Click markers for details</p>
            </div>
            <div className="bg-white border border-zinc-200 rounded-3xl shadow-sm overflow-hidden h-[420px] md:h-[480px]">
              <MapView incidents={incidents} />
            </div>
          </div>

          {/* Recent Incidents Table */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">My Recent Incidents</h2>
              {incidents.length > 0 && (
                <p className="text-sm text-zinc-500">
                  {incidents.length} assigned incident{incidents.length > 1 ? 's' : ''}
                </p>
              )}
            </div>
            
            <div className="bg-white border border-zinc-200 rounded-3xl shadow-sm overflow-hidden">
              {loading ? (
                <div className="py-20 text-center">
                  <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
                  <p className="text-zinc-500">Loading your incidents...</p>
                </div>
              ) : (
                <IncidentTable data={incidents} isAdmin={false} />
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

const StatCard = ({ title, value, icon, color = "blue" }) => {
  const colorMap = {
    blue: "border-blue-200 text-blue-600",
    emerald: "border-emerald-200 text-emerald-600",
    amber: "border-amber-200 text-amber-600",
    rose: "border-rose-200 text-rose-600",
  };

  return (
    <div className={`bg-white border ${colorMap[color]} p-6 rounded-3xl shadow-sm hover:shadow transition-all hover:-translate-y-0.5`}>
      <div className="flex items-start justify-between mb-4">
        <div className="text-4xl opacity-90">{icon}</div>
      </div>
      <p className="text-zinc-500 text-sm tracking-wide mb-1">{title}</p>
      <h3 className="text-5xl font-semibold tabular-nums tracking-tighter text-zinc-900">
        {value}
      </h3>
    </div>
  );
};

export default ResponderDashboard;