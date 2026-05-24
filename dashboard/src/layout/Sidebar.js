import React from 'react';
import { LayoutDashboard, History, Settings, LogOut } from 'lucide-react';

const Sidebar = ({ activeTab, setActiveTab }) => {
  const menus = [
    { id: 'dashboard', name: 'Dashboard', icon: <LayoutDashboard size={20} /> },
    { id: 'history', name: 'Incident Logs', icon: <History size={20} /> },
    { id: 'settings', name: 'Settings', icon: <Settings size={20} /> },
  ];

  return (
    <div className="w-64 bg-[#0f172a] h-screen text-slate-300 p-6 fixed left-0 top-0 shadow-2xl z-50 flex flex-col">
      <div className="mb-12 flex items-center gap-3 px-2">
        <div className="w-10 h-10 rounded-full overflow-hidden flex items-center justify-center bg-white/10 border-2 border-white/20">
          <img src="/safecityplus.png" alt="SafeCity+" className="w-full h-full object-cover" />
        </div>
        <div>
          <h2 className="text-xl font-black text-white tracking-tight">SafeCity+</h2>
          <p className="text-[10px] text-blue-400 font-bold uppercase tracking-widest">Safe City Plus</p>
        </div>
      </div>

      <nav className="flex-1">
        {menus.map((menu) => (
          <button
            key={menu.id}
            onClick={() => setActiveTab(menu.id)}
            className={`w-full flex items-center gap-4 p-3.5 mb-3 rounded-xl transition-all duration-300 group ${
              activeTab === menu.id 
              ? 'bg-blue-600 text-white shadow-xl shadow-blue-600/20' 
              : 'hover:bg-slate-800 hover:text-white'
            }`}
          >
            <span className={`${activeTab === menu.id ? 'text-white' : 'text-slate-500 group-hover:text-blue-400'}`}>
              {menu.icon}
            </span>
            <span className="font-semibold text-sm tracking-wide">{menu.name}</span>
          </button>
        ))}
      </nav>

      <div className="pt-6 border-t border-slate-800">
        <button className="flex items-center gap-4 p-3 w-full text-slate-500 hover:text-red-400 transition-colors text-sm font-medium">
          <LogOut size={20} />
          Logout
        </button>
      </div>
    </div>
  );
};

export default Sidebar;