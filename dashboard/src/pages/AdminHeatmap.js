// src/pages/AdminHeatmap.js
import React from "react";
import AdminSidebar from "../layout/AdminSidebar";
import MapView from "../components/MapView";
import { useSocket } from "../hooks/useSocket";
import { ThermometerSun, Layers, Eye, RefreshCw } from "lucide-react";

const AdminHeatmap = () => {
  const incidents = useSocket();
  const user = JSON.parse(localStorage.getItem("user") || "{}");

  return (
    <div className="flex h-screen bg-zinc-50 text-zinc-900 overflow-hidden">
      <AdminSidebar user={user} />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Navbar */}
        <header className="h-16 bg-white border-b border-zinc-200 px-6 md:px-8 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-4">
            <ThermometerSun className="w-7 h-7 text-emerald-600" />
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Incident Heatmap</h1>
              <p className="text-sm text-zinc-500">Visual density of incidents across the city</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button className="flex items-center gap-2 px-5 py-2.5 bg-white border border-zinc-300 hover:border-emerald-400 rounded-2xl text-sm font-medium transition-all">
              <RefreshCw size={18} className="text-emerald-600" />
              Refresh Map
            </button>
            <button className="flex items-center gap-2 px-5 py-2.5 bg-white border border-zinc-300 hover:border-sky-400 rounded-2xl text-sm font-medium transition-all">
              <Layers size={18} className="text-sky-600" />
              Toggle Layers
            </button>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 p-6 md:p-8 overflow-auto flex flex-col">
          {/* Controls Bar */}
          <div className="bg-white rounded-3xl shadow-sm border border-zinc-100 p-5 mb-6 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div>
              <p className="text-sm font-medium text-zinc-700">
                Showing <span className="text-emerald-600 font-semibold">{incidents.length}</span> incidents
              </p>
              <p className="text-xs text-zinc-500">Darker areas indicate higher incident density</p>
            </div>

            <div className="flex items-center gap-6 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-emerald-500 rounded-full"></div>
                <span>Low Density</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-amber-500 rounded-full"></div>
                <span>Medium</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                <span>High Density</span>
              </div>
            </div>
          </div>

          {/* Heatmap Container */}
          <div className="flex-1 bg-white rounded-3xl shadow-sm border border-zinc-100 overflow-hidden flex flex-col">
            <div className="p-6 border-b border-zinc-100 flex items-center justify-between bg-zinc-50">
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-semibold">Live Incident Heatmap</h2>
                <span className="px-3 py-1 text-xs font-medium bg-emerald-100 text-emerald-700 rounded-2xl">HEATMAP MODE</span>
              </div>
              
              <button className="flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-700 transition-colors">
                <Eye size={18} />
                Toggle Markers
              </button>
            </div>

            {/* Map Area */}
            <div className="flex-1 p-4 relative">
              <div className="w-full h-full rounded-2xl overflow-hidden border border-zinc-100 shadow-inner">
                <MapView incidents={incidents} />
              </div>
            </div>
          </div>

          {/* Legend / Info Footer */}
          <div className="mt-6 text-xs text-zinc-500 text-center">
            Heatmap shows concentration of incidents • Zoom and pan to explore hotspots
          </div>
        </main>
      </div>
    </div>
  );
};

export default AdminHeatmap;