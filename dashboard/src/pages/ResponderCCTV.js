// src/pages/AdminCCTV.js
import React, { useState } from "react";
import AdminSidebar from "../layout/AdminSidebar";
import { 
  Play, Pause, Volume2, VolumeX, Maximize2, 
  RefreshCw, Settings, Filter, Grid, List 
} from "lucide-react";

const AdminCCTV = () => {
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const [selectedCamera, setSelectedCamera] = useState(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [viewMode, setViewMode] = useState("grid"); // "grid" or "list"
  const [filter, setFilter] = useState("all");

  // Mock camera data (replace with real API later)
  const cameras = [
    { 
      id: 1, 
      name: "Main Entrance", 
      location: "Gate A", 
      status: "live", 
      fps: "30", 
      lastUpdated: "2s ago",
      priority: "high"
    },
    { 
      id: 2, 
      name: "Parking Area", 
      location: "Zone B", 
      status: "live", 
      fps: "25", 
      lastUpdated: "5s ago",
      priority: "medium"
    },
    { 
      id: 3, 
      name: "Lobby", 
      location: "Building 1", 
      status: "offline", 
      fps: "—", 
      lastUpdated: "12m ago",
      priority: "low"
    },
    { 
      id: 4, 
      name: "Perimeter Wall", 
      location: "North Side", 
      status: "live", 
      fps: "30", 
      lastUpdated: "1s ago",
      priority: "high"
    },
    { 
      id: 5, 
      name: "Emergency Exit", 
      location: "Rear Gate", 
      status: "live", 
      fps: "28", 
      lastUpdated: "8s ago",
      priority: "medium"
    },
    { 
      id: 6, 
      name: "Rooftop", 
      location: "Tower", 
      status: "offline", 
      fps: "—", 
      lastUpdated: "45m ago",
      priority: "low"
    },
  ];

  const filteredCameras = filter === "all" 
    ? cameras 
    : cameras.filter(cam => cam.status === filter);

  const handleCameraClick = (camera) => {
    setSelectedCamera(camera);
    // In real app, this could open a modal with full-screen feed
  };

  return (
    <div className="flex h-screen bg-zinc-50 overflow-hidden">
      <AdminSidebar user={user} />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Navbar */}
        <header className="h-16 bg-white border-b border-zinc-200 px-6 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-blue-600 rounded-xl flex items-center justify-center">
                <span className="text-white text-xl">📹</span>
              </div>
              <div>
                <h1 className="text-2xl font-semibold tracking-tight">CCTV Surveillance</h1>
                <p className="text-xs text-zinc-500">6 Cameras • Real-time Monitoring</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button 
              onClick={() => window.location.reload()}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-zinc-300 hover:border-blue-400 rounded-2xl text-sm transition-all"
            >
              <RefreshCw size={18} className="text-blue-600" />
              Refresh All
            </button>

            <div className="flex border border-zinc-200 rounded-2xl overflow-hidden">
              <button 
                onClick={() => setViewMode("grid")}
                className={`px-4 py-2 text-sm ${viewMode === 'grid' ? 'bg-blue-600 text-white' : 'hover:bg-zinc-100'}`}
              >
                <Grid size={18} />
              </button>
              <button 
                onClick={() => setViewMode("list")}
                className={`px-4 py-2 text-sm ${viewMode === 'list' ? 'bg-blue-600 text-white' : 'hover:bg-zinc-100'}`}
              >
                <List size={18} />
              </button>
            </div>
          </div>
        </header>

        {/* Controls Bar */}
        <div className="bg-white border-b border-zinc-200 px-6 py-4 flex flex-wrap gap-4 items-center">
          <div className="flex items-center gap-2">
            <span className="text-sm text-zinc-500">Filter:</span>
            <select 
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="bg-white border border-zinc-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-blue-500"
            >
              <option value="all">All Cameras</option>
              <option value="live">Live Only</option>
              <option value="offline">Offline</option>
            </select>
          </div>

          <div className="ml-auto flex items-center gap-3 text-sm text-zinc-500">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span>4 Live</span>
            </div>
            <div>2 Offline</div>
          </div>
        </div>

        {/* CCTV Grid */}
        <main className="flex-1 p-6 overflow-auto">
          <div className={`grid gap-6 ${viewMode === 'grid' 
            ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" 
            : "grid-cols-1"}`}>
            
            {filteredCameras.map((camera) => (
              <div 
                key={camera.id}
                onClick={() => handleCameraClick(camera)}
                className="bg-white border border-zinc-200 rounded-3xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 cursor-pointer group"
              >
                {/* Video Feed Area */}
                <div className="relative aspect-video bg-zinc-950 flex items-center justify-center overflow-hidden">
                  <div className="absolute inset-0 bg-[radial-gradient(#333_1px,transparent_1px)] bg-[length:4px_4px] opacity-30"></div>
                  
                  {camera.status === "live" ? (
                    <>
                      <div className="absolute top-4 left-4 px-3 py-1 bg-red-600 text-white text-xs font-medium rounded-full flex items-center gap-1.5 z-10">
                        <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                        LIVE
                      </div>
                      <Play className="w-16 h-16 text-white/70 group-hover:text-white transition-colors z-10" />
                    </>
                  ) : (
                    <div className="text-center text-zinc-400">
                      <div className="text-6xl mb-3 opacity-40">📹</div>
                      <p className="font-medium">OFFLINE</p>
                    </div>
                  )}

                  {/* Camera Info Overlay */}
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent p-5">
                    <p className="text-white font-semibold text-lg">{camera.name}</p>
                    <p className="text-blue-300 text-sm">{camera.location}</p>
                  </div>

                  {/* FPS & Status */}
                  <div className="absolute top-4 right-4 bg-black/70 text-white text-xs px-3 py-1 rounded-xl font-mono">
                    {camera.fps} FPS
                  </div>
                </div>

                {/* Footer Controls */}
                <div className="p-5 flex items-center justify-between">
                  <div>
                    <p className={`text-xs font-medium ${camera.status === "live" ? "text-emerald-600" : "text-amber-600"}`}>
                      {camera.status.toUpperCase()}
                    </p>
                    <p className="text-xs text-zinc-500 mt-0.5">{camera.lastUpdated}</p>
                  </div>

                  <div className="flex gap-2">
                    <button className="p-2.5 hover:bg-blue-50 text-blue-600 rounded-2xl transition-colors">
                      <Play size={18} />
                    </button>
                    <button 
                      onClick={(e) => { e.stopPropagation(); setIsMuted(!isMuted); }}
                      className="p-2.5 hover:bg-blue-50 text-blue-600 rounded-2xl transition-colors"
                    >
                      {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
                    </button>
                    <button className="p-2.5 hover:bg-blue-50 text-blue-600 rounded-2xl transition-colors">
                      <Maximize2 size={18} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </main>
      </div>
    </div>
  );
};

export default AdminCCTV;