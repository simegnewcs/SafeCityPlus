// src/pages/AdminResponders.js
import React, { useEffect, useState, useMemo } from "react";
import AdminSidebar from "../layout/AdminSidebar";
import axios from "axios";
import { UserPlus, Edit2, Trash2, Shield, Phone, MapPin } from "lucide-react";

const AdminResponders = () => {
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const [responders, setResponders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  // Filter states
  const [typeFilter, setTypeFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");

  // Fetch responders
  useEffect(() => {
    const fetchResponders = async () => {
      try {
        const response = await axios.get("http://localhost:5000/api/users?role=Responder");
        setResponders(response.data);
      } catch (error) {
        console.error("Error fetching responders:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchResponders();
  }, []);

  // Compute unique types and statuses
  const types = useMemo(() => {
    const uniqueTypes = Array.from(new Set(responders.map((r) => r.responder_type || "Unknown")));
    return ["All", ...uniqueTypes.sort()];
  }, [responders]);

  const statuses = useMemo(() => {
    const uniqueStatuses = Array.from(new Set(responders.map((r) => r.status || "Active")));
    return ["All", ...uniqueStatuses.sort()];
  }, [responders]);

  // Filtered and searched responders
  const filteredResponders = useMemo(() => {
    return responders.filter((r) => {
      const typeMatch = typeFilter === "All" || r.responder_type === typeFilter;
      const statusMatch = statusFilter === "All" || r.status === statusFilter;
      const searchMatch = !searchTerm || 
        `${r.full_name || ""} ${r.phone || ""} ${r.responder_type || ""}`.toLowerCase().includes(searchTerm.toLowerCase());
      return typeMatch && statusMatch && searchMatch;
    });
  }, [responders, typeFilter, statusFilter, searchTerm]);

  const handleEdit = (responder) => {
    alert(`Edit responder: ${responder.full_name}`);
    // Replace with modal later
  };

  const handleDelete = (id) => {
    if (window.confirm("Are you sure you want to delete this responder?")) {
      alert(`Deleted responder ID: ${id}`);
      // Add actual delete logic here
    }
  };

  return (
    <div className="flex h-screen bg-zinc-50 text-zinc-900 overflow-hidden">
      <AdminSidebar user={user} />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Navbar */}
        <header className="h-16 bg-white border-b border-zinc-200 px-6 md:px-8 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-4">
            <Shield className="w-7 h-7 text-emerald-600" />
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Responder Control</h1>
              <p className="text-sm text-zinc-500">Manage field responders • {filteredResponders.length} active</p>
            </div>
          </div>

          <button 
            onClick={() => alert("Add new responder feature coming soon")}
            className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-sm font-medium transition-all"
          >
            <UserPlus size={18} />
            Add Responder
          </button>
        </header>

        {/* Main Content */}
        <main className="flex-1 p-6 md:p-8 overflow-auto">
          {/* Filters Card */}
          <div className="bg-white rounded-3xl shadow-sm border border-zinc-100 p-6 mb-8">
            <div className="flex flex-col lg:flex-row gap-6">
              {/* Search */}
              <div className="flex-1">
                <label className="block text-sm font-medium text-zinc-600 mb-2">Search Responders</label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search by name, phone, or type..."
                    className="w-full pl-4 pr-4 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl focus:border-sky-400 outline-none transition-all"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>

              {/* Type Filter */}
              <div className="lg:w-64">
                <label className="block text-sm font-medium text-zinc-600 mb-2">Responder Type</label>
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl focus:border-emerald-400 outline-none transition-all"
                >
                  {types.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>

              {/* Status Filter */}
              <div className="lg:w-64">
                <label className="block text-sm font-medium text-zinc-600 mb-2">Status</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl focus:border-emerald-400 outline-none transition-all"
                >
                  {statuses.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Table Section */}
          <div className="bg-white rounded-3xl shadow-sm border border-zinc-100 overflow-hidden">
            {loading ? (
              <div className="py-20 text-center">
                <div className="animate-spin w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full mx-auto mb-4"></div>
                <p className="text-zinc-500">Loading responders...</p>
              </div>
            ) : (
              <>
                <div className="p-6 border-b border-zinc-100 flex justify-between items-center">
                  <h2 className="text-lg font-semibold">All Responders ({filteredResponders.length})</h2>
                  <p className="text-sm text-zinc-500">Last updated just now</p>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-zinc-50 border-b border-zinc-200">
                      <tr>
                        <th className="px-6 py-5 text-left font-medium text-zinc-500 uppercase tracking-wider text-xs">ID</th>
                        <th className="px-6 py-5 text-left font-medium text-zinc-500 uppercase tracking-wider text-xs">Full Name</th>
                        <th className="px-6 py-5 text-left font-medium text-zinc-500 uppercase tracking-wider text-xs">Phone</th>
                        <th className="px-6 py-5 text-left font-medium text-zinc-500 uppercase tracking-wider text-xs">Type</th>
                        <th className="px-6 py-5 text-left font-medium text-zinc-500 uppercase tracking-wider text-xs">Status</th>
                        <th className="px-6 py-5 text-right font-medium text-zinc-500 uppercase tracking-wider text-xs w-32">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {filteredResponders.map((r) => (
                        <tr key={r.id} className="hover:bg-zinc-50 transition-colors group">
                          <td className="px-6 py-6 font-mono text-xs text-zinc-500">#{r.id}</td>
                          <td className="px-6 py-6 font-medium text-zinc-900">{r.full_name}</td>
                          <td className="px-6 py-6 text-zinc-600">
                            <div className="flex items-center gap-2">
                              <Phone size={16} className="text-emerald-500" />
                              {r.phone}
                            </div>
                          </td>
                          <td className="px-6 py-6 text-zinc-600">{r.responder_type || "—"}</td>
                          <td className="px-6 py-6">
                            <span className={`inline-flex px-4 py-1.5 text-xs font-semibold rounded-2xl 
                              ${r.status === "Active" ? "bg-emerald-100 text-emerald-700" : 
                                r.status === "On Duty" ? "bg-sky-100 text-sky-700" : 
                                "bg-amber-100 text-amber-700"}`}>
                              {r.status || "Active"}
                            </span>
                          </td>
                          <td className="px-6 py-6 text-right">
                            <div className="flex justify-end gap-2 opacity-70 group-hover:opacity-100 transition-all">
                              <button 
                                onClick={() => handleEdit(r)}
                                className="p-3 hover:bg-sky-50 text-sky-600 rounded-2xl transition-colors"
                              >
                                <Edit2 size={18} />
                              </button>
                              <button 
                                onClick={() => handleDelete(r.id)}
                                className="p-3 hover:bg-rose-50 text-rose-600 rounded-2xl transition-colors"
                              >
                                <Trash2 size={18} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {filteredResponders.length === 0 && !loading && (
                  <div className="py-20 text-center text-zinc-500">
                    No responders match your filters
                  </div>
                )}
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

export default AdminResponders;