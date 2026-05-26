import React, { useState } from "react";
import { NavLink } from "react-router-dom";
import {
  LayoutDashboard, AlertTriangle, Video, Settings,
  LogOut, ChevronLeft, ChevronRight, BarChart2
} from "lucide-react";

const SuperResponderSidebar = ({ user }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const handleLogout = () => {
    localStorage.removeItem("user");
    window.location.href = "/login";
  };

  const menuItems = [
    { name: "Command Center", icon: <LayoutDashboard size={20} />, path: "/super-responder/dashboard" },
    { name: "Incident Queue", icon: <AlertTriangle size={20} />, path: "/super-responder/incidents" },
    { name: "CCTV Monitor", icon: <Video size={20} />, path: "/super-responder/cctv" },
    { name: "Analytics", icon: <BarChart2 size={20} />, path: "/super-responder/analytics" },
    { name: "Settings", icon: <Settings size={20} />, path: "/super-responder/settings" },
  ];

  return (
    <div className={`h-full bg-slate-950 border-r border-slate-800 flex flex-col transition-all duration-300 ${isCollapsed ? "w-20" : "w-64"} overflow-hidden flex-shrink-0`}>
      {/* Header */}
      <div className="p-5 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full overflow-hidden flex items-center justify-center bg-white/10 border-2 border-white/20 flex-shrink-0">
            <img src="/safecityplus.png" alt="SafeCity+" className="w-full h-full object-cover" />
          </div>
          {!isCollapsed && (
            <div>
              <h1 className="text-base font-bold text-white leading-tight">SafeCity+</h1>
              <p className="text-[10px] text-red-400 font-semibold tracking-wide">COMMAND CENTER</p>
            </div>
          )}
        </div>
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="p-1.5 text-slate-500 hover:text-white hover:bg-slate-800 rounded-lg transition-all"
        >
          {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      {/* User badge */}
      {!isCollapsed && (
        <div className="mx-3 mt-3 mb-1 px-3 py-2.5 bg-red-950/40 border border-red-900/40 rounded-xl">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-gradient-to-br from-red-500 to-orange-400 rounded-lg flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
              {user?.fullName?.charAt(0) || "S"}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-white truncate">{user?.fullName || "Super Responder"}</p>
              <p className="text-[9px] text-red-400 font-bold">⬛ SUPER RESPONDER</p>
            </div>
            <span className="ml-auto w-2 h-2 bg-emerald-400 rounded-full flex-shrink-0" />
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 p-3 overflow-y-auto">
        <div className="space-y-1">
          {menuItems.map((item) => (
            <NavLink
              key={item.name}
              to={item.path}
              className={({ isActive }) =>
                `group relative flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200 overflow-hidden
                 ${isActive
                   ? "bg-red-950/60 text-red-300 border border-red-800/50"
                   : "text-slate-400 hover:text-slate-100 hover:bg-slate-800/60"
                 }`
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 bg-red-400 rounded-r-full" />}
                  <div className={`transition-all duration-200 group-hover:scale-110 flex-shrink-0 ${isActive ? 'text-red-400' : 'group-hover:text-red-400'}`}>
                    {item.icon}
                  </div>
                  {!isCollapsed && <span className="font-medium text-sm">{item.name}</span>}
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>

      {/* Logout */}
      <div className="p-3 border-t border-slate-800">
        <button
          onClick={handleLogout}
          className="group flex items-center gap-3 w-full px-3 py-3 text-slate-500 hover:text-red-300 hover:bg-red-950/40 rounded-xl transition-all duration-200"
        >
          <LogOut size={18} className="group-hover:scale-110 transition-transform flex-shrink-0" />
          {!isCollapsed && <span className="font-medium text-sm">Logout</span>}
        </button>
      </div>
    </div>
  );
};

export default SuperResponderSidebar;
