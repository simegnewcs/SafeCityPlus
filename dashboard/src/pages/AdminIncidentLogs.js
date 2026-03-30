// src/pages/AdminIncidentLogs.js
import React, { useState, useMemo } from "react";
import AdminSidebar from "../layout/AdminSidebar";
import { useSocket } from "../hooks/useSocket";
import IncidentTable from "../components/IncidentTable";
import { Search, Filter, RefreshCw } from "lucide-react";

const AdminIncidentLogs = () => {
  const incidents = useSocket();
  const user = JSON.parse(localStorage.getItem("user") || "{}");

  const [typeFilter, setTypeFilter] = useState("All");
  const [priorityFilter, setPriorityFilter] = useState("All");
  const [searchTerm, setSearchTerm] = useState("");

  // Compute unique types
  const types = useMemo(() => {
    const customTypes = ["Fire", "Car Accident", "Electricity"];
    const typeSet = new Set([
      ...incidents.map((i) => i.ai_type || "Unknown"),
      ...customTypes,
    ]);

    const allTypes = ["All"];
    const middleTypes = Array.from(typeSet)
      .filter((t) => t !== "Unknown")
      .sort();
    allTypes.push(...middleTypes);
    if (typeSet.has("Unknown")) allTypes.push("Unknown");

    return allTypes;
  }, [incidents]);

  // Compute unique priorities
  const priorities = useMemo(() => {
    const customPriorities = ["High", "Normal", "Critical"];
    const prioritySet = new Set([
      ...incidents.map((i) => i.ai_priority || "Unknown"),
      ...customPriorities,
    ]);

    const allPriorities = ["All"];
    const middlePriorities = Array.from(prioritySet)
      .filter((p) => p !== "Unknown")
      .sort();
    allPriorities.push(...middlePriorities);
    if (prioritySet.has("Unknown")) allPriorities.push("Unknown");

    return allPriorities;
  }, [incidents]);

  // Filtered incidents with search
  const filteredIncidents = useMemo(() => {
    return incidents.filter((inc) => {
      const type = inc.ai_type || "Unknown";
      const priority = inc.ai_priority || "Unknown";
      const searchString = `${inc.ai_type} ${inc.ai_priority} ${inc.location || ""}`.toLowerCase();

      const typeMatch = typeFilter === "All" || type === typeFilter;
      const priorityMatch = priorityFilter === "All" || priority === priorityFilter;
      const searchMatch = searchTerm === "" || searchString.includes(searchTerm.toLowerCase());

      return typeMatch && priorityMatch && searchMatch;
    });
  }, [incidents, typeFilter, priorityFilter, searchTerm]);

  return (
    <div className="flex h-screen bg-zinc-50 text-zinc-900 overflow-hidden">
      <AdminSidebar user={user} />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Navbar */}
        <header className="h-16 bg-white border-b border-zinc-200 px-8 flex items-center justify-between shadow-sm">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Incident Logs</h1>
            <p className="text-sm text-zinc-500">Real-time records • {filteredIncidents.length} incidents</p>
          </div>

          <button className="flex items-center gap-2 px-5 py-2 bg-white border border-zinc-300 hover:border-emerald-300 rounded-2xl text-sm font-medium transition-all">
            <RefreshCw size={18} className="text-emerald-600" />
            Refresh
          </button>
        </header>

        {/* Main Content */}
        <main className="flex-1 p-6 md:p-8 overflow-auto">
          {/* Filters Section */}
          <div className="bg-white rounded-3xl shadow-sm border border-zinc-100 p-6 mb-8">
            <div className="flex flex-col lg:flex-row gap-6">
              {/* Search Bar */}
              <div className="flex-1">
                <label className="block text-sm font-medium text-zinc-600 mb-2">Search Incidents</label>
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={20} />
                  <input
                    type="text"
                    placeholder="Search by type, priority, or location..."
                    className="w-full pl-12 pr-4 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl focus:outline-none focus:border-sky-400 transition-colors"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>

              {/* Type Filter */}
              <div className="w-full lg:w-64">
                <label className="block text-sm font-medium text-zinc-600 mb-2">Incident Type</label>
                <select
                  className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl focus:outline-none focus:border-emerald-400 transition-colors"
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                >
                  {types.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>

              {/* Priority Filter */}
              <div className="w-full lg:w-64">
                <label className="block text-sm font-medium text-zinc-600 mb-2">Priority</label>
                <select
                  className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl focus:outline-none focus:border-emerald-400 transition-colors"
                  value={priorityFilter}
                  onChange={(e) => setPriorityFilter(e.target.value)}
                >
                  {priorities.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Results Info */}
          <div className="flex items-center justify-between mb-4 px-1">
            <p className="text-sm text-zinc-500">
              Showing {filteredIncidents.length} of {incidents.length} incidents
            </p>
            {(typeFilter !== "All" || priorityFilter !== "All" || searchTerm) && (
              <button
                onClick={() => {
                  setTypeFilter("All");
                  setPriorityFilter("All");
                  setSearchTerm("");
                }}
                className="text-sm text-sky-600 hover:text-sky-700 font-medium"
              >
                Clear all filters
              </button>
            )}
          </div>

          {/* Table Container */}
          <div className="bg-white rounded-3xl shadow-sm border border-zinc-100 overflow-hidden">
            <IncidentTable data={filteredIncidents} isAdmin={true} />
          </div>
        </main>
      </div>
    </div>
  );
};

export default AdminIncidentLogs;