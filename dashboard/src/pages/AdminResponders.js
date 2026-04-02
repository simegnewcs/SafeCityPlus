// src/pages/AdminResponders.js
import React, { useEffect, useState, useMemo } from "react";
import AdminSidebar from "../layout/AdminSidebar";
import axios from "axios";
import { 
  UserPlus, Edit2, Trash2, Shield, Phone, MapPin, 
  X, Check, AlertCircle, Eye, EyeOff, Search, Filter, 
  RefreshCw, Activity, Users, Calendar
} from "lucide-react";

const API_URL = "http://localhost:5000/api";

const AdminResponders = () => {
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const [responders, setResponders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [showModal, setShowModal] = useState(false);
  const [editingResponder, setEditingResponder] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [notification, setNotification] = useState({ show: false, message: "", type: "" });
  const [showConfirmDelete, setShowConfirmDelete] = useState(null);
  const [updating, setUpdating] = useState(false);
  const [stats, setStats] = useState({ total: 0, active: 0, onDuty: 0, offDuty: 0 });

  const [formData, setFormData] = useState({
    fullName: "",
    phone: "",
    password: "",
    responder_type: "Police",
    status: "Active"
  });

  // Fetch responders from database (users with role = Responder)
  const fetchResponders = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/users`);
      const allUsers = response.data;
      const responderUsers = allUsers.filter(u => u.role === "Responder");
      setResponders(responderUsers);
      
      // Calculate stats
      const active = responderUsers.filter(r => r.status === "Active").length;
      const onDuty = responderUsers.filter(r => r.status === "On Duty").length;
      const offDuty = responderUsers.filter(r => r.status === "Off Duty").length;
      setStats({
        total: responderUsers.length,
        active,
        onDuty,
        offDuty
      });
    } catch (error) {
      console.error("Error fetching responders:", error);
      showNotification("Failed to load responders", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchResponders();
  }, []);

  // Auto-hide notification
  useEffect(() => {
    if (notification.show) {
      const timer = setTimeout(() => {
        setNotification({ show: false, message: "", type: "" });
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const showNotification = (message, type) => {
    setNotification({ show: true, message, type });
  };

  // Compute unique types and statuses
  const responderTypes = useMemo(() => {
    const uniqueTypes = Array.from(new Set(responders.map((r) => r.responder_type || "Police")));
    return ["All", ...uniqueTypes.sort()];
  }, [responders]);

  const statuses = useMemo(() => {
    return ["All", "Active", "On Duty", "Off Duty"];
  }, []);

  // Filtered responders
  const filteredResponders = useMemo(() => {
    return responders.filter((r) => {
      const typeMatch = typeFilter === "All" || (r.responder_type || "Police") === typeFilter;
      const statusMatch = statusFilter === "All" || (r.status || "Active") === statusFilter;
      const searchMatch = !searchTerm || 
        `${r.full_name || ""} ${r.phone || ""} ${r.responder_type || ""}`.toLowerCase().includes(searchTerm.toLowerCase());
      return typeMatch && statusMatch && searchMatch;
    });
  }, [responders, typeFilter, statusFilter, searchTerm]);

  const handleAddResponder = () => {
    setEditingResponder(null);
    setFormData({
      fullName: "",
      phone: "",
      password: "",
      responder_type: "Police",
      status: "Active"
    });
    setShowModal(true);
  };

  const handleEditResponder = (responder) => {
    setEditingResponder(responder);
    setFormData({
      fullName: responder.full_name,
      phone: responder.phone,
      password: "",
      responder_type: responder.responder_type || "Police",
      status: responder.status || "Active"
    });
    setShowModal(true);
  };

  const handleDeleteResponder = async (id) => {
    setUpdating(true);
    try {
      await axios.delete(`${API_URL}/users/${id}`);
      showNotification("Responder deleted successfully", "success");
      fetchResponders();
    } catch (error) {
      console.error("Error deleting responder:", error);
      showNotification(error.response?.data?.error || "Failed to delete responder", "error");
    } finally {
      setUpdating(false);
      setShowConfirmDelete(null);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.fullName || !formData.phone) {
      showNotification("Please fill in all required fields", "error");
      return;
    }

    setUpdating(true);
    try {
      if (editingResponder) {
        // Update responder
        const updateData = { 
          ...formData, 
          role: "Responder",
          fullName: formData.fullName
        };
        if (!updateData.password) delete updateData.password;
        await axios.put(`${API_URL}/users/${editingResponder.id}`, updateData);
        showNotification("Responder updated successfully", "success");
      } else {
        // Create responder
        if (!formData.password) {
          showNotification("Password is required for new responders", "error");
          setUpdating(false);
          return;
        }
        await axios.post(`${API_URL}/users/register`, {
          ...formData,
          role: "Responder",
          fullName: formData.fullName
        });
        showNotification("Responder created successfully", "success");
      }
      setShowModal(false);
      fetchResponders();
    } catch (error) {
      console.error("Error saving responder:", error);
      showNotification(error.response?.data?.message || "Failed to save responder", "error");
    } finally {
      setUpdating(false);
    }
  };

  const updateResponderStatus = async (id, status) => {
    try {
      await axios.put(`${API_URL}/users/${id}`, { status, role: "Responder" });
      showNotification(`Responder status updated to ${status}`, "success");
      fetchResponders();
    } catch (error) {
      console.error("Error updating status:", error);
      showNotification("Failed to update status", "error");
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "Active": return "bg-emerald-100 text-emerald-700";
      case "On Duty": return "bg-sky-100 text-sky-700";
      case "Off Duty": return "bg-amber-100 text-amber-700";
      default: return "bg-gray-100 text-gray-700";
    }
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case "Police": return <Shield size={14} className="text-blue-500" />;
      case "Fire": return <Activity size={14} className="text-red-500" />;
      case "Medical": return <Users size={14} className="text-emerald-500" />;
      default: return <Shield size={14} className="text-gray-500" />;
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    return date.toLocaleDateString();
  };

  return (
    <div className="flex h-screen bg-zinc-50 text-zinc-900 overflow-hidden">
      <AdminSidebar user={user} />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Notification Toast */}
        {notification.show && (
          <div className={`fixed top-20 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg animate-slide-in ${
            notification.type === "success" ? "bg-emerald-500 text-white" : "bg-red-500 text-white"
          }`}>
            {notification.type === "success" ? <Check size={18} /> : <AlertCircle size={18} />}
            <span className="text-sm font-medium">{notification.message}</span>
          </div>
        )}

        {/* Top Navbar */}
        <header className="h-16 bg-white border-b border-zinc-200 px-6 md:px-8 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-4">
            <div className="p-2 bg-emerald-100 rounded-xl">
              <Shield className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Responder Control</h1>
              <p className="text-sm text-zinc-500">Manage field responders • {stats.total} responders</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button 
              onClick={fetchResponders}
              className="p-2.5 hover:bg-zinc-100 rounded-xl transition-colors"
              title="Refresh"
            >
              <RefreshCw size={18} className="text-zinc-600" />
            </button>
            <button 
              onClick={handleAddResponder}
              className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-sm font-medium transition-all shadow-sm"
            >
              <UserPlus size={18} />
              Add Responder
            </button>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 p-6 md:p-8 overflow-auto">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-8">
            <div className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-zinc-500 text-sm font-medium">Total Responders</p>
                  <p className="text-2xl font-bold text-zinc-900 mt-1">{stats.total}</p>
                </div>
                <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
                  <Shield className="w-5 h-5 text-emerald-600" />
                </div>
              </div>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-zinc-500 text-sm font-medium">Active</p>
                  <p className="text-2xl font-bold text-emerald-600 mt-1">{stats.active}</p>
                </div>
                <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
                  <Activity className="w-5 h-5 text-emerald-600" />
                </div>
              </div>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-zinc-500 text-sm font-medium">On Duty</p>
                  <p className="text-2xl font-bold text-sky-600 mt-1">{stats.onDuty}</p>
                </div>
                <div className="w-10 h-10 bg-sky-100 rounded-xl flex items-center justify-center">
                  <MapPin className="w-5 h-5 text-sky-600" />
                </div>
              </div>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-zinc-500 text-sm font-medium">Off Duty</p>
                  <p className="text-2xl font-bold text-amber-600 mt-1">{stats.offDuty}</p>
                </div>
                <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-amber-600" />
                </div>
              </div>
            </div>
          </div>

          {/* Filters Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 p-6 mb-8">
            <div className="flex flex-col lg:flex-row gap-6">
              {/* Search */}
              <div className="flex-1">
                <label className="block text-sm font-medium text-zinc-700 mb-2">Search Responders</label>
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                  <input
                    type="text"
                    placeholder="Search by name, phone, or type..."
                    className="w-full pl-11 pr-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 outline-none transition-all"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>

              {/* Type Filter */}
              <div className="lg:w-64">
                <label className="block text-sm font-medium text-zinc-700 mb-2">Responder Type</label>
                <div className="relative">
                  <Filter className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                  <select
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value)}
                    className="w-full pl-11 pr-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 outline-none transition-all appearance-none"
                  >
                    {responderTypes.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Status Filter */}
              <div className="lg:w-48">
                <label className="block text-sm font-medium text-zinc-700 mb-2">Status</label>
                <div className="relative">
                  <Filter className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="w-full pl-11 pr-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 outline-none transition-all appearance-none"
                  >
                    {statuses.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Table Section */}
          <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 overflow-hidden">
            {loading ? (
              <div className="py-20 text-center">
                <div className="animate-spin w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full mx-auto mb-4"></div>
                <p className="text-zinc-500">Loading responders...</p>
              </div>
            ) : (
              <>
                <div className="px-6 py-4 border-b border-zinc-100 flex justify-between items-center bg-zinc-50/50">
                  <div>
                    <h2 className="text-base font-semibold text-zinc-900">All Responders</h2>
                    <p className="text-xs text-zinc-500 mt-0.5">{filteredResponders.length} responders found</p>
                  </div>
                  <div className="text-xs text-zinc-400">
                    Last updated: {new Date().toLocaleTimeString()}
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-zinc-50 border-b border-zinc-200">
                        <th className="px-6 py-4 text-left font-medium text-zinc-500 text-xs uppercase tracking-wider">ID</th>
                        <th className="px-6 py-4 text-left font-medium text-zinc-500 text-xs uppercase tracking-wider">Responder</th>
                        <th className="px-6 py-4 text-left font-medium text-zinc-500 text-xs uppercase tracking-wider">Phone</th>
                        <th className="px-6 py-4 text-left font-medium text-zinc-500 text-xs uppercase tracking-wider">Type</th>
                        <th className="px-6 py-4 text-left font-medium text-zinc-500 text-xs uppercase tracking-wider">Status</th>
                        <th className="px-6 py-4 text-left font-medium text-zinc-500 text-xs uppercase tracking-wider">Joined</th>
                        <th className="px-6 py-4 text-right font-medium text-zinc-500 text-xs uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {filteredResponders.map((r) => (
                        <tr key={r.id} className="hover:bg-zinc-50/50 transition-colors group">
                          <td className="px-6 py-4 font-mono text-xs text-zinc-500">#{r.id}</td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-full flex items-center justify-center text-white text-sm font-medium">
                                {r.full_name?.charAt(0).toUpperCase() || "R"}
                              </div>
                              <div>
                                <p className="font-medium text-zinc-900">{r.full_name}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-1 text-zinc-600">
                              <Phone size={12} className="text-zinc-400" />
                              <span>{r.phone || "—"}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className="inline-flex items-center gap-1.5">
                              {getTypeIcon(r.responder_type)}
                              <span className="text-zinc-600">{r.responder_type || "Police"}</span>
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <select
                              value={r.status || "Active"}
                              onChange={(e) => updateResponderStatus(r.id, e.target.value)}
                              className={`px-3 py-1 text-xs font-semibold rounded-full border-none focus:ring-1 focus:ring-emerald-400 ${getStatusColor(r.status)}`}
                            >
                              <option value="Active">Active</option>
                              <option value="On Duty">On Duty</option>
                              <option value="Off Duty">Off Duty</option>
                            </select>
                          </td>
                          <td className="px-6 py-4 text-zinc-500 text-xs">
                            {formatDate(r.created_at)}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-all">
                              <button 
                                onClick={() => handleEditResponder(r)}
                                className="p-2 hover:bg-sky-50 text-sky-600 rounded-lg transition-colors"
                                title="Edit Responder"
                              >
                                <Edit2 size={16} />
                              </button>
                              <button 
                                onClick={() => setShowConfirmDelete(r.id)}
                                className="p-2 hover:bg-rose-50 text-rose-600 rounded-lg transition-colors"
                                title="Delete Responder"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {filteredResponders.length === 0 && !loading && (
                  <div className="py-20 text-center">
                    <Shield className="w-12 h-12 text-zinc-300 mx-auto mb-3" />
                    <p className="text-zinc-500 font-medium">No responders found</p>
                    <p className="text-sm text-zinc-400 mt-1">Click "Add Responder" to create one</p>
                  </div>
                )}
              </>
            )}
          </div>
        </main>
      </div>

      {/* Add/Edit Responder Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-2xl max-w-md w-full max-h-[90vh] overflow-hidden shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-zinc-200 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-zinc-900">
                  {editingResponder ? "Edit Responder" : "Add New Responder"}
                </h2>
                <p className="text-sm text-zinc-500 mt-1">
                  {editingResponder ? "Update responder information" : "Create a new emergency responder"}
                </p>
              </div>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-zinc-100 rounded-lg transition-colors">
                <X size={20} className="text-zinc-500" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1.5">Full Name *</label>
                <input
                  type="text"
                  required
                  className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 outline-none transition-all"
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  placeholder="Enter full name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1.5">Phone Number *</label>
                <input
                  type="tel"
                  required
                  className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 outline-none transition-all"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="Enter phone number"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1.5">
                  Password {!editingResponder && "*"}
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 outline-none transition-all pr-11"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder={editingResponder ? "Leave blank to keep current" : "Enter password"}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1.5">Responder Type</label>
                <select
                  className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 outline-none transition-all"
                  value={formData.responder_type}
                  onChange={(e) => setFormData({ ...formData, responder_type: e.target.value })}
                >
                  <option value="Police">Police</option>
                  <option value="Fire">Fire Department</option>
                  <option value="Medical">Medical/Ambulance</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1.5">Status</label>
                <select
                  className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 outline-none transition-all"
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                >
                  <option value="Active">Active</option>
                  <option value="On Duty">On Duty</option>
                  <option value="Off Duty">Off Duty</option>
                </select>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2.5 border border-zinc-300 text-zinc-700 rounded-xl font-medium hover:bg-zinc-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updating}
                  className="flex-1 px-4 py-2.5 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {updating ? "Saving..." : (editingResponder ? "Update Responder" : "Create Responder")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirm Delete Modal */}
      {showConfirmDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowConfirmDelete(null)}>
          <div className="bg-white rounded-2xl max-w-sm w-full p-6" onClick={(e) => e.stopPropagation()}>
            <div className="text-center">
              <div className="w-12 h-12 bg-rose-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 size={24} className="text-rose-600" />
              </div>
              <h3 className="text-lg font-semibold text-zinc-900 mb-2">Delete Responder</h3>
              <p className="text-sm text-zinc-500 mb-6">
                Are you sure you want to delete this responder? This action cannot be undone.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowConfirmDelete(null)}
                  className="flex-1 px-4 py-2.5 border border-zinc-300 text-zinc-700 rounded-xl font-medium hover:bg-zinc-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDeleteResponder(showConfirmDelete)}
                  disabled={updating}
                  className="flex-1 px-4 py-2.5 bg-rose-600 text-white rounded-xl font-medium hover:bg-rose-700 transition-colors disabled:opacity-50"
                >
                  {updating ? "Deleting..." : "Delete"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminResponders;