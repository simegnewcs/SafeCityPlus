import React, { useState, useEffect } from "react";
import SuperResponderSidebar from "../layout/SuperResponderSidebar";
import {
  Settings, User, Bell, Shield, Zap, ToggleLeft, ToggleRight,
  Save, LogOut, CheckCircle, AlertCircle, ChevronRight
} from "lucide-react";
import axios from "axios";

const API_URL = "http://localhost:5000/api";

const ToggleSwitch = ({ checked, onChange }) => (
  <button
    onClick={onChange}
    className={`relative inline-flex items-center w-11 h-6 rounded-full transition-colors ${checked ? "bg-emerald-500" : "bg-slate-600"}`}
  >
    <span className={`inline-block w-4 h-4 bg-white rounded-full shadow transition-transform ${checked ? "translate-x-6" : "translate-x-1"}`} />
  </button>
);

const Section = ({ title, icon: Icon, children }) => (
  <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
    <div className="px-5 py-3.5 border-b border-slate-800 flex items-center gap-2.5 bg-slate-800/40">
      <Icon size={15} className="text-slate-400" />
      <h2 className="text-sm font-bold text-white">{title}</h2>
    </div>
    <div className="p-5 space-y-4">{children}</div>
  </div>
);

const Row = ({ label, desc, children }) => (
  <div className="flex items-center justify-between py-3 border-b border-slate-800/60 last:border-0">
    <div>
      <p className="text-sm font-medium text-white">{label}</p>
      {desc && <p className="text-xs text-slate-500 mt-0.5">{desc}</p>}
    </div>
    <div className="ml-4 flex-shrink-0">{children}</div>
  </div>
);

export default function SuperResponderSettings() {
  const user = JSON.parse(localStorage.getItem("user") || "{}");

  // Profile
  const [fullName, setFullName] = useState(user.fullName || "");
  const [phone, setPhone] = useState(user.phone || "");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  // AI settings
  const [aiAutoAssign, setAiAutoAssign] = useState(true);
  const [togglingAI, setTogglingAI] = useState(false);

  // Notifications
  const [notifSound, setNotifSound]   = useState(true);
  const [notifBanner, setNotifBanner] = useState(true);
  const [notifEmail, setNotifEmail]   = useState(false);

  useEffect(() => {
    fetchAISetting();
    const saved = localStorage.getItem("sr_notif");
    if (saved) {
      const n = JSON.parse(saved);
      setNotifSound(n.sound ?? true);
      setNotifBanner(n.banner ?? true);
      setNotifEmail(n.email ?? false);
    }
  }, []);

  const fetchAISetting = async () => {
    try {
      const res = await axios.get(`${API_URL}/super-responder/settings`);
      setAiAutoAssign(res.data?.ai_auto_assign === "true");
    } catch {}
  };

  const toggleAI = async () => {
    setTogglingAI(true);
    const newVal = !aiAutoAssign;
    try {
      await axios.put(`${API_URL}/super-responder/settings`, { key: "ai_auto_assign", value: String(newVal) });
      setAiAutoAssign(newVal);
      showMsg(newVal ? "AI Auto-Assignment enabled" : "Manual assignment mode active", "success");
    } catch {
      showMsg("Failed to update setting", "error");
    } finally { setTogglingAI(false); }
  };

  const saveProfile = async () => {
    setSaving(true);
    try {
      const body = { fullName, phone };
      if (password) body.password = password;
      await axios.put(`${API_URL}/users/${user.id}`, body);
      const updated = { ...user, fullName, phone };
      localStorage.setItem("user", JSON.stringify(updated));
      setPassword("");
      showMsg("Profile saved successfully", "success");
    } catch {
      showMsg("Failed to save profile", "error");
    } finally { setSaving(false); }
  };

  const saveNotifications = () => {
    localStorage.setItem("sr_notif", JSON.stringify({ sound: notifSound, banner: notifBanner, email: notifEmail }));
    showMsg("Notification preferences saved", "success");
  };

  const showMsg = (text, type) => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 3000);
  };

  const handleLogout = () => {
    if (window.confirm("Logout from SafeCity+ Command Center?")) {
      localStorage.removeItem("user");
      window.location.href = "/login";
    }
  };

  return (
    <div className="flex h-screen bg-slate-950 text-white overflow-hidden">
      <SuperResponderSidebar user={user} />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-14 bg-slate-900 border-b border-slate-800 px-6 flex items-center gap-3 flex-shrink-0">
          <Settings size={16} className="text-slate-400" />
          <div>
            <h1 className="text-sm font-bold">Settings</h1>
            <p className="text-[10px] text-slate-500">Command Center preferences</p>
          </div>

          {/* Toast */}
          {message && (
            <div className={`ml-auto flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold border ${
              message.type === "success"
                ? "bg-emerald-900/40 border-emerald-700/50 text-emerald-300"
                : "bg-red-900/40 border-red-700/50 text-red-300"
            }`}>
              {message.type === "success" ? <CheckCircle size={13} /> : <AlertCircle size={13} />}
              {message.text}
            </div>
          )}
        </header>

        <div className="flex-1 overflow-y-auto p-6 space-y-5 max-w-2xl">

          {/* AI Assignment */}
          <Section title="AI Auto-Assignment" icon={Zap}>
            <Row
              label="Enable AI Auto-Assign"
              desc="When ON, AI automatically dispatches incidents to the correct responder teams based on incident category."
            >
              <button onClick={toggleAI} disabled={togglingAI}
                className={`transition-all ${togglingAI ? "opacity-50 cursor-not-allowed" : ""}`}>
                {aiAutoAssign
                  ? <ToggleRight size={32} className="text-emerald-400" />
                  : <ToggleLeft size={32} className="text-slate-500" />}
              </button>
            </Row>

            {/* Status indicator */}
            <div className={`rounded-xl p-3.5 border text-xs leading-relaxed ${
              aiAutoAssign
                ? "bg-emerald-950/30 border-emerald-800/40 text-emerald-300"
                : "bg-slate-800 border-slate-700 text-slate-400"
            }`}>
              {aiAutoAssign
                ? "🟢 AI is active — incidents are automatically assigned to specialized responders upon detection."
                : "🔴 Manual mode — you must review and assign each incident from the Incident Queue."}
            </div>

            {/* Assignment map */}
            <div className="bg-slate-800/60 rounded-xl border border-slate-700 overflow-hidden">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider px-4 py-2.5 border-b border-slate-700">
                Assignment Logic
              </p>
              {[
                { cat: "Vehicle Collision",     types: "🚔 Traffic Police · 🚑 Ambulance" },
                { cat: "Fire / Smoke",          types: "🔥 Fire Brigade" },
                { cat: "Medical Emergency",     types: "🚑 Ambulance / Medical" },
                { cat: "Construction Accident", types: "🏗️ Construction Safety" },
                { cat: "Flood / Disaster",      types: "🌊 Disaster Management" },
                { cat: "Violence / Crime",      types: "🔫 Armed Police" },
                { cat: "Road Blockage",         types: "🚔 Traffic Police · 🛣️ Road Safety" },
                { cat: "Crowd Panic",           types: "🔫 Armed Police · 🚑 Ambulance" },
              ].map(({ cat, types }) => (
                <div key={cat} className="flex items-center justify-between px-4 py-2.5 border-b border-slate-700/50 last:border-0 hover:bg-slate-700/30 transition-colors">
                  <span className="text-xs font-semibold text-white">{cat}</span>
                  <span className="text-[10px] text-slate-400">{types}</span>
                </div>
              ))}
            </div>
          </Section>

          {/* Profile */}
          <Section title="Profile" icon={User}>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">Full Name</label>
                <input
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-slate-500 transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">Phone</label>
                <input
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-slate-500 transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">New Password <span className="text-slate-600 font-normal">(leave blank to keep current)</span></label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-slate-500 transition-colors"
                />
              </div>
              <button onClick={saveProfile} disabled={saving}
                className="flex items-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-xl text-sm font-bold transition-colors disabled:opacity-50">
                <Save size={14} />
                {saving ? "Saving..." : "Save Profile"}
              </button>
            </div>
          </Section>

          {/* Notifications */}
          <Section title="Notifications" icon={Bell}>
            <Row label="Alert Sound" desc="Play sound on new critical incidents">
              <ToggleSwitch checked={notifSound} onChange={() => setNotifSound(p => !p)} />
            </Row>
            <Row label="Banner Alerts" desc="Show pop-up banners for AI detections">
              <ToggleSwitch checked={notifBanner} onChange={() => setNotifBanner(p => !p)} />
            </Row>
            <Row label="Email Notifications" desc="Receive email for critical incidents">
              <ToggleSwitch checked={notifEmail} onChange={() => setNotifEmail(p => !p)} />
            </Row>
            <button onClick={saveNotifications}
              className="flex items-center gap-2 px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-sm font-bold transition-colors">
              <Save size={14} /> Save Preferences
            </button>
          </Section>

          {/* Account */}
          <Section title="Account" icon={Shield}>
            <Row label="Role" desc="Your access level in SafeCity+">
              <span className="text-xs font-bold px-2.5 py-1 bg-orange-900/40 border border-orange-700/50 text-orange-300 rounded-full">
                ⬛ Super Responder
              </span>
            </Row>
            <Row label="Session">
              <button onClick={handleLogout}
                className="flex items-center gap-2 px-3 py-2 bg-red-900/30 border border-red-800/50 text-red-300 rounded-xl text-xs font-bold hover:bg-red-900/50 transition-colors">
                <LogOut size={13} /> Logout
              </button>
            </Row>
          </Section>

        </div>
      </div>
    </div>
  );
}
