// src/layout/AdminSidebar.js
import React, { useState } from "react";
import { NavLink } from "react-router-dom";
import { 
  LayoutDashboard, 
  List, 
  Users, 
  BarChart3, 
  Map, 
  Video, 
  Settings, 
  LogOut,
  ChevronLeft,
  ChevronRight
} from "lucide-react";

const AdminSidebar = ({ user, onClose }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const handleLogout = () => {
    localStorage.removeItem("user");
    window.location.href = "/login";
  };

  const menuItems = [
    { name: "Dashboard", icon: <LayoutDashboard size={20} />, path: "/admin/dashboard" },
    { name: "Incident Logs", icon: <List size={20} />, path: "/admin/incidents" },
    { name: "Users", icon: <Users size={20} />, path: "/admin/users" },
    { name: "Responder Control", icon: <Users size={20} />, path: "/admin/responders" },
    { name: "Analytics", icon: <BarChart3 size={20} />, path: "/admin/analytics" },
    { name: "Heatmap", icon: <Map size={20} />, path: "/admin/heatmap" },
    { name: "CCTV Feed", icon: <Video size={20} />, path: "/admin/cctv" },
    { name: "Settings", icon: <Settings size={20} />, path: "/admin/settings" },
  ];

  return (
    <div className={`h-full bg-zinc-900 border-r border-zinc-800 flex flex-col transition-all duration-300
                    ${isCollapsed ? "w-20" : "w-64"} overflow-hidden`}>
      
      {/* Header */}
      <div className="p-6 border-b border-zinc-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {!isCollapsed && (
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white">SafeCity+</h1>
              <p className="text-xs text-zinc-500 -mt-1">Admin Portal</p>
            </div>
          )}
          {isCollapsed && (
            <span className="text-2xl font-bold text-indigo-500">SC</span>
          )}
        </div>

        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="hidden md:block p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-xl transition-all active:scale-95"
        >
          {isCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
        </button>
      </div>

      {/* User Profile */}
      <div className="p-6 border-b border-zinc-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-2xl flex items-center justify-center text-lg font-semibold ring-2 ring-zinc-700 flex-shrink-0 transition-transform hover:scale-110">
            {user?.fullName?.charAt(0) || "A"}
          </div>
          {!isCollapsed && (
            <div className="min-w-0">
              <p className="font-medium text-white truncate">{user?.fullName || "Administrator"}</p>
              <p className="text-xs text-emerald-400">● Online</p>
            </div>
          )}
        </div>
      </div>

      {/* Navigation Menu */}
      <nav className="flex-1 p-3 overflow-y-auto">
        <div className="space-y-1">
          {menuItems.map((item) => (
            <NavLink
              key={item.name}
              to={item.path}
              onClick={onClose}
              className={({ isActive }) =>
                `group relative flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all duration-200 overflow-hidden
                 ${isActive 
                   ? "bg-zinc-800 text-white shadow-md" 
                   : "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/60"
                 }`
              }
            >
              {/* Left Accent Bar for Active State */}
              {({ isActive }) => (
                <>
                  {isActive && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-indigo-500 rounded-r-full transition-all" />
                  )}

                  {/* Icon with Hover Animation */}
                  <div className="transition-all duration-200 group-hover:scale-110 group-hover:text-indigo-400 flex-shrink-0">
                    {item.icon}
                  </div>

                  {/* Text with Slide-in Effect */}
                  {!isCollapsed && (
                    <span className="font-medium transition-all duration-200 group-hover:pl-1">
                      {item.name}
                    </span>
                  )}

                  {/* Subtle Hover Glow Layer */}
                  <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none rounded-2xl" />
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>

      {/* Logout Button with Stronger Hover Feedback */}
      <div className="p-4 border-t border-zinc-800 mt-auto">
        <button
          onClick={handleLogout}
          className="group relative flex items-center gap-3 w-full px-4 py-3.5 text-red-400 hover:text-red-300 
                     hover:bg-red-950/70 rounded-2xl transition-all duration-200 overflow-hidden active:scale-[0.985]"
        >
          <div className="transition-all duration-200 group-hover:scale-110">
            <LogOut size={20} />
          </div>
          {!isCollapsed && (
            <span className="font-medium transition-all duration-200 group-hover:pl-1">Logout</span>
          )}

          {/* Hover Glow for Logout */}
          <div className="absolute inset-0 bg-gradient-to-r from-red-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-2xl pointer-events-none" />
        </button>
      </div>
    </div>
  );
};

export default AdminSidebar;