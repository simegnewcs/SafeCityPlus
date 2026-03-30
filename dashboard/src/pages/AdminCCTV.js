// src/pages/AdminCCTV.js
import React, { useState } from "react";
import AdminSidebar from "../layout/AdminSidebar";
import { Play, Pause, Volume2, Maximize2, RefreshCw, Settings, Camera } from "lucide-react";

const AdminCCTV = () => {
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const [selectedCamera, setSelectedCamera] = useState(null);

  const cameras = [
    { id: 1, name: "Main Entrance", location: "Gate A", status: "live", fps: "30" },
    { id: 2, name: "Parking Area", location: "Zone B", status: "live", fps: "25" },
    { id: 3, name: "Lobby", location: "Building 1", status: "offline", fps: "—" },
    { id: 4, name: "Perimeter Wall", location: "North Side", status: "live", fps: "30" },
    { id: 5, name: "Emergency Exit", location: "Rear", status: "live", fps: "28" },
    { id: 6, name: "Rooftop", location: "Tower", status: "offline", fps: "—" },
  ];

  return (
    <div className="flex h-screen bg-zinc-50 text-zinc-900 overflow-hidden">
      <AdminSidebar user={user} />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Navbar - Light Theme */}
        <header className="h-16 bg-white border-b border-zinc-200 px-8 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-4">
            <Camera className="w-7 h-7 text-emerald-600" />
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">CCTV Surveillance</h1>
              <p className="text-sm text-zinc-500">Monitor live feeds across the city</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button className="flex items-center gap-2 px-5 py-2 bg-white border border-zinc-300 hover:border-emerald-300 rounded-2xl text-sm font-medium transition-all hover:shadow">
              <RefreshCw size={18} className="text-emerald-600" />
              Refresh Feeds
            </button>
            <button className="p-3 hover:bg-zinc-100 rounded-2xl transition-all">
              <Settings size={20} className="text-zinc-600" />
            </button>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 p-6 md:p-8 overflow-auto bg-zinc-50">
          {/* Status Bar */}
          <div className="flex flex-col sm:flex-row gap-4 mb-8 items-center justify-between bg-white p-4 rounded-3xl border border-zinc-100 shadow-sm">
            <div className="flex items-center gap-8 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse"></div>
                <span className="font-medium text-emerald-700">4 Cameras LIVE</span>
              </div>
              <div className="text-zinc-500">2 Cameras OFFLINE</div>
            </div>

            <div className="text-xs text-zinc-500 font-mono">Last updated: Just now</div>
          </div>

          {/* CCTV Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {cameras.map((camera) => (
              <div
                key={camera.id}
                onClick={() => setSelectedCamera(camera)}
                className="group relative bg-white border border-zinc-200 rounded-3xl overflow-hidden shadow hover:shadow-xl transition-all duration-300 cursor-pointer hover:-translate-y-1"
              >
                {/* Video Feed Area */}
                <div className="relative aspect-video bg-zinc-950 flex items-center justify-center overflow-hidden">
                  {/* Subtle static/noise for realism */}
                  <div className="absolute inset-0 bg-[radial-gradient(#444_0.8px,transparent_1px)] bg-[length:3px_3px] opacity-40"></div>

                  {camera.status === "live" ? (
                    <>
                      {/* Live Indicator */}
                      <div className="absolute top-4 left-4 flex items-center gap-1.5 bg-black/70 text-white text-xs px-3 py-1 rounded-full font-medium">
                        <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                        LIVE
                      </div>

                      <div className="flex flex-col items-center justify-center text-white/70 group-hover:text-white transition-colors">
                        <Play className="w-14 h-14 mb-2" />
                        <p className="text-xs tracking-widest">CAMERA FEED</p>
                      </div>
                    </>
                  ) : (
                    <div className="text-center text-white/50">
                      <Camera className="w-16 h-16 mx-auto mb-3 opacity-40" />
                      <p className="font-medium">OFFLINE</p>
                    </div>
                  )}

                  {/* Camera Info Overlay */}
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-5">
                    <p className="text-white font-semibold text-lg">{camera.name}</p>
                    <p className="text-emerald-300 text-sm">{camera.location}</p>
                  </div>

                  {/* FPS Badge */}
                  <div className="absolute top-4 right-4 bg-black/70 text-white text-[10px] px-2.5 py-0.5 rounded font-mono tracking-wider">
                    {camera.fps} FPS
                  </div>
                </div>

                {/* Bottom Bar with Accent Colors */}
                <div className="p-4 flex items-center justify-between border-t border-zinc-100">
                  <div>
                    <p className={`text-xs font-medium ${camera.status === "live" ? "text-emerald-600" : "text-amber-600"}`}>
                      {camera.status.toUpperCase()}
                    </p>
                  </div>

                  {/* Hover Action Buttons */}
                  <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button className="p-2 hover:bg-emerald-50 text-emerald-600 rounded-xl transition-colors">
                      <Play size={18} />
                    </button>
                    <button className="p-2 hover:bg-sky-50 text-sky-600 rounded-xl transition-colors">
                      <Volume2 size={18} />
                    </button>
                    <button className="p-2 hover:bg-zinc-100 text-zinc-600 rounded-xl transition-colors">
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