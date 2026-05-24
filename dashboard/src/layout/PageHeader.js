// src/layout/PageHeader.js
import React, { useState, useEffect } from "react";
import { Bell, RefreshCw, Menu, X } from "lucide-react";

const PageHeader = ({ title, subtitle, icon, onRefresh, loading, pendingCount, user, onMenuToggle, menuOpen }) => {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const tick = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(tick);
  }, []);

  return (
    <header className="h-16 bg-white/80 backdrop-blur border-b border-slate-200 px-6 flex items-center justify-between z-40 sticky top-0 shadow-sm">
      <div className="flex items-center gap-4">
        {onMenuToggle && (
          <button onClick={onMenuToggle}
            className="md:hidden p-2 hover:bg-slate-100 rounded-xl transition-colors">
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        )}
        <div className="flex items-center gap-3">
          {icon && (
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-sky-500 flex items-center justify-center text-white shadow-md flex-shrink-0">
              {icon}
            </div>
          )}
          <div>
            <h1 className="text-lg font-bold tracking-tight text-slate-900 leading-none">{title}</h1>
            <p className="text-[11px] text-slate-400 mt-0.5 font-medium">
              {subtitle || (
                <>
                  {now.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}
                  &nbsp;&mdash;&nbsp;{now.toLocaleTimeString()}
                </>
              )}
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {/* Live pill */}
        <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-full mr-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span className="text-xs font-semibold text-emerald-700">Live</span>
        </div>

        {onRefresh && (
          <button onClick={onRefresh}
            className="p-2 hover:bg-slate-100 rounded-xl transition-all text-slate-500 hover:text-slate-800">
            <RefreshCw size={18} className={loading ? "animate-spin text-indigo-500" : ""} />
          </button>
        )}

        <button className="relative p-2 hover:bg-slate-100 rounded-xl transition-all text-slate-500 hover:text-slate-800">
          <Bell size={18} />
          {pendingCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-rose-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
              {pendingCount > 9 ? "9+" : pendingCount}
            </span>
          )}
        </button>

        <div className="flex items-center gap-3 pl-3 ml-1 border-l border-slate-200">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-semibold text-slate-800 leading-none">{user?.fullName || "Admin"}</p>
            <p className="text-[11px] text-emerald-600 mt-0.5 font-medium">● Online</p>
          </div>
          <div className="w-9 h-9 bg-gradient-to-br from-indigo-500 to-sky-400 rounded-xl flex items-center justify-center font-bold text-white text-sm shadow-md">
            {user?.fullName?.charAt(0)?.toUpperCase() || "A"}
          </div>
        </div>
      </div>
    </header>
  );
};

export default PageHeader;
