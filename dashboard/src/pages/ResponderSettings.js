// src/pages/ResponderSettings.js
import React, { useState, useEffect } from "react";
import ResponderSidebar from "../layout/ResponderSidebar";
import axios from "axios";
import { 
  User, Bell, Settings as SettingsIcon, Shield, Save, 
  Phone, Mail, Lock, Eye, EyeOff, Moon, Sun, Globe,
  CheckCircle, AlertCircle, RefreshCw, LogOut, Trash2,
  Activity, MapPin, Clock, Users, FileText
} from "lucide-react";

const API_URL = "http://localhost:5000/api";

const ResponderSettings = () => {
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ text: "", type: "" });

  // Profile state
  const [fullName, setFullName] = useState(user?.full_name || user?.fullName || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [email, setEmail] = useState(user?.email || "");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // System Preferences
  const [darkMode, setDarkMode] = useState(localStorage.getItem("darkMode") === "true");
  const [language, setLanguage] = useState(localStorage.getItem("language") || "en");

  // Notification Preferences
  const [notifications, setNotifications] = useState({
    realTimeAlerts: true,
    highPriorityOnly: false,
    emailAlerts: true,
    smsAlerts: false,
  });

  // Work Preferences
  const [workPrefs, setWorkPrefs] = useState({
    autoAccept: true,
    showCCTV: true,
    showHeatmap: true,
    autoNavigate: false,
  });

  // Apply dark mode
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("darkMode", "true");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("darkMode", "false");
    }
  }, [darkMode]);

  const showMessage = (text, type = "success") => {
    setMessage({ text, type });
    setTimeout(() => setMessage({ text: "", type: "" }), 3000);
  };

  const handleSaveProfile = async () => {
    setIsSaving(true);
    try {
      const updateData = {
        full_name: fullName,
        phone,
        email,
        ...(password && { password }),
      };
      await axios.put(`${API_URL}/users/${user.id}`, updateData);

      // Update localStorage
      const updatedUser = { ...user, full_name: fullName, phone, email };
      localStorage.setItem("user", JSON.stringify(updatedUser));

      showMessage("Profile updated successfully!", "success");
      setPassword("");
    } catch (error) {
      console.error(error);
      showMessage(error.response?.data?.message || "Failed to update profile", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSavePreferences = () => {
    localStorage.setItem("language", language);
    localStorage.setItem("notifications", JSON.stringify(notifications));
    localStorage.setItem("workPrefs", JSON.stringify(workPrefs));
    showMessage("Preferences saved successfully!", "success");
  };

  const toggleNotification = (key) => {
    setNotifications(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleWorkPref = (key) => {
    setWorkPrefs(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleLogout = () => {
    if (window.confirm("Are you sure you want to logout?")) {
      localStorage.clear();
      window.location.href = "/login";
    }
  };

  const SettingSection = ({ title, icon: Icon, children }) => (
    <div className="bg-white border border-zinc-200 rounded-2xl shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-zinc-100 bg-zinc-50/50 flex items-center gap-3">
        <div className="p-1.5 bg-blue-100 rounded-lg">
          <Icon size={18} className="text-blue-600" />
        </div>
        <h2 className="text-lg font-semibold text-zinc-900">{title}</h2>
      </div>
      <div className="p-6">{children}</div>
    </div>
  );

  const SettingRow = ({ label, description, children }) => (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between py-4 border-b border-zinc-100 last:border-0">
      <div className="mb-2 sm:mb-0">
        <p className="font-medium text-zinc-900">{label}</p>
        {description && <p className="text-sm text-zinc-500">{description}</p>}
      </div>
      <div>{children}</div>
    </div>
  );

  const ToggleSwitch = ({ checked, onChange }) => (
    <button
      onClick={onChange}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
        checked ? "bg-blue-600" : "bg-zinc-300"
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
          checked ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  );

  return (
    <div className={`flex h-screen bg-zinc-50 overflow-hidden ${darkMode ? "dark" : ""}`}>
      <ResponderSidebar activeTab="settings" setActiveTab={() => {}} user={user} />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Notification Toast */}
        {message.text && (
          <div className={`fixed top-20 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg animate-slide-in ${
            message.type === "success" ? "bg-emerald-500 text-white" : "bg-red-500 text-white"
          }`}>
            {message.type === "success" ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
            <span className="text-sm font-medium">{message.text}</span>
          </div>
        )}

        {/* Top Navbar */}
        <header className="h-16 bg-white border-b border-zinc-200 px-6 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-4">
            <div className="p-2 bg-blue-100 rounded-xl">
              <SettingsIcon className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
              <p className="text-sm text-zinc-500">Manage your profile and preferences</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl text-sm font-medium transition-colors"
            >
              <LogOut size={16} />
              Logout
            </button>
          </div>
        </header>

        <main className="flex-1 p-6 md:p-8 overflow-auto space-y-6">
          {/* Profile Section */}
          <SettingSection title="Profile Information" icon={User}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1.5">Full Name</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                  <input
                    type="text"
                    className="w-full pl-10 pr-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl focus:border-blue-400 focus:ring-1 focus:ring-blue-400 outline-none transition-all"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1.5">Phone Number</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                  <input
                    type="tel"
                    className="w-full pl-10 pr-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl focus:border-blue-400 focus:ring-1 focus:ring-blue-400 outline-none transition-all"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-zinc-700 mb-1.5">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                  <input
                    type="email"
                    className="w-full pl-10 pr-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl focus:border-blue-400 focus:ring-1 focus:ring-blue-400 outline-none transition-all"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-zinc-700 mb-1.5">New Password (optional)</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                  <input
                    type={showPassword ? "text" : "password"}
                    className="w-full pl-10 pr-10 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl focus:border-blue-400 focus:ring-1 focus:ring-blue-400 outline-none transition-all"
                    placeholder="Leave blank to keep current password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
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
            </div>

            <button
              onClick={handleSaveProfile}
              disabled={isSaving}
              className="mt-6 flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-6 py-2.5 rounded-xl font-medium transition-all"
            >
              {isSaving ? <RefreshCw size={18} className="animate-spin" /> : <Save size={18} />}
              {isSaving ? "Saving..." : "Save Profile"}
            </button>
          </SettingSection>

          {/* Appearance Preferences */}
          <SettingSection title="Appearance" icon={Sun}>
            <SettingRow label="Dark Mode" description="Switch between light and dark theme">
              <ToggleSwitch checked={darkMode} onChange={() => setDarkMode(!darkMode)} />
            </SettingRow>
            <SettingRow label="Language" description="Select your preferred language">
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="px-4 py-2 bg-zinc-50 border border-zinc-200 rounded-xl focus:border-blue-400 outline-none"
              >
                <option value="en">English</option>
                <option value="am">አማርኛ (Amharic)</option>
                <option value="fr">Français</option>
              </select>
            </SettingRow>
          </SettingSection>

          {/* Notification Preferences */}
          <SettingSection title="Notifications" icon={Bell}>
            <SettingRow label="Real-time Alerts" description="Receive push notifications for new assignments">
              <ToggleSwitch checked={notifications.realTimeAlerts} onChange={() => toggleNotification("realTimeAlerts")} />
            </SettingRow>
            <SettingRow label="High Priority Only" description="Only notify for High or Critical incidents">
              <ToggleSwitch checked={notifications.highPriorityOnly} onChange={() => toggleNotification("highPriorityOnly")} />
            </SettingRow>
            <SettingRow label="Email Alerts" description="Receive email notifications for incidents">
              <ToggleSwitch checked={notifications.emailAlerts} onChange={() => toggleNotification("emailAlerts")} />
            </SettingRow>
            <SettingRow label="SMS Alerts" description="Receive SMS alerts for urgent incidents">
              <ToggleSwitch checked={notifications.smsAlerts} onChange={() => toggleNotification("smsAlerts")} />
            </SettingRow>
          </SettingSection>

          {/* Work Preferences */}
          <SettingSection title="Work Preferences" icon={Shield}>
            <SettingRow label="Auto-accept Assignments" description="Automatically accept new incidents assigned to you">
              <ToggleSwitch checked={workPrefs.autoAccept} onChange={() => toggleWorkPref("autoAccept")} />
            </SettingRow>
            <SettingRow label="Show CCTV Alerts" description="Display CCTV-detected incidents on your dashboard">
              <ToggleSwitch checked={workPrefs.showCCTV} onChange={() => toggleWorkPref("showCCTV")} />
            </SettingRow>
            <SettingRow label="Show Heatmap" description="Display incident heatmap on dashboard">
              <ToggleSwitch checked={workPrefs.showHeatmap} onChange={() => toggleWorkPref("showHeatmap")} />
            </SettingRow>
            <SettingRow label="Auto-navigate" description="Automatically open navigation to incident location">
              <ToggleSwitch checked={workPrefs.autoNavigate} onChange={() => toggleWorkPref("autoNavigate")} />
            </SettingRow>
          </SettingSection>

          {/* Save All Preferences */}
          <div className="flex justify-end">
            <button
              onClick={handleSavePreferences}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2.5 rounded-xl font-medium transition-all"
            >
              <Save size={18} />
              Save All Preferences
            </button>
          </div>

          {/* Account Information */}
          <div className="bg-white border border-zinc-200 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <FileText size={18} className="text-zinc-400" />
              <h3 className="font-semibold text-zinc-900">Account Information</h3>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between py-2 border-b border-zinc-100">
                <span className="text-zinc-500">Account Type</span>
                <span className="text-zinc-900 font-medium">Responder</span>
              </div>
              <div className="flex justify-between py-2 border-b border-zinc-100">
                <span className="text-zinc-500">Member Since</span>
                <span className="text-zinc-900 font-medium">{new Date(user?.created_at || Date.now()).toLocaleDateString()}</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-zinc-500">Status</span>
                <span className="text-emerald-600 font-medium">● Active</span>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default ResponderSettings;