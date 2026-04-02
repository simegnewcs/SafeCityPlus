// src/pages/ResponderDashboard.js
import React, { useEffect, useState, useMemo } from "react";
import ResponderSidebar from "../layout/ResponderSidebar";
import MapView from "../components/MapView";
import axios from "axios";
import { 
  Shield, MapPin, Clock, CheckCircle, AlertTriangle, 
  RefreshCw, Navigation, Phone, Eye, Activity,
  X, Calendar, Users, Bell, TrendingUp
} from "lucide-react";

const API_URL = "http://localhost:5000/api";

const ResponderDashboard = () => {
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [selectedIncident, setSelectedIncident] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [notification, setNotification] = useState({ show: false, message: "", type: "" });

  // Fetch incidents assigned to this responder
  const fetchIncidents = async () => {
    try {
      setLoading(true);
      // Get all incidents assigned to this responder
      const response = await axios.get(`${API_URL}/incidents`);
      const allIncidents = response.data;
      // Filter incidents assigned to this responder
      const assignedIncidents = allIncidents.filter(i => 
        i.assigned_responder_id === user.id || 
        (i.user_id === user.id && user.role === "Responder")
      );
      setIncidents(assignedIncidents);
      setLastUpdated(new Date());
    } catch (error) {
      console.error("Error fetching incidents:", error);
      showNotification("Failed to load incidents", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIncidents();
    // Refresh every 30 seconds
    const interval = setInterval(fetchIncidents, 30000);
    return () => clearInterval(interval);
  }, [user.id]);

  const showNotification = (message, type) => {
    setNotification({ show: true, message, type });
    setTimeout(() => setNotification({ show: false, message: "", type: "" }), 3000);
  };

  const stats = useMemo(() => {
    const total = incidents.length;
    const inProgress = incidents.filter((i) => i.status === "In Progress").length;
    const resolved = incidents.filter((i) => i.status === "Resolved").length;
    const pending = incidents.filter((i) => i.status === "Pending" || !i.status).length;
    const highPriority = incidents.filter((i) => i.priority === "High" || i.priority === "Critical").length;

    return { total, inProgress, resolved, pending, highPriority };
  }, [incidents]);

  const updateIncidentStatus = async (incidentId, status) => {
    setUpdatingStatus(true);
    try {
      await axios.put(`${API_URL}/incidents/${incidentId}`, { status });
      showNotification(`Incident status updated to ${status}`, "success");
      fetchIncidents();
      setShowModal(false);
    } catch (error) {
      console.error("Error updating status:", error);
      showNotification("Failed to update status", "error");
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleViewDetails = (incident) => {
    setSelectedIncident(incident);
    setShowModal(true);
  };

  const getPriorityColor = (priority) => {
    switch (priority?.toLowerCase()) {
      case 'critical': return 'bg-red-100 text-red-700 border-red-200';
      case 'high': return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'medium': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      default: return 'bg-green-100 text-green-700 border-green-200';
    }
  };

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'resolved': return 'bg-green-100 text-green-700';
      case 'in progress': return 'bg-blue-100 text-blue-700';
      default: return 'bg-yellow-100 text-yellow-700';
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  const handleRefresh = () => {
    fetchIncidents();
  };

  const StatCard = ({ title, value, icon, color = "blue" }) => {
    const colorMap = {
      blue: "border-blue-200 text-blue-600 bg-blue-50/30",
      emerald: "border-emerald-200 text-emerald-600 bg-emerald-50/30",
      amber: "border-amber-200 text-amber-600 bg-amber-50/30",
      rose: "border-rose-200 text-rose-600 bg-rose-50/30",
    };

    return (
      <div className={`bg-white border ${colorMap[color]} rounded-2xl p-6 shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5`}>
        <div className="flex items-start justify-between mb-4">
          <div className="text-3xl opacity-80">{icon}</div>
          <div className={`text-xs font-medium px-2 py-1 rounded-full ${colorMap[color]}`}>
            {title === "High Priority" ? "URGENT" : "Active"}
          </div>
        </div>
        <p className="text-zinc-500 text-sm tracking-wide mb-1">{title}</p>
        <h3 className="text-4xl font-bold tracking-tighter text-zinc-900">
          {value}
        </h3>
      </div>
    );
  };

  return (
    <div className="flex h-screen bg-zinc-50 text-zinc-900 overflow-hidden">
      <ResponderSidebar activeTab="dashboard" setActiveTab={() => {}} user={user} />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Notification Toast */}
        {notification.show && (
          <div className={`fixed top-20 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg animate-slide-in ${
            notification.type === "success" ? "bg-emerald-500 text-white" : "bg-red-500 text-white"
          }`}>
            {notification.type === "success" ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
            <span className="text-sm font-medium">{notification.message}</span>
          </div>
        )}

        {/* Top Navbar */}
        <header className="h-16 bg-white border-b border-zinc-200 px-6 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-4">
            <div className="p-2 bg-blue-100 rounded-xl">
              <Shield className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Responder Dashboard</h1>
              <p className="text-sm text-zinc-500">Field Operations • Real-time Monitoring</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden md:block text-xs text-zinc-400">
              Last updated: {lastUpdated.toLocaleTimeString()}
            </div>
            <button 
              onClick={handleRefresh}
              className="p-2.5 hover:bg-zinc-100 rounded-xl transition-colors"
            >
              <RefreshCw size={18} className="text-zinc-600" />
            </button>
            <div className="flex items-center gap-3 pl-4 border-l border-zinc-200">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-medium text-zinc-900">{user?.fullName || user?.full_name}</p>
                <p className="text-xs text-blue-600">● Online</p>
              </div>
              <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center font-semibold text-white">
                {user?.fullName?.charAt(0) || "R"}
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 p-6 md:p-8 overflow-auto bg-zinc-50">
          {/* Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <StatCard title="Total Assigned" value={stats.total} icon={<MapPin size={28} />} color="blue" />
            <StatCard title="In Progress" value={stats.inProgress} icon={<Clock size={28} />} color="amber" />
            <StatCard title="Resolved" value={stats.resolved} icon={<CheckCircle size={28} />} color="emerald" />
            <StatCard title="High Priority" value={stats.highPriority} icon={<AlertTriangle size={28} />} color="rose" />
          </div>

          {/* Quick Status Update */}
          <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 p-6 mb-8">
            <div className="flex items-center gap-3 mb-4">
              <Activity size={20} className="text-blue-600" />
              <h2 className="text-lg font-semibold text-zinc-900">Quick Actions</h2>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <button 
                onClick={() => window.location.href = "/responder/incidents"}
                className="flex items-center justify-center gap-2 px-4 py-3 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl transition-colors font-medium"
              >
                <Eye size={18} />
                View All Incidents
              </button>
              <button 
                onClick={() => window.open("https://maps.google.com", "_blank")}
                className="flex items-center justify-center gap-2 px-4 py-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl transition-colors font-medium"
              >
                <Navigation size={18} />
                Open Navigation
              </button>
              <button 
                onClick={() => alert("Emergency contacts will be displayed here")}
                className="flex items-center justify-center gap-2 px-4 py-3 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-xl transition-colors font-medium"
              >
                <Phone size={18} />
                Emergency Contacts
              </button>
            </div>
          </div>

          {/* Live Map Section */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold flex items-center gap-2 text-zinc-900">
                <MapPin size={20} className="text-blue-600" />
                My Assigned Incidents Map
                <span className="text-xs px-3 py-1 bg-blue-100 text-blue-700 rounded-full font-medium">LIVE</span>
              </h2>
              <p className="text-sm text-zinc-500">{incidents.length} incident{incidents.length !== 1 ? 's' : ''} on map</p>
            </div>
            <div className="bg-white border border-zinc-200 rounded-2xl shadow-sm overflow-hidden h-[400px]">
              <MapView incidents={incidents} />
            </div>
          </div>

          {/* Recent Incidents Table */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-zinc-900">My Assigned Incidents</h2>
              {incidents.length > 0 && (
                <p className="text-sm text-zinc-500">
                  {incidents.length} assigned incident{incidents.length > 1 ? 's' : ''}
                </p>
              )}
            </div>
            
            <div className="bg-white border border-zinc-200 rounded-2xl shadow-sm overflow-hidden">
              {loading ? (
                <div className="py-20 text-center">
                  <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
                  <p className="text-zinc-500">Loading your incidents...</p>
                </div>
              ) : incidents.length === 0 ? (
                <div className="py-20 text-center">
                  <Shield className="w-12 h-12 text-zinc-300 mx-auto mb-3" />
                  <p className="text-zinc-500 font-medium">No assigned incidents</p>
                  <p className="text-sm text-zinc-400 mt-1">You have no incidents assigned at the moment</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-zinc-50 border-b border-zinc-200">
                        <th className="px-6 py-4 text-left font-medium text-zinc-500 text-xs uppercase tracking-wider">ID</th>
                        <th className="px-6 py-4 text-left font-medium text-zinc-500 text-xs uppercase tracking-wider">Type</th>
                        <th className="px-6 py-4 text-left font-medium text-zinc-500 text-xs uppercase tracking-wider">Priority</th>
                        <th className="px-6 py-4 text-left font-medium text-zinc-500 text-xs uppercase tracking-wider">Status</th>
                        <th className="px-6 py-4 text-left font-medium text-zinc-500 text-xs uppercase tracking-wider">Location</th>
                        <th className="px-6 py-4 text-left font-medium text-zinc-500 text-xs uppercase tracking-wider">Reported</th>
                        <th className="px-6 py-4 text-center font-medium text-zinc-500 text-xs uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {incidents.slice(0, 10).map((incident) => (
                        <tr key={incident.id} className="hover:bg-zinc-50/50 transition-colors group">
                          <td className="px-6 py-4 font-mono text-xs text-zinc-500">#{incident.id}</td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <AlertTriangle size={14} className="text-zinc-400" />
                              <span className="font-medium text-zinc-900">{incident.type || "Unknown"}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex px-3 py-1 text-xs font-semibold rounded-full ${getPriorityColor(incident.priority)}`}>
                              {incident.priority || "Normal"}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex px-3 py-1 text-xs font-semibold rounded-full ${getStatusColor(incident.status)}`}>
                              {incident.status || "Pending"}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-zinc-600 text-xs">
                            {incident.latitude && incident.longitude 
                              ? `${parseFloat(incident.latitude).toFixed(4)}, ${parseFloat(incident.longitude).toFixed(4)}`
                              : "Unknown"}
                          </td>
                          <td className="px-6 py-4 text-zinc-500 text-xs">
                            {formatDate(incident.created_at)}
                          </td>
                          <td className="px-6 py-4 text-center">
                            <button
                              onClick={() => handleViewDetails(incident)}
                              className="p-2 hover:bg-blue-50 text-blue-600 rounded-lg transition-colors"
                              title="View Details"
                            >
                              <Eye size={16} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>

      {/* Incident Detail Modal */}
      {showModal && selectedIncident && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-zinc-200 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-zinc-900">Incident #{selectedIncident.id}</h2>
                <p className="text-sm text-zinc-500 mt-1">{selectedIncident.type || "Unknown Type"}</p>
              </div>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-zinc-100 rounded-lg transition-colors">
                <X size={20} className="text-zinc-500" />
              </button>
            </div>

            <div className="overflow-y-auto p-6 space-y-6">
              {/* Details Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-zinc-50 p-3 rounded-xl">
                  <p className="text-zinc-500 text-xs mb-1">Priority</p>
                  <p className={`inline-flex px-3 py-1 text-xs font-semibold rounded-full ${getPriorityColor(selectedIncident.priority)}`}>
                    {selectedIncident.priority || "Normal"}
                  </p>
                </div>
                <div className="bg-zinc-50 p-3 rounded-xl">
                  <p className="text-zinc-500 text-xs mb-1">Current Status</p>
                  <select
                    value={selectedIncident.status || "Pending"}
                    onChange={(e) => updateIncidentStatus(selectedIncident.id, e.target.value)}
                    disabled={updatingStatus}
                    className={`px-3 py-1 text-xs font-semibold rounded-full border-none focus:ring-1 focus:ring-blue-400 ${getStatusColor(selectedIncident.status)}`}
                  >
                    <option value="Pending">Pending</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Resolved">Resolved</option>
                  </select>
                </div>
                <div className="bg-zinc-50 p-3 rounded-xl">
                  <p className="text-zinc-500 text-xs mb-1">Reported By</p>
                  <p className="font-medium text-zinc-900">{selectedIncident.reporter_name || "Anonymous"}</p>
                </div>
                <div className="bg-zinc-50 p-3 rounded-xl">
                  <p className="text-zinc-500 text-xs mb-1">Reported At</p>
                  <p className="font-medium text-zinc-900 text-sm">{formatDate(selectedIncident.created_at)}</p>
                </div>
                <div className="bg-zinc-50 p-3 rounded-xl col-span-2">
                  <p className="text-zinc-500 text-xs mb-1">Location</p>
                  <p className="font-medium text-zinc-900 text-sm flex items-center gap-2">
                    <MapPin size={14} className="text-blue-500" />
                    {selectedIncident.latitude && selectedIncident.longitude 
                      ? `${parseFloat(selectedIncident.latitude).toFixed(6)}, ${parseFloat(selectedIncident.longitude).toFixed(6)}`
                      : "Unknown"}
                  </p>
                </div>
              </div>

              {/* Description */}
              {selectedIncident.description && (
                <div className="bg-zinc-50 p-4 rounded-xl">
                  <h3 className="font-medium text-zinc-900 mb-2">Description</h3>
                  <p className="text-zinc-600 text-sm">{selectedIncident.description}</p>
                </div>
              )}

              {/* Quick Actions */}
              <div className="bg-blue-50 p-4 rounded-xl">
                <h3 className="font-medium text-blue-900 mb-3">Quick Actions</h3>
                <div className="flex gap-3">
                  <button 
                    onClick={() => window.open(`https://maps.google.com?q=${selectedIncident.latitude},${selectedIncident.longitude}`, "_blank")}
                    className="flex-1 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                  >
                    <Navigation size={16} />
                    Navigate
                  </button>
                  <button 
                    onClick={() => updateIncidentStatus(selectedIncident.id, "In Progress")}
                    className="flex-1 py-2 bg-amber-500 text-white rounded-lg font-medium hover:bg-amber-600 transition-colors"
                  >
                    Start Response
                  </button>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-zinc-200 flex gap-3">
              <button
                onClick={() => updateIncidentStatus(selectedIncident.id, "Resolved")}
                disabled={updatingStatus}
                className="flex-1 py-3 bg-emerald-500 text-white rounded-xl font-medium hover:bg-emerald-600 transition-colors disabled:opacity-50"
              >
                Mark as Resolved
              </button>
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 py-3 bg-zinc-500 text-white rounded-xl font-medium hover:bg-zinc-600 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ResponderDashboard;