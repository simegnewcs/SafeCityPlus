// src/pages/ResponderSettings.js
import React, { useState } from "react";
import ResponderSidebar from "../layout/ResponderSidebar";
import axios from "axios";
import { User, Bell, Settings as SettingsIcon, Shield, Save } from "lucide-react";

const ResponderSettings = () => {
  const user = JSON.parse(localStorage.getItem("user") || "{}");

  const [fullName, setFullName] = useState(user?.full_name || user?.fullName || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [email, setEmail] = useState(user?.email || "");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Notification & Preference States
  const [notifications, setNotifications] = useState({
    realTimeAlerts: true,
    highPriorityOnly: false,
    autoAccept: true,
    showCCTV: true,
  });

  const handleSaveProfile = async () => {
    setIsSaving(true);
    setMessage("");

    try {
      await axios.put(`http://localhost:5000/api/users/${user.id}`, {
        full_name: fullName,
        phone,
        email,
        ...(password && { password }),
      });

      // Update localStorage
      localStorage.setItem("user", JSON.stringify({
        ...user,
        full_name: fullName,
        phone,
        email,
      }));

      setMessage("✅ Profile updated successfully!");
      setPassword(""); // Clear password field
    } catch (err) {
      console.error(err);
      setMessage("❌ Failed to update profile. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const toggleNotification = (key) => {
    setNotifications(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  return (
    <div className="flex h-screen bg-zinc-50 overflow-hidden">
      <ResponderSidebar 
        activeTab="settings" 
        setActiveTab={() => {}} 
        user={user} 
      />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Navbar */}
        <header className="h-16 bg-white border-b border-zinc-200 px-6 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-4">
            <SettingsIcon className="w-7 h-7 text-blue-600" />
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
              <p className="text-sm text-zinc-500">Manage your profile and preferences</p>
            </div>
          </div>
        </header>

        <main className="flex-1 p-6 md:p-8 overflow-auto space-y-8">
          
          {/* Profile Section */}
          <div className="bg-white border border-zinc-200 rounded-3xl shadow-sm p-8">
            <div className="flex items-center gap-3 mb-6">
              <User className="w-6 h-6 text-blue-600" />
              <h2 className="text-xl font-semibold">Profile Information</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-zinc-600 mb-2">Full Name</label>
                <input
                  type="text"
                  className="w-full px-4 py-3 border border-zinc-200 rounded-2xl focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-600 mb-2">Phone Number</label>
                <input
                  type="tel"
                  className="w-full px-4 py-3 border border-zinc-200 rounded-2xl focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-zinc-600 mb-2">Email Address</label>
                <input
                  type="email"
                  className="w-full px-4 py-3 border border-zinc-200 rounded-2xl focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-zinc-600 mb-2">New Password (optional)</label>
                <input
                  type="password"
                  className="w-full px-4 py-3 border border-zinc-200 rounded-2xl focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                  placeholder="Leave blank to keep current password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            <button
              onClick={handleSaveProfile}
              disabled={isSaving}
              className="mt-8 flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-8 py-3 rounded-2xl font-medium transition-all active:scale-95"
            >
              <Save size={18} />
              {isSaving ? "Saving..." : "Save Profile"}
            </button>

            {message && (
              <p className={`mt-4 text-sm ${message.includes("✅") ? "text-emerald-600" : "text-red-600"}`}>
                {message}
              </p>
            )}
          </div>

          {/* Notifications */}
          <div className="bg-white border border-zinc-200 rounded-3xl shadow-sm p-8">
            <div className="flex items-center gap-3 mb-6">
              <Bell className="w-6 h-6 text-blue-600" />
              <h2 className="text-xl font-semibold">Notifications</h2>
            </div>

            <div className="space-y-5">
              <label className="flex items-center justify-between cursor-pointer group">
                <div>
                  <p className="font-medium">Real-time Incident Alerts</p>
                  <p className="text-sm text-zinc-500">Receive push notifications for new assignments</p>
                </div>
                <div className={`w-12 h-6 rounded-full transition-all ${notifications.realTimeAlerts ? 'bg-blue-600' : 'bg-zinc-300'}`}>
                  <div className={`w-5 h-5 bg-white rounded-full shadow mt-0.5 transition-all ${notifications.realTimeAlerts ? 'ml-7' : 'ml-1'}`} />
                </div>
                <input 
                  type="checkbox" 
                  className="hidden" 
                  checked={notifications.realTimeAlerts}
                  onChange={() => toggleNotification('realTimeAlerts')}
                />
              </label>

              <label className="flex items-center justify-between cursor-pointer group">
                <div>
                  <p className="font-medium">High Priority Only</p>
                  <p className="text-sm text-zinc-500">Only notify for High or Critical incidents</p>
                </div>
                <div className={`w-12 h-6 rounded-full transition-all ${notifications.highPriorityOnly ? 'bg-blue-600' : 'bg-zinc-300'}`}>
                  <div className={`w-5 h-5 bg-white rounded-full shadow mt-0.5 transition-all ${notifications.highPriorityOnly ? 'ml-7' : 'ml-1'}`} />
                </div>
                <input 
                  type="checkbox" 
                  className="hidden" 
                  checked={notifications.highPriorityOnly}
                  onChange={() => toggleNotification('highPriorityOnly')}
                />
              </label>
            </div>
          </div>

          {/* Work Preferences */}
          <div className="bg-white border border-zinc-200 rounded-3xl shadow-sm p-8">
            <div className="flex items-center gap-3 mb-6">
              <Shield className="w-6 h-6 text-blue-600" />
              <h2 className="text-xl font-semibold">Work Preferences</h2>
            </div>

            <div className="space-y-5">
              <label className="flex items-center justify-between cursor-pointer group">
                <div>
                  <p className="font-medium">Auto-accept Assignments</p>
                  <p className="text-sm text-zinc-500">Automatically accept new incidents assigned to you</p>
                </div>
                <div className={`w-12 h-6 rounded-full transition-all ${notifications.autoAccept ? 'bg-blue-600' : 'bg-zinc-300'}`}>
                  <div className={`w-5 h-5 bg-white rounded-full shadow mt-0.5 transition-all ${notifications.autoAccept ? 'ml-7' : 'ml-1'}`} />
                </div>
                <input 
                  type="checkbox" 
                  className="hidden" 
                  checked={notifications.autoAccept}
                  onChange={() => toggleNotification('autoAccept')}
                />
              </label>

              <label className="flex items-center justify-between cursor-pointer group">
                <div>
                  <p className="font-medium">Show CCTV Alerts</p>
                  <p className="text-sm text-zinc-500">Display CCTV-detected incidents on your dashboard</p>
                </div>
                <div className={`w-12 h-6 rounded-full transition-all ${notifications.showCCTV ? 'bg-blue-600' : 'bg-zinc-300'}`}>
                  <div className={`w-5 h-5 bg-white rounded-full shadow mt-0.5 transition-all ${notifications.showCCTV ? 'ml-7' : 'ml-1'}`} />
                </div>
                <input 
                  type="checkbox" 
                  className="hidden" 
                  checked={notifications.showCCTV}
                  onChange={() => toggleNotification('showCCTV')}
                />
              </label>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default ResponderSettings;