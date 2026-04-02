// src/pages/AdminUsers.js
import React, { useEffect, useState, useMemo } from "react";
import AdminSidebar from "../layout/AdminSidebar";
import axios from "axios";
import { 
  Users, Search, UserPlus, Shield, Edit2, Trash2, 
  X, Check, AlertCircle, Eye, EyeOff, Phone, 
  Calendar, Activity, Filter, RefreshCw
} from "lucide-react";

const API_URL = "http://localhost:5000/api";

const AdminUsers = () => {
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("All");
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [formData, setFormData] = useState({
    fullName: "",
    phone: "",
    password: "",
    role: "User"
  });
  const [showPassword, setShowPassword] = useState(false);
  const [notification, setNotification] = useState({ show: false, message: "", type: "" });
  const [stats, setStats] = useState({ total: 0, admin: 0, responder: 0, user: 0 });
  const [showConfirmDelete, setShowConfirmDelete] = useState(null);
  const [updating, setUpdating] = useState(false);

  // Fetch users from database
  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/users`);
      const usersData = response.data;
      setUsers(usersData);
      
      // Calculate stats from fetched users
      const adminCount = usersData.filter(u => u.role === "Admin").length;
      const responderCount = usersData.filter(u => u.role === "Responder").length;
      const userCount = usersData.filter(u => u.role === "User").length;
      setStats({
        total: usersData.length,
        admin: adminCount,
        responder: responderCount,
        user: userCount
      });
    } catch (error) {
      console.error("Error fetching users:", error);
      showNotification(error.response?.data?.error || "Failed to load users", "error");
    } finally {
      setLoading(false);
    }
  };

  // Fetch stats from database
  const fetchStats = async () => {
    try {
      const response = await axios.get(`${API_URL}/users/stats/summary`);
      setStats(response.data);
    } catch (error) {
      console.error("Error fetching stats:", error);
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchStats();
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

  // Compute unique roles for filter
  const roles = useMemo(() => {
    const uniqueRoles = Array.from(new Set(users.map((u) => u.role || "User")));
    return ["All", ...uniqueRoles.sort()];
  }, [users]);

  // Filtered and searched users
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const roleMatch = roleFilter === "All" || u.role === roleFilter;
      const searchMatch = !searchTerm || 
        `${u.full_name || ""} ${u.phone || ""} ${u.role || ""}`.toLowerCase().includes(searchTerm.toLowerCase());
      return roleMatch && searchMatch;
    });
  }, [users, roleFilter, searchTerm]);

  const handleAddUser = () => {
    setEditingUser(null);
    setFormData({
      fullName: "",
      phone: "",
      password: "",
      role: "User"
    });
    setShowModal(true);
  };

  const handleEditUser = (user) => {
    setEditingUser(user);
    setFormData({
      fullName: user.full_name,
      phone: user.phone,
      password: "",
      role: user.role || "User"
    });
    setShowModal(true);
  };

  const handleDeleteUser = async (id) => {
    setUpdating(true);
    try {
      await axios.delete(`${API_URL}/users/${id}`);
      showNotification("User deleted successfully", "success");
      fetchUsers();
      fetchStats();
    } catch (error) {
      console.error("Error deleting user:", error);
      showNotification(error.response?.data?.error || "Failed to delete user", "error");
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
      if (editingUser) {
        // Update user
        const updateData = { ...formData };
        if (!updateData.password) delete updateData.password;
        await axios.put(`${API_URL}/users/${editingUser.id}`, updateData);
        showNotification("User updated successfully", "success");
      } else {
        // Create user
        if (!formData.password) {
          showNotification("Password is required for new users", "error");
          setUpdating(false);
          return;
        }
        await axios.post(`${API_URL}/users/register`, formData);
        showNotification("User created successfully", "success");
      }
      setShowModal(false);
      fetchUsers();
      fetchStats();
    } catch (error) {
      console.error("Error saving user:", error);
      showNotification(error.response?.data?.message || "Failed to save user", "error");
    } finally {
      setUpdating(false);
    }
  };

  const getRoleBadgeClass = (role) => {
    switch (role) {
      case "Admin": return "bg-rose-100 text-rose-700";
      case "Responder": return "bg-emerald-100 text-emerald-700";
      default: return "bg-sky-100 text-sky-700";
    }
  };

  const getRoleIcon = (role) => {
    switch (role) {
      case "Admin": return <Shield size={14} />;
      case "Responder": return <Activity size={14} />;
      default: return <Users size={14} />;
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
              <Users className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Users Management</h1>
              <p className="text-sm text-zinc-500">Manage system users and permissions</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button 
              onClick={() => { fetchUsers(); fetchStats(); }}
              className="p-2.5 hover:bg-zinc-100 rounded-xl transition-colors"
              title="Refresh"
            >
              <RefreshCw size={18} className="text-zinc-600" />
            </button>
            <button 
              onClick={handleAddUser}
              className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-sm font-medium transition-all shadow-sm"
            >
              <UserPlus size={18} />
              Add New User
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
                  <p className="text-zinc-500 text-sm font-medium">Total Users</p>
                  <p className="text-2xl font-bold text-zinc-900 mt-1">{stats.total}</p>
                </div>
                <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
                  <Users className="w-5 h-5 text-emerald-600" />
                </div>
              </div>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-zinc-500 text-sm font-medium">Admins</p>
                  <p className="text-2xl font-bold text-rose-600 mt-1">{stats.admin}</p>
                </div>
                <div className="w-10 h-10 bg-rose-100 rounded-xl flex items-center justify-center">
                  <Shield className="w-5 h-5 text-rose-600" />
                </div>
              </div>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-zinc-500 text-sm font-medium">Responders</p>
                  <p className="text-2xl font-bold text-emerald-600 mt-1">{stats.responder}</p>
                </div>
                <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
                  <Activity className="w-5 h-5 text-emerald-600" />
                </div>
              </div>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-zinc-500 text-sm font-medium">Regular Users</p>
                  <p className="text-2xl font-bold text-sky-600 mt-1">{stats.user}</p>
                </div>
                <div className="w-10 h-10 bg-sky-100 rounded-xl flex items-center justify-center">
                  <Users className="w-5 h-5 text-sky-600" />
                </div>
              </div>
            </div>
          </div>

          {/* Filters Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 p-6 mb-8">
            <div className="flex flex-col lg:flex-row gap-6">
              {/* Search */}
              <div className="flex-1">
                <label className="block text-sm font-medium text-zinc-700 mb-2">Search Users</label>
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                  <input
                    type="text"
                    placeholder="Search by name, phone, or role..."
                    className="w-full pl-11 pr-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 outline-none transition-all"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>

              {/* Role Filter */}
              <div className="lg:w-64">
                <label className="block text-sm font-medium text-zinc-700 mb-2">Role Filter</label>
                <div className="relative">
                  <Filter className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                  <select
                    value={roleFilter}
                    onChange={(e) => setRoleFilter(e.target.value)}
                    className="w-full pl-11 pr-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 outline-none transition-all appearance-none"
                  >
                    {roles.map((role) => (
                      <option key={role} value={role}>{role}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Users Table */}
          <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 overflow-hidden">
            {loading ? (
              <div className="py-20 text-center">
                <div className="animate-spin w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full mx-auto mb-4"></div>
                <p className="text-zinc-500">Loading users...</p>
              </div>
            ) : (
              <>
                <div className="px-6 py-4 border-b border-zinc-100 flex justify-between items-center bg-zinc-50/50">
                  <div>
                    <h2 className="text-base font-semibold text-zinc-900">System Users</h2>
                    <p className="text-xs text-zinc-500 mt-0.5">{filteredUsers.length} users found</p>
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
                        <th className="px-6 py-4 text-left font-medium text-zinc-500 text-xs uppercase tracking-wider">User</th>
                        <th className="px-6 py-4 text-left font-medium text-zinc-500 text-xs uppercase tracking-wider">Phone</th>
                        <th className="px-6 py-4 text-left font-medium text-zinc-500 text-xs uppercase tracking-wider">Role</th>
                        <th className="px-6 py-4 text-left font-medium text-zinc-500 text-xs uppercase tracking-wider">Joined</th>
                        <th className="px-6 py-4 text-right font-medium text-zinc-500 text-xs uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {filteredUsers.map((u) => (
                        <tr key={u.id} className="hover:bg-zinc-50/50 transition-colors group">
                          <td className="px-6 py-4 font-mono text-xs text-zinc-500">#{u.id}</td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-full flex items-center justify-center text-white text-sm font-medium">
                                {u.full_name?.charAt(0).toUpperCase() || "U"}
                              </div>
                              <div>
                                <p className="font-medium text-zinc-900">{u.full_name}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-1 text-zinc-600">
                              <Phone size={12} className="text-zinc-400" />
                              <span>{u.phone || "—"}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-full ${getRoleBadgeClass(u.role)}`}>
                              {getRoleIcon(u.role)}
                              {u.role || "User"}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-1 text-xs text-zinc-500">
                              <Calendar size={12} className="text-zinc-400" />
                              {formatDate(u.created_at)}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-all">
                              <button 
                                onClick={() => handleEditUser(u)}
                                className="p-2 hover:bg-sky-50 text-sky-600 rounded-lg transition-colors"
                                title="Edit User"
                              >
                                <Edit2 size={16} />
                              </button>
                              <button 
                                onClick={() => setShowConfirmDelete(u.id)}
                                className="p-2 hover:bg-rose-50 text-rose-600 rounded-lg transition-colors"
                                title="Delete User"
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

                {filteredUsers.length === 0 && !loading && (
                  <div className="py-20 text-center">
                    <Users className="w-12 h-12 text-zinc-300 mx-auto mb-3" />
                    <p className="text-zinc-500 font-medium">No users found</p>
                    <p className="text-sm text-zinc-400 mt-1">Try adjusting your search or filters</p>
                  </div>
                )}
              </>
            )}
          </div>
        </main>
      </div>

      {/* Add/Edit User Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-2xl max-w-md w-full max-h-[90vh] overflow-hidden shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-zinc-200 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-zinc-900">
                  {editingUser ? "Edit User" : "Add New User"}
                </h2>
                <p className="text-sm text-zinc-500 mt-1">
                  {editingUser ? "Update user information" : "Create a new system user"}
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
                  Password {!editingUser && "*"}
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 outline-none transition-all pr-11"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder={editingUser ? "Leave blank to keep current" : "Enter password"}
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
                <label className="block text-sm font-medium text-zinc-700 mb-1.5">Role</label>
                <select
                  className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 outline-none transition-all"
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                >
                  <option value="User">User</option>
                  <option value="Responder">Responder</option>
                  <option value="Admin">Admin</option>
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
                  {updating ? "Saving..." : (editingUser ? "Update User" : "Create User")}
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
              <h3 className="text-lg font-semibold text-zinc-900 mb-2">Delete User</h3>
              <p className="text-sm text-zinc-500 mb-6">
                Are you sure you want to delete this user? This action cannot be undone.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowConfirmDelete(null)}
                  className="flex-1 px-4 py-2.5 border border-zinc-300 text-zinc-700 rounded-xl font-medium hover:bg-zinc-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDeleteUser(showConfirmDelete)}
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

export default AdminUsers;