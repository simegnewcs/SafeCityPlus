// src/layout/AdminSidebar.js
import React, { useState, useEffect } from "react";
import { NavLink } from "react-router-dom";
import { 
  LayoutDashboard, 
  List, 
  Users, 
  BarChart3, 
  Map, 
  Video, 
  Phone,
  Settings, 
  LogOut,
  ChevronLeft,
  ChevronRight,
  Menu
} from "lucide-react";

const AdminSidebar = ({ user, onClose }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Check screen size and set mobile state
  useEffect(() => {
    const checkScreenSize = () => {
      const mobile = window.innerWidth < 768; // md breakpoint
      setIsMobile(mobile);
      // Auto-collapse on mobile when entering mobile mode
      if (mobile) {
        setIsCollapsed(true);
      }
    };

    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

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
    { name: "Contacts", icon: <Phone size={20} />, path: "/admin/contacts" },
    { name: "Settings", icon: <Settings size={20} />, path: "/admin/settings" },
  ];

  return (
    <>
      {/* Mobile Menu Toggle Button */}
      {isMobile && (
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="md:hidden fixed top-4 left-4 z-50 p-3 bg-zinc-900 text-white border border-zinc-700 rounded-xl shadow-lg hover:bg-zinc-800 transition-all active:scale-95"
        >
          {isCollapsed ? <Menu size={20} /> : <ChevronLeft size={20} />}
        </button>
      )}
      
      {/* Sidebar */}
      <div className={`h-full bg-zinc-900 border-r border-zinc-800 flex flex-col transition-all duration-300 fixed md:relative z-40
                      ${isCollapsed ? "w-20" : "w-64"} 
                      ${isMobile ? (isCollapsed ? "-translate-x-full" : "translate-x-0") : "translate-x-0"}
                      overflow-hidden`}>
        
        {/* Header */}
        <div className="p-4 md:p-6 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 md:w-9 md:h-9 rounded-full overflow-hidden flex items-center justify-center bg-white/10 border-2 border-white/20 flex-shrink-0">
              <img src="/safecityplus.png" alt="SafeCity+" className="w-full h-full object-cover" />
            </div>
            {!isCollapsed && (
              <div className="hidden md:block">
                <h1 className="text-xl md:text-2xl font-bold tracking-tight text-white">SafeCity+</h1>
                <p className="text-xs text-zinc-500 -mt-1">Admin Portal</p>
              </div>
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
      {/* <div className="p-6 border-b border-zinc-800">
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
      </div> */}

      {/* Navigation Menu */}
        <nav className="flex-1 p-2 md:p-3 overflow-y-auto">
          <div className="space-y-1">
            {menuItems.map((item) => (
              <NavLink
                key={item.name}
                to={item.path}
                onClick={() => {
                  if (onClose) onClose();
                  // Close mobile sidebar after navigation
                  if (isMobile) {
                    setIsCollapsed(true);
                  }
                }}
                className={({ isActive }) =>
                  `group relative flex items-center gap-3 px-3 md:px-4 py-3 md:py-3.5 rounded-2xl transition-all duration-200 overflow-hidden
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

                    {/* Text with Slide-in Effect - Hidden on mobile when collapsed */}
                    {!isCollapsed && (
                      <span className="font-medium transition-all duration-200 group-hover:pl-1 hidden md:block">
                        {item.name}
                      </span>
                    )}

                    {/* Tooltip for mobile when collapsed */}
                    {isMobile && isCollapsed && (
                      <div className="absolute left-full ml-2 px-2 py-1 bg-zinc-800 text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                        {item.name}
                      </div>
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
        <div className="p-3 md:p-4 border-t border-zinc-800 mt-auto">
          <button
            onClick={handleLogout}
            className="group relative flex items-center gap-3 w-full px-3 md:px-4 py-3 md:py-3.5 text-red-400 hover:text-red-300 
                       hover:bg-red-950/70 rounded-2xl transition-all duration-200 overflow-hidden active:scale-[0.985]"
          >
            <div className="transition-all duration-200 group-hover:scale-110">
              <LogOut size={20} />
            </div>
            {!isCollapsed && (
              <span className="font-medium transition-all duration-200 group-hover:pl-1 hidden md:block">Logout</span>
            )}

            {/* Tooltip for mobile when collapsed */}
            {isMobile && isCollapsed && (
              <div className="absolute left-full ml-2 px-2 py-1 bg-zinc-800 text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                Logout
              </div>
            )}

            {/* Hover Glow for Logout */}
            <div className="absolute inset-0 bg-gradient-to-r from-red-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-2xl pointer-events-none" />
          </button>
        </div>
      </div>

      {/* Mobile Overlay */}
      {isMobile && !isCollapsed && (
        <div
          className="fixed inset-0 bg-black/50 z-30 md:hidden"
          onClick={() => setIsCollapsed(true)}
        />
      )}
    </>
  );
};

export default AdminSidebar;