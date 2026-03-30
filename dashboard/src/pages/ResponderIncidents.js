// src/pages/ResponderIncidents.js
import React, { useEffect, useState, useMemo } from "react";
import ResponderSidebar from "../layout/ResponderSidebar";
import axios from "axios";
import { AlertTriangle, Clock, CheckCircle, MapPin } from "lucide-react";

const ResponderIncidents = () => {
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");

  const fetchIncidents = async () => {
    try {
      const res = await axios.get(`http://localhost:5000/api/incidents/assigned/${user.id}`);
      setIncidents(res.data);
    } catch (err) {
      console.error("Error fetching incidents:", err);
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (id, newStatus) => {
    try {
      await axios.put(`http://localhost:5000/api/incidents/${id}`, { status: newStatus });
      fetchIncidents(); // Refresh list
    } catch (err) {
      console.error("Error updating status:", err);
      alert("Failed to update status");
    }
  };

  useEffect(() => {
    fetchIncidents();
  }, [user.id]);

  // Filtered incidents
  const filteredIncidents = useMemo(() => {
    if (filter === "all") return incidents;
    return incidents.filter(inc => inc.status === filter);
  }, [incidents, filter]);

  const getPriorityColor = (priority) => {
    if (!priority) return "bg-zinc-100 text-zinc-600";
    if (priority === "High" || priority === "Critical") return "bg-rose-100 text-rose-700";
    if (priority === "Medium") return "bg-amber-100 text-amber-700";
    return "bg-emerald-100 text-emerald-700";
  };

  return (
    <div className="flex h-screen bg-zinc-50 overflow-hidden">
      <ResponderSidebar 
        activeTab="assigned incidents" 
        setActiveTab={() => {}} 
        user={user} 
      />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Navbar */}
        <header className="h-16 bg-white border-b border-zinc-200 px-6 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-4">
            <AlertTriangle className="w-7 h-7 text-blue-600" />
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Assigned Incidents</h1>
              <p className="text-sm text-zinc-500">Manage your current assignments</p>
            </div>
          </div>
          
          <div className="text-sm text-zinc-500">
            {filteredIncidents.length} active {filteredIncidents.length === 1 ? 'incident' : 'incidents'}
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 p-6 overflow-auto">
          {/* Filters */}
          <div className="bg-white border border-zinc-200 rounded-3xl p-4 mb-8 flex flex-wrap gap-3">
            <button 
              onClick={() => setFilter("all")}
              className={`px-5 py-2 rounded-2xl text-sm font-medium transition-all ${filter === 'all' ? 'bg-blue-600 text-white' : 'bg-zinc-100 hover:bg-zinc-200'}`}
            >
              All
            </button>
            <button 
              onClick={() => setFilter("Pending")}
              className={`px-5 py-2 rounded-2xl text-sm font-medium transition-all ${filter === 'Pending' ? 'bg-blue-600 text-white' : 'bg-zinc-100 hover:bg-zinc-200'}`}
            >
              Pending
            </button>
            <button 
              onClick={() => setFilter("In Progress")}
              className={`px-5 py-2 rounded-2xl text-sm font-medium transition-all ${filter === 'In Progress' ? 'bg-blue-600 text-white' : 'bg-zinc-100 hover:bg-zinc-200'}`}
            >
              In Progress
            </button>
            <button 
              onClick={() => setFilter("Resolved")}
              className={`px-5 py-2 rounded-2xl text-sm font-medium transition-all ${filter === 'Resolved' ? 'bg-blue-600 text-white' : 'bg-zinc-100 hover:bg-zinc-200'}`}
            >
              Resolved
            </button>
          </div>

          {/* Incidents List */}
          <div className="bg-white border border-zinc-200 rounded-3xl shadow-sm overflow-hidden">
            {loading ? (
              <div className="py-20 text-center">
                <div className="animate-spin w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
                <p className="text-zinc-500">Loading your incidents...</p>
              </div>
            ) : filteredIncidents.length === 0 ? (
              <div className="py-20 text-center">
                <AlertTriangle className="w-16 h-16 text-zinc-300 mx-auto mb-4" />
                <h3 className="text-xl font-medium text-zinc-700">No incidents found</h3>
                <p className="text-zinc-500 mt-2">You currently have no assigned incidents</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-zinc-50 border-b border-zinc-200">
                    <tr>
                      <th className="px-6 py-5 text-left font-medium text-zinc-500 uppercase tracking-wider text-xs">Incident Type</th>
                      <th className="px-6 py-5 text-left font-medium text-zinc-500 uppercase tracking-wider text-xs">Priority</th>
                      <th className="px-6 py-5 text-left font-medium text-zinc-500 uppercase tracking-wider text-xs">Location</th>
                      <th className="px-6 py-5 text-left font-medium text-zinc-500 uppercase tracking-wider text-xs">Status</th>
                      <th className="px-6 py-5 text-right font-medium text-zinc-500 uppercase tracking-wider text-xs">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {filteredIncidents.map((inc) => (
                      <tr key={inc.id} className="hover:bg-zinc-50 transition-colors group">
                        <td className="px-6 py-6 font-medium text-zinc-900">
                          {inc.ai_type || "Unknown Incident"}
                        </td>
                        <td className="px-6 py-6">
                          <span className={`inline-flex px-4 py-1.5 text-xs font-bold rounded-2xl ${getPriorityColor(inc.ai_priority)}`}>
                            {inc.ai_priority || "Normal"}
                          </span>
                        </td>
                        <td className="px-6 py-6 text-zinc-600">
                          <div className="flex items-center gap-2">
                            <MapPin size={16} className="text-blue-500" />
                            {inc.location || "—"}
                          </div>
                        </td>
                        <td className="px-6 py-6">
                          <span className={`inline-flex px-4 py-1.5 text-xs font-medium rounded-2xl
                            ${inc.status === "Resolved" ? "bg-emerald-100 text-emerald-700" : 
                              inc.status === "In Progress" ? "bg-amber-100 text-amber-700" : 
                              "bg-zinc-100 text-zinc-600"}`}>
                            {inc.status || "Pending"}
                          </span>
                        </td>
                        <td className="px-6 py-6 text-right">
                          {inc.status !== "Resolved" && (
                            <div className="flex justify-end gap-3">
                              {inc.status !== "In Progress" && (
                                <button
                                  onClick={() => updateStatus(inc.id, "In Progress")}
                                  className="px-5 py-2 bg-amber-100 hover:bg-amber-200 text-amber-700 rounded-2xl text-sm font-medium transition-all"
                                >
                                  Start Work
                                </button>
                              )}
                              <button
                                onClick={() => updateStatus(inc.id, "Resolved")}
                                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-sm font-medium transition-all"
                              >
                                Mark Resolved
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

export default ResponderIncidents;