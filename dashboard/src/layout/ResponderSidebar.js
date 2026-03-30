// src/layout/ResponderSidebar.js
import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { 
  LayoutDashboard, 
  List, 
  Video, 
  Settings, 
  LogOut,
  ChevronLeft,
  ChevronRight
} from "lucide-react";

const ResponderSidebar = ({ activeTab, setActiveTab, user }) => {
  const navigate = useNavigate();
  const [isCollapsed, setIsCollapsed] = useState(() => {
    const saved = localStorage.getItem("responderSidebarCollapsed");
    return saved ? JSON.parse(saved) : false;
  });

  useEffect(() => {
    localStorage.setItem("responderSidebarCollapsed", JSON.stringify(isCollapsed));
  }, [isCollapsed]);

  const menuItems = [
    { name: "Dashboard", icon: <LayoutDashboard size={20} />, path: "/responder/dashboard" },
    { name: "Assigned Incidents", icon: <List size={20} />, path: "/responder/incidents" },
    { name: "CCTV Feed", icon: <Video size={20} />, path: "/responder/cctv" },
    { name: "Settings", icon: <Settings size={20} />, path: "/responder/settings" },
    { name: "Logout", icon: <LogOut size={20} />, path: "/logout", isLogout: true },
  ];

  const handleItemClick = (item) => {
    if (setActiveTab) setActiveTab(item.name.toLowerCase());
    if (item.isLogout) {
      localStorage.removeItem("user");
      navigate("/login");
    }
  };

  return (
    <div 
      className={`h-full bg-blue-50 border-r border-blue-200 flex flex-col transition-all duration-300 shadow-sm
                  ${isCollapsed ? "w-20" : "w-64"} overflow-hidden`}
      role="navigation"
      aria-label="Responder navigation"
    >
      {/* Header */}
      <div className="p-6 border-b border-blue-100 bg-blue-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {!isCollapsed && (
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-blue-900">Responder</h1>
              <p className="text-xs text-blue-700 -mt-1">Field Operations</p>
            </div>
          )}
          {isCollapsed && (
            <span className="text-2xl font-bold text-blue-600" aria-hidden="true">R</span>
          )}
        </div>

        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-expanded={!isCollapsed}
          className="hidden md:block p-2 text-blue-600 hover:text-blue-700 hover:bg-blue-200 rounded-xl transition-all active:scale-95 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {isCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
        </button>
      </div>

      
      {/* Navigation Menu */}
      <nav className="flex-1 p-3 overflow-y-auto bg-blue-50" id="sidebar-menu">
        <div className="space-y-1" role="list">
          {menuItems.map((item) => (
            <Link
              key={item.name}
              to={item.path}
              onClick={(e) => {
                handleItemClick(item);
                if (item.isLogout) e.preventDefault();
              }}
              className={`group relative flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all duration-200 overflow-hidden focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2
                ${activeTab === item.name.toLowerCase() && !item.isLogout
                  ? "bg-white text-blue-900 shadow-sm font-semibold border-l-4 border-blue-600" 
                  : item.isLogout 
                    ? "text-red-600 hover:text-red-700 hover:bg-red-50" 
                    : "text-zinc-800 hover:text-blue-900 hover:bg-white"
                }`}
              aria-current={activeTab === item.name.toLowerCase() && !item.isLogout ? "page" : undefined}
            >
              {/* Left Accent Bar */}
              {activeTab === item.name.toLowerCase() && !item.isLogout && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-blue-600 rounded-r-full" />
              )}

              {/* Icon */}
              <div 
                className={`transition-all duration-200 flex-shrink-0
                  ${activeTab === item.name.toLowerCase() && !item.isLogout 
                    ? "text-blue-600" 
                    : "group-hover:text-blue-600"}`}
                aria-hidden="true"
              >
                {item.icon}
              </div>

              {/* Text - Now clearly visible */}
              {!isCollapsed && (
                <span className="font-medium transition-all duration-200 group-hover:pl-1">
                  {item.name}
                </span>
              )}

              {/* Hover Glow */}
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none rounded-2xl" />
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
};

export default ResponderSidebar;