// src/pages/AdminSettings.js
import React, { useState, useEffect, useCallback } from "react";
import AdminSidebar from "../layout/AdminSidebar";
import PageHeader from "../layout/PageHeader";
import axios from "axios";
import { 
  User, Phone, Mail, Lock, Save, Shield, Bell, 
  Moon, Sun, Globe, Database, Trash2, RefreshCw,
  CheckCircle, AlertCircle, Eye, EyeOff, Settings as SettingsIcon,
  Activity, Users, MapPin, Clock, Download, Upload
} from "lucide-react";

const API_URL = "http://localhost:5000/api";

const AdminSettings = () => {
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const [loading, setLoading] = useState(false);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [message, setMessage] = useState({ text: "", type: "" });
  
  // Profile state
  const [fullName, setFullName] = useState(user?.fullName || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [email, setEmail] = useState(user?.email || "");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  
  // System Settings
  const [darkMode, setDarkMode] = useState(false);
  const [notifications, setNotifications] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(30);
  const [language, setLanguage] = useState("en");
  
  // Security Settings
  const [twoFactorAuth, setTwoFactorAuth] = useState(false);
  const [sessionTimeout, setSessionTimeout] = useState(60);
  
  // Database Settings
  const [backupSchedule, setBackupSchedule] = useState("daily");
  const [dataRetention, setDataRetention] = useState(90);
  
  // Notification Settings
  const [emailAlerts, setEmailAlerts] = useState(true);
  const [smsAlerts, setSmsAlerts] = useState(false);
  const [criticalOnly, setCriticalOnly] = useState(false);

  // Fetch settings from backend
  const fetchSettings = useCallback(async () => {
    try {
      setSettingsLoading(true);
      const response = await axios.get(`${API_URL}/system-settings`);
      const settings = response.data;
      
      // Update all settings states
      setDarkMode(settings.dark_mode || false);
      setAutoRefresh(settings.auto_refresh || true);
      setRefreshInterval(settings.refresh_interval || 30);
      setLanguage(settings.language || "en");
      setDataRetention(settings.data_retention || 90);
      setEmailAlerts(settings.email_alerts || true);
      setSmsAlerts(settings.sms_alerts || false);
      setCriticalOnly(settings.critical_only || false);
      setBackupSchedule(settings.backup_schedule || "daily");
      setTwoFactorAuth(settings.two_factor_auth || false);
      setSessionTimeout(settings.session_timeout || 60);
      
      // Apply dark mode immediately
      if (settings.dark_mode) {
        document.documentElement.classList.add("dark");
        localStorage.setItem("darkMode", "true");
      } else {
        document.documentElement.classList.remove("dark");
        localStorage.setItem("darkMode", "false");
      }
      
    } catch (error) {
      console.error("Error fetching settings:", error);
      showMessage("Error loading settings", "error");
    } finally {
      setSettingsLoading(false);
    }
  }, []);

  // Load settings on component mount
  useEffect(() => {
    fetchSettings();
  }, []);

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
    setLoading(true);
    try {
      const updateData = {
        full_name: fullName,
        phone: phone,
        ...(email && { email }),
        ...(password && { password }),
      };
      await axios.put(`${API_URL}/users/${user.id}`, updateData);
      
      // Update local storage
      const updatedUser = { ...user, fullName, phone, email };
      localStorage.setItem("user", JSON.stringify(updatedUser));
      
      showMessage("Profile updated successfully!", "success");
      setPassword("");
    } catch (err) {
      console.error(err);
      showMessage(err.response?.data?.message || "Error updating profile", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSystemSettings = async () => {
    setLoading(true);
    try {
      await axios.put(`${API_URL}/system-settings`, {
        dark_mode: darkMode,
        auto_refresh: autoRefresh,
        refresh_interval: refreshInterval,
        language: language,
        data_retention: dataRetention
      });
      
      // Also save to localStorage for immediate effect
      localStorage.setItem("autoRefresh", autoRefresh);
      localStorage.setItem("refreshInterval", refreshInterval);
      localStorage.setItem("language", language);
      
      showMessage("System settings saved successfully!", "success");
    } catch (error) {
      console.error("Error saving system settings:", error);
      showMessage("Error saving system settings", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSecuritySettings = async () => {
    setLoading(true);
    try {
      await axios.put(`${API_URL}/system-settings`, {
        two_factor_auth: twoFactorAuth,
        session_timeout: sessionTimeout
      });
      
      showMessage("Security settings saved successfully!", "success");
    } catch (error) {
      console.error("Error saving security settings:", error);
      showMessage("Error saving security settings", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveNotificationSettings = async () => {
    setLoading(true);
    try {
      await axios.put(`${API_URL}/system-settings`, {
        email_alerts: emailAlerts,
        sms_alerts: smsAlerts,
        critical_only: criticalOnly,
        backup_schedule: backupSchedule
      });
      
      showMessage("Notification settings saved successfully!", "success");
    } catch (error) {
      console.error("Error saving notification settings:", error);
      showMessage("Error saving notification settings", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleBackup = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_URL}/incidents/export`, {
        responseType: "blob",
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `backup_${new Date().toISOString()}.json`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      showMessage("Backup downloaded successfully!", "success");
    } catch (error) {
      console.error("Backup error:", error);
      showMessage("Failed to create backup", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleClearCache = () => {
    if (window.confirm("Are you sure you want to clear all cached data?")) {
      localStorage.clear();
      sessionStorage.clear();
      window.location.reload();
    }
  };

  const SettingSection = ({ title, icon: Icon, children }) => (
    <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 overflow-hidden mb-6">
      <div className="px-6 py-4 border-b border-zinc-100 bg-zinc-50/50 flex items-center gap-3">
        <div className="p-1.5 bg-emerald-100 rounded-lg">
          <Icon size={18} className="text-emerald-600" />
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

  return (
    <div className={`flex h-screen ${darkMode ? "dark" : ""}`}>
      <AdminSidebar user={user} />

      <div className="flex-1 flex flex-col overflow-hidden bg-slate-50 dark:bg-zinc-900">
        <PageHeader
          title="Settings"
          subtitle="Manage your account and system preferences"
          icon={<SettingsIcon size={16} />}
          loading={loading || settingsLoading}
          user={user}
        />
        {message.text && (
          <div className={`mx-6 mt-3 flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium ${
            message.type === "success" ? "bg-emerald-50 border border-emerald-200 text-emerald-700" : "bg-red-50 border border-red-200 text-red-700"
          }`}>
            {message.type === "success" ? <CheckCircle size={15} /> : <AlertCircle size={15} />}
            {message.text}
          </div>
        )}

        {/* Main Content */}
        <main className="flex-1 overflow-auto p-6 md:p-8">
          <div className="max-w-4xl mx-auto">
            {/* Profile Section */}
            <SettingSection title="Profile Information" icon={User}>
              <div className="space-y-4">
                <SettingRow label="Full Name" description="Your display name in the system">
                  <input
                    key="fullName"
                    type="text"
                    className="w-full sm:w-80 px-4 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 outline-none transition-all dark:text-white caret-emerald-600"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                  />
                </SettingRow>

                <SettingRow label="Phone Number" description="Contact number for SMS alerts">
                  <input
                    key="phone"
                    type="tel"
                    className="w-full sm:w-80 px-4 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 outline-none transition-all dark:text-white caret-emerald-600"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </SettingRow>

                <SettingRow label="Email Address" description="For email notifications">
                  <input
                    key="email"
                    type="email"
                    className="w-full sm:w-80 px-4 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 outline-none transition-all dark:text-white caret-emerald-600"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </SettingRow>

                <SettingRow label="Password" description="Leave blank to keep current">
                  <div className="relative w-full sm:w-80">
                    <input
                      key="password"
                      type={showPassword ? "text" : "password"}
                      className="w-full px-4 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 outline-none transition-all dark:text-white pr-10 caret-emerald-600"
                      placeholder="Enter new password"
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
                </SettingRow>

                <div className="pt-4">
                  <button
                    onClick={handleSaveProfile}
                    disabled={loading}
                    className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-medium transition-all disabled:opacity-50"
                  >
                    {loading ? <RefreshCw size={18} className="animate-spin" /> : <Save size={18} />}
                    Save Profile
                  </button>
                </div>
              </div>
            </SettingSection>

            {/* System Settings */}
            <SettingSection title="System Settings" icon={SettingsIcon}>
              <div className="space-y-4">
                <SettingRow label="Dark Mode" description="Switch between light and dark theme">
                  <button
                    onClick={() => setDarkMode(!darkMode)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all ${
                      darkMode ? "bg-zinc-800 text-white" : "bg-zinc-100 text-zinc-900"
                    }`}
                  >
                    {darkMode ? <Moon size={18} /> : <Sun size={18} />}
                    {darkMode ? "Dark" : "Light"}
                  </button>
                </SettingRow>

                <SettingRow label="Auto Refresh" description="Automatically refresh dashboard data">
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={autoRefresh}
                      onChange={(e) => setAutoRefresh(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-zinc-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                  </label>
                </SettingRow>

                {autoRefresh && (
                  <SettingRow label="Refresh Interval" description="How often to refresh data (seconds)">
                    <select
                      value={refreshInterval}
                      onChange={(e) => setRefreshInterval(parseInt(e.target.value))}
                      className="px-4 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl focus:border-emerald-400 outline-none dark:text-white"
                    >
                      <option value={15}>15 seconds</option>
                      <option value={30}>30 seconds</option>
                      <option value={60}>1 minute</option>
                      <option value={300}>5 minutes</option>
                    </select>
                  </SettingRow>
                )}

                <SettingRow label="Language" description="Select your preferred language">
                  <select
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    className="px-4 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl focus:border-emerald-400 outline-none dark:text-white"
                  >
                    <option value="en">English</option>
                    <option value="am">አማርኛ (Amharic)</option>
                    <option value="fr">Français</option>
                  </select>
                </SettingRow>

                <div className="pt-4">
                  <button
                    onClick={handleSaveSystemSettings}
                    disabled={loading}
                    className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-medium transition-all disabled:opacity-50"
                  >
                    {loading ? <RefreshCw size={18} className="animate-spin" /> : <Save size={18} />}
                    Save System Settings
                  </button>
                </div>
              </div>
            </SettingSection>

            {/* Notification Settings */}
            <SettingSection title="Notifications" icon={Bell}>
              <div className="space-y-4">
                <SettingRow label="Email Alerts" description="Receive email notifications for new incidents">
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={emailAlerts}
                      onChange={(e) => setEmailAlerts(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-zinc-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                  </label>
                </SettingRow>

                <SettingRow label="SMS Alerts" description="Receive SMS alerts for critical incidents">
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={smsAlerts}
                      onChange={(e) => setSmsAlerts(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-zinc-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                  </label>
                </SettingRow>

                <SettingRow label="Critical Incidents Only" description="Only receive alerts for high priority incidents">
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={criticalOnly}
                      onChange={(e) => setCriticalOnly(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-zinc-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                  </label>
                </SettingRow>

                <div className="pt-4">
                  <button
                    onClick={handleSaveNotificationSettings}
                    disabled={loading}
                    className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-medium transition-all disabled:opacity-50"
                  >
                    {loading ? <RefreshCw size={18} className="animate-spin" /> : <Save size={18} />}
                    Save Notification Settings
                  </button>
                </div>
              </div>
            </SettingSection>

            {/* Security Settings */}
            <SettingSection title="Security & Privacy" icon={Shield}>
              <div className="space-y-4">
                <SettingRow label="Two-Factor Authentication" description="Add an extra layer of security">
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={twoFactorAuth}
                      onChange={(e) => setTwoFactorAuth(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-zinc-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                  </label>
                </SettingRow>

                <SettingRow label="Session Timeout" description="Auto logout after inactivity (minutes)">
                  <select
                    value={sessionTimeout}
                    onChange={(e) => setSessionTimeout(parseInt(e.target.value))}
                    className="px-4 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl focus:border-emerald-400 outline-none dark:text-white"
                  >
                    <option value={15}>15 minutes</option>
                    <option value={30}>30 minutes</option>
                    <option value={60}>1 hour</option>
                    <option value={120}>2 hours</option>
                  </select>
                </SettingRow>

                <div className="pt-4">
                  <button
                    onClick={handleSaveSecuritySettings}
                    disabled={loading}
                    className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-medium transition-all disabled:opacity-50"
                  >
                    {loading ? <RefreshCw size={18} className="animate-spin" /> : <Save size={18} />}
                    Save Security Settings
                  </button>
                </div>
              </div>
            </SettingSection>

            {/* Data Management */}
            <SettingSection title="Data Management" icon={Database}>
              <div className="space-y-4">
                <SettingRow label="Backup Data" description="Download a backup of all incident data">
                  <button
                    onClick={handleBackup}
                    disabled={loading}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-medium transition-all"
                  >
                    <Download size={16} />
                    Download Backup
                  </button>
                </SettingRow>

                <SettingRow label="Data Retention" description="Keep data for (days)">
                  <select
                    value={dataRetention}
                    onChange={(e) => setDataRetention(parseInt(e.target.value))}
                    className="px-4 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl focus:border-emerald-400 outline-none dark:text-white"
                  >
                    <option value={30}>30 days</option>
                    <option value={60}>60 days</option>
                    <option value={90}>90 days</option>
                    <option value={180}>180 days</option>
                    <option value={365}>1 year</option>
                  </select>
                </SettingRow>

                <SettingRow label="Clear Cache" description="Clear all cached application data">
                  <button
                    onClick={handleClearCache}
                    className="flex items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-xl font-medium transition-all"
                  >
                    <Trash2 size={16} />
                    Clear Cache
                  </button>
                </SettingRow>
              </div>
            </SettingSection>

            {/* System Info */}
            <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-zinc-900">System Information</h3>
                  <p className="text-sm text-zinc-500 mt-1">Version and system status</p>
                </div>
                <Activity size={20} className="text-emerald-600" />
              </div>
              <div className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between py-2 border-b border-zinc-100">
                  <span className="text-zinc-500">Version</span>
                  <span className="text-zinc-900 font-medium">v2.0.0</span>
                </div>
                <div className="flex justify-between py-2 border-b border-zinc-100">
                  <span className="text-zinc-500">Last Update</span>
                  <span className="text-zinc-900 font-medium">April 2, 2026</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-zinc-500">Environment</span>
                  <span className="text-zinc-900 font-medium">Production</span>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default AdminSettings;