// src/pages/AdminSettings.js
import React, { useState } from "react";
import AdminSidebar from "../layout/AdminSidebar";
import axios from "axios";

const AdminSettings = () => {
  const user = JSON.parse(localStorage.getItem("user"));

  // Profile state
  const [fullName, setFullName] = useState(user?.fullName || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [email, setEmail] = useState(user?.email || "");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  const handleSaveProfile = async () => {
    try {
      await axios.put(`http://localhost:5000/api/users/${user.id}`, {
        full_name: fullName,
        phone,
        email,
        ...(password && { password }), // only update if password entered
      });
      setMessage("Profile updated successfully!");
    } catch (err) {
      console.error(err);
      setMessage("Error updating profile.");
    }
  };

  return (
    <div className="flex bg-slate-100 min-h-screen">
      <AdminSidebar activeTab="settings" setActiveTab={() => {}} user={user} />
      <main className="flex-1 ml-64 p-8">
        <h1 className="text-3xl font-bold mb-6">Admin Settings</h1>

        {/* Profile Section */}
        <div className="bg-white rounded-xl shadow p-6 mb-6">
          <h2 className="text-xl font-bold mb-4">Profile</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block mb-1 font-medium">Full Name</label>
              <input
                type="text"
                className="border px-3 py-2 rounded w-full"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </div>
            <div>
              <label className="block mb-1 font-medium">Phone</label>
              <input
                type="text"
                className="border px-3 py-2 rounded w-full"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
            <div>
              <label className="block mb-1 font-medium">Email</label>
              <input
                type="email"
                className="border px-3 py-2 rounded w-full"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label className="block mb-1 font-medium">Password</label>
              <input
                type="password"
                className="border px-3 py-2 rounded w-full"
                placeholder="Enter new password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>
          <button
            className="mt-4 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
            onClick={handleSaveProfile}
          >
            Save Profile
          </button>
          {message && <p className="mt-2 text-green-600">{message}</p>}
        </div>

        {/* System Settings Section */}
        <div className="bg-white rounded-xl shadow p-6 mb-6">
          <h2 className="text-xl font-bold mb-4">System Settings</h2>
          <p className="text-sm text-gray-600">
            You can add global system preferences here.
          </p>
          {/* Example: toggle notifications */}
          <div className="mt-2">
            <label className="flex items-center gap-2">
              <input type="checkbox" />
              Enable real-time notifications for new incidents
            </label>
          </div>
        </div>

        {/* Security & Roles Section */}
        <div className="bg-white rounded-xl shadow p-6 mb-6">
          <h2 className="text-xl font-bold mb-4">Security & Roles</h2>
          <p className="text-sm text-gray-600">
            Manage admin roles, permissions, and session security.
          </p>
        </div>
      </main>
    </div>
  );
};

export default AdminSettings;
