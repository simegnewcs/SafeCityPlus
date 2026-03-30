// src/pages/AdminUsers.js
import React, { useEffect, useState, useMemo } from "react";
import AdminSidebar from "../layout/AdminSidebar";
import axios from "axios";
import { Users, Search, UserPlus, Shield, Edit2, Trash2 } from "lucide-react";

const AdminUsers = () => {
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  // Filter states
  const [roleFilter, setRoleFilter] = useState("All");

  // Fetch users
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const response = await axios.get("http://localhost:5000/api/users");
        setUsers(response.data);
      } catch (error) {
        console.error("Error fetching users:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchUsers();
  }, []);

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
        `${u.fullName || ""} ${u.phone || ""} ${u.role || ""}`.toLowerCase().includes(searchTerm.toLowerCase());
      return roleMatch && searchMatch;
    });
  }, [users, roleFilter, searchTerm]);

  const handleEdit = (user) => {
    alert(`Edit user: ${user.fullName}`);
    // Replace with modal in future
  };

  const handleDelete = (id) => {
    if (window.confirm("Are you sure you want to delete this user?")) {
      alert(`Deleted user ID: ${id}`);
      // Add actual delete API call here
    }
  };

  return (
    <div className="flex h-screen bg-zinc-50 text-zinc-900 overflow-hidden">
      <AdminSidebar user={user} />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Navbar */}
        <header className="h-16 bg-white border-b border-zinc-200 px-6 md:px-8 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-4">
            <Users className="w-7 h-7 text-emerald-600" />
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Users Management</h1>
              <p className="text-sm text-zinc-500">{filteredUsers.length} users in the system</p>
            </div>
          </div>

          <button 
            onClick={() => alert("Add new user feature coming soon")}
            className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-sm font-medium transition-all"
          >
            <UserPlus size={18} />
            Add New User
          </button>
        </header>

        {/* Main Content */}
        <main className="flex-1 p-6 md:p-8 overflow-auto">
          {/* Filters Card */}
          <div className="bg-white rounded-3xl shadow-sm border border-zinc-100 p-6 mb-8">
            <div className="flex flex-col lg:flex-row gap-6">
              {/* Search */}
              <div className="flex-1">
                <label className="block text-sm font-medium text-zinc-600 mb-2">Search Users</label>
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={20} />
                  <input
                    type="text"
                    placeholder="Search by name, phone, or role..."
                    className="w-full pl-12 pr-4 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl focus:border-sky-400 outline-none transition-all"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>

              {/* Role Filter */}
              <div className="lg:w-64">
                <label className="block text-sm font-medium text-zinc-600 mb-2">Role</label>
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl focus:border-emerald-400 outline-none transition-all"
                >
                  {roles.map((role) => (
                    <option key={role} value={role}>{role}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Users Table */}
          <div className="bg-white rounded-3xl shadow-sm border border-zinc-100 overflow-hidden">
            {loading ? (
              <div className="py-20 text-center">
                <div className="animate-spin w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full mx-auto mb-4"></div>
                <p className="text-zinc-500">Loading users...</p>
              </div>
            ) : (
              <>
                <div className="p-6 border-b border-zinc-100 flex justify-between items-center bg-zinc-50">
                  <h2 className="text-lg font-semibold">All System Users ({filteredUsers.length})</h2>
                  <p className="text-sm text-zinc-500">Manage accounts and permissions</p>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-zinc-50 border-b border-zinc-200">
                      <tr>
                        <th className="px-6 py-5 text-left font-medium text-zinc-500 uppercase tracking-wider text-xs">ID</th>
                        <th className="px-6 py-5 text-left font-medium text-zinc-500 uppercase tracking-wider text-xs">Full Name</th>
                        <th className="px-6 py-5 text-left font-medium text-zinc-500 uppercase tracking-wider text-xs">Phone</th>
                        <th className="px-6 py-5 text-left font-medium text-zinc-500 uppercase tracking-wider text-xs">Role</th>
                        <th className="px-6 py-5 text-right font-medium text-zinc-500 uppercase tracking-wider text-xs w-32">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {filteredUsers.map((u) => (
                        <tr key={u.id} className="hover:bg-zinc-50 transition-colors group">
                          <td className="px-6 py-6 font-mono text-xs text-zinc-500">#{u.id}</td>
                          <td className="px-6 py-6 font-medium text-zinc-900">{u.fullName}</td>
                          <td className="px-6 py-6 text-zinc-600">{u.phone || "—"}</td>
                          <td className="px-6 py-6">
                            <span className={`inline-flex px-4 py-1.5 text-xs font-semibold rounded-2xl 
                              ${u.role === "Admin" ? "bg-rose-100 text-rose-700" : 
                                u.role === "Responder" ? "bg-emerald-100 text-emerald-700" : 
                                "bg-sky-100 text-sky-700"}`}>
                              {u.role || "User"}
                            </span>
                          </td>
                          <td className="px-6 py-6 text-right">
                            <div className="flex justify-end gap-2 opacity-70 group-hover:opacity-100 transition-all">
                              <button 
                                onClick={() => handleEdit(u)}
                                className="p-3 hover:bg-sky-50 text-sky-600 rounded-2xl transition-colors"
                                title="Edit User"
                              >
                                <Edit2 size={18} />
                              </button>
                              <button 
                                onClick={() => handleDelete(u.id)}
                                className="p-3 hover:bg-rose-50 text-rose-600 rounded-2xl transition-colors"
                                title="Delete User"
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

                {filteredUsers.length === 0 && !loading && (
                  <div className="py-20 text-center text-zinc-500">
                    No users match your current filters
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

export default AdminUsers;