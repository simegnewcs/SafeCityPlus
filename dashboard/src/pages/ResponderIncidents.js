// src/pages/ResponderIncidents.js
import React, { useEffect, useState, useMemo } from "react";
import ResponderSidebar from "../layout/ResponderSidebar";
import axios from "axios";
import { 
  AlertTriangle, Clock, CheckCircle, MapPin, 
  RefreshCw, Eye, Navigation, Calendar,
  Filter, X, ChevronLeft, ChevronRight, TrendingUp,
  Download, Search
} from "lucide-react";

const API_URL = "http://localhost:5000/api";

const ResponderIncidents = () => {
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const [allIncidents, setAllIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [selectedIncident, setSelectedIncident] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [notification, setNotification] = useState({ show: false, message: "", type: "" });
  const [searchTerm, setSearchTerm] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [stats, setStats] = useState({ total: 0, pending: 0, inProgress: 0, resolved: 0, high: 0, medium: 0, low: 0 });

  // Fetch ALL incidents from database
  const fetchIncidents = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/incidents`);
      const allIncidentsData = response.data;
      
      const incidentsWithAssignment = allIncidentsData.map(inc => ({
        ...inc,
        isAssignedToMe: inc.assigned_responder_id === user.id || inc.user_id === user.id
      }));
      
      setAllIncidents(incidentsWithAssignment);
      
      const pending = incidentsWithAssignment.filter(i => i.status === "Pending" || !i.status).length;
      const inProgress = incidentsWithAssignment.filter(i => i.status === "In Progress").length;
      const resolved = incidentsWithAssignment.filter(i => i.status === "Resolved").length;
      const high = incidentsWithAssignment.filter(i => i.priority === "High" || i.priority === "Critical").length;
      const medium = incidentsWithAssignment.filter(i => i.priority === "Medium").length;
      const low = incidentsWithAssignment.filter(i => i.priority === "Low" || i.priority === "Normal").length;
      
      setStats({
        total: incidentsWithAssignment.length,
        pending,
        inProgress,
        resolved,
        high,
        medium,
        low
      });
    } catch (error) {
      console.error("Error fetching incidents:", error);
      showNotification("Failed to load incidents", "error");
    } finally {
      setLoading(false);
    }
  };

  const updateIncidentStatus = async (id, newStatus) => {
    setUpdatingStatus(true);
    try {
      await axios.put(`${API_URL}/incidents/${id}`, { status: newStatus });
      showNotification(`Incident status updated to ${newStatus}`, "success");
      fetchIncidents();
      if (showModal) setShowModal(false);
    } catch (error) {
      console.error("Error updating status:", error);
      showNotification("Failed to update status", "error");
    } finally {
      setUpdatingStatus(false);
    }
  };

  useEffect(() => {
    fetchIncidents();
    const interval = setInterval(fetchIncidents, 30000);
    return () => clearInterval(interval);
  }, [user.id]);

  const showNotification = (message, type) => {
    setNotification({ show: true, message, type });
    setTimeout(() => setNotification({ show: false, message: "", type: "" }), 3000);
  };

  const filteredIncidents = useMemo(() => {
    let filtered = allIncidents;
    
    if (filter !== "all") {
      filtered = filtered.filter(inc => inc.status === filter);
    }
    
    if (priorityFilter !== "all") {
      filtered = filtered.filter(inc => {
        if (priorityFilter === "high") return inc.priority === "High" || inc.priority === "Critical";
        if (priorityFilter === "medium") return inc.priority === "Medium";
        if (priorityFilter === "low") return inc.priority === "Low" || inc.priority === "Normal";
        return true;
      });
    }
    
    if (searchTerm) {
      filtered = filtered.filter(inc => 
        inc.type?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        inc.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        inc.id?.toString().includes(searchTerm)
      );
    }
    
    return filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }, [allIncidents, filter, priorityFilter, searchTerm]);

  const totalPages = Math.ceil(filteredIncidents.length / itemsPerPage);
  const paginatedIncidents = filteredIncidents.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const getPriorityColor = (priority) => {
    if (!priority) return "bg-zinc-100 text-zinc-600";
    if (priority === "High" || priority === "Critical") return "bg-rose-100 text-rose-700";
    if (priority === "Medium") return "bg-amber-100 text-amber-700";
    return "bg-emerald-100 text-emerald-700";
  };

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'resolved': return 'bg-emerald-100 text-emerald-700';
      case 'in progress': return 'bg-blue-100 text-blue-700';
      default: return 'bg-yellow-100 text-yellow-700';
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  const handleViewDetails = (incident) => {
    setSelectedIncident(incident);
    setShowModal(true);
  };

  const handleRefresh = () => {
    fetchIncidents();
  };

  const handleExport = () => {
    const exportData = filteredIncidents.map(inc => ({
      id: inc.id,
      type: inc.type,
      priority: inc.priority,
      status: inc.status,
      location: `${inc.latitude}, ${inc.longitude}`,
      description: inc.description,
      reported_at: inc.created_at,
      reported_by: inc.reporter_name
    }));
    
    const dataStr = JSON.stringify(exportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `incidents_export_${new Date().toISOString()}.json`;
    link.click();
    URL.revokeObjectURL(url);
    showNotification("Export completed!", "success");
  };

  const StatCard = ({ title, value, icon, color }) => (
    <div className={`bg-white border-l-4 ${color} rounded-xl p-4 shadow-sm`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-zinc-500 text-xs font-medium">{title}</p>
          <p className="text-2xl font-bold text-zinc-900 mt-1">{value}</p>
        </div>
        <div className="text-zinc-400">{icon}</div>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-zinc-50 overflow-hidden">
      <ResponderSidebar activeTab="assigned incidents" setActiveTab={() => {}} user={user} />

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
              <AlertTriangle className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Incidents</h1>
              <p className="text-sm text-zinc-500">View and manage all incidents</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <button onClick={handleExport} className="p-2.5 hover:bg-zinc-100 rounded-xl transition-colors" title="Export">
              <Download size={18} className="text-zinc-600" />
            </button>
            <button onClick={handleRefresh} className="p-2.5 hover:bg-zinc-100 rounded-xl transition-colors">
              <RefreshCw size={18} className="text-zinc-600" />
            </button>
            <div className="text-sm text-zinc-500">
              {filteredIncidents.length} incident{filteredIncidents.length !== 1 ? 's' : ''}
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 p-6 overflow-auto">
          {/* Stats Row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 mb-6">
            <StatCard title="Total" value={stats.total} icon={<AlertTriangle size={16} />} color="border-blue-500" />
            <StatCard title="Pending" value={stats.pending} icon={<Clock size={16} />} color="border-yellow-500" />
            <StatCard title="In Progress" value={stats.inProgress} icon={<TrendingUp size={16} />} color="border-blue-500" />
            <StatCard title="Resolved" value={stats.resolved} icon={<CheckCircle size={16} />} color="border-emerald-500" />
            <StatCard title="High" value={stats.high} icon={<AlertTriangle size={16} />} color="border-red-500" />
            <StatCard title="Medium" value={stats.medium} icon={<AlertTriangle size={16} />} color="border-amber-500" />
            <StatCard title="Low" value={stats.low} icon={<AlertTriangle size={16} />} color="border-green-500" />
          </div>

          {/* Search and Filters */}
          <div className="bg-white border border-zinc-200 rounded-2xl p-4 mb-6">
            <div className="flex flex-col lg:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                  <input
                    type="text"
                    placeholder="Search by ID, type, or description..."
                    className="w-full pl-10 pr-4 py-2 bg-zinc-50 border border-zinc-200 rounded-xl focus:border-blue-400 focus:ring-1 focus:ring-blue-400 outline-none transition-all"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>
              
              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                className="px-4 py-2 bg-zinc-50 border border-zinc-200 rounded-xl focus:border-blue-400 outline-none"
              >
                <option value="all">All Priorities</option>
                <option value="high">High Priority</option>
                <option value="medium">Medium Priority</option>
                <option value="low">Low Priority</option>
              </select>
            </div>
          </div>

          {/* Status Filters */}
          <div className="flex flex-wrap gap-2 mb-6">
            <button onClick={() => { setFilter("all"); setCurrentPage(1); }} className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${filter === 'all' ? 'bg-blue-600 text-white shadow-md' : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700'}`}>
              All ({stats.total})
            </button>
            <button onClick={() => { setFilter("Pending"); setCurrentPage(1); }} className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${filter === 'Pending' ? 'bg-yellow-500 text-white shadow-md' : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700'}`}>
              Pending ({stats.pending})
            </button>
            <button onClick={() => { setFilter("In Progress"); setCurrentPage(1); }} className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${filter === 'In Progress' ? 'bg-blue-600 text-white shadow-md' : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700'}`}>
              In Progress ({stats.inProgress})
            </button>
            <button onClick={() => { setFilter("Resolved"); setCurrentPage(1); }} className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${filter === 'Resolved' ? 'bg-emerald-600 text-white shadow-md' : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700'}`}>
              Resolved ({stats.resolved})
            </button>
            {filter !== "all" && (
              <button onClick={() => { setFilter("all"); setCurrentPage(1); setPriorityFilter("all"); setSearchTerm(""); }} className="px-4 py-1.5 rounded-full text-sm text-zinc-400 hover:text-zinc-600 flex items-center gap-1">
                <X size={14} /> Clear
              </button>
            )}
          </div>

          {/* Incidents List */}
          <div className="bg-white border border-zinc-200 rounded-2xl shadow-sm overflow-hidden">
            {loading ? (
              <div className="py-20 text-center">
                <div className="animate-spin w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
                <p className="text-zinc-500">Loading incidents...</p>
              </div>
            ) : filteredIncidents.length === 0 ? (
              <div className="py-20 text-center">
                <div className="w-16 h-16 bg-zinc-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <AlertTriangle className="w-8 h-8 text-zinc-400" />
                </div>
                <h3 className="text-lg font-medium text-zinc-700">No incidents found</h3>
                <p className="text-zinc-500 mt-1">Try adjusting your filters</p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-zinc-50 border-b border-zinc-200">
                      <tr>
                        <th className="px-6 py-4 text-left font-medium text-zinc-500 text-xs uppercase tracking-wider">ID</th>
                        <th className="px-6 py-4 text-left font-medium text-zinc-500 text-xs uppercase tracking-wider">Type</th>
                        <th className="px-6 py-4 text-left font-medium text-zinc-500 text-xs uppercase tracking-wider">Priority</th>
                        <th className="px-6 py-4 text-left font-medium text-zinc-500 text-xs uppercase tracking-wider">Location</th>
                        <th className="px-6 py-4 text-left font-medium text-zinc-500 text-xs uppercase tracking-wider">Status</th>
                        <th className="px-6 py-4 text-left font-medium text-zinc-500 text-xs uppercase tracking-wider">Reported</th>
                        <th className="px-6 py-4 text-center font-medium text-zinc-500 text-xs uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {paginatedIncidents.map((inc) => (
                        <tr key={inc.id} className="hover:bg-zinc-50/50 transition-colors group">
                          <td className="px-6 py-4 font-mono text-xs text-zinc-500">#{inc.id}</td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <AlertTriangle size={14} className="text-zinc-400" />
                              <span className="font-medium text-zinc-900">{inc.type || "Unknown Incident"}</span>
                              {inc.isAssignedToMe && (
                                <span className="px-2 py-0.5 text-[10px] font-medium bg-blue-100 text-blue-700 rounded-full">Assigned to me</span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex px-3 py-1 text-xs font-semibold rounded-full ${getPriorityColor(inc.priority)}`}>
                              {inc.priority || "Normal"}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-1 text-zinc-600 text-xs">
                              <MapPin size={12} className="text-blue-500" />
                              {inc.latitude && inc.longitude 
                                ? `${parseFloat(inc.latitude).toFixed(4)}, ${parseFloat(inc.longitude).toFixed(4)}`
                                : "Unknown"}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex px-3 py-1 text-xs font-semibold rounded-full ${getStatusColor(inc.status)}`}>
                              {inc.status || "Pending"}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-zinc-500 text-xs">
                            {formatDate(inc.created_at)}
                          </td>
                          <td className="px-6 py-4 text-center">
                            <div className="flex justify-center gap-2">
                              <button onClick={() => handleViewDetails(inc)} className="p-2 hover:bg-blue-50 text-blue-600 rounded-lg transition-colors" title="View Details">
                                <Eye size={16} />
                              </button>
                              {inc.status !== "In Progress" && inc.status !== "Resolved" && (
                                <button onClick={() => updateIncidentStatus(inc.id, "In Progress")} disabled={updatingStatus} className="p-2 hover:bg-amber-50 text-amber-600 rounded-lg transition-colors" title="Start Work">
                                  <Clock size={16} />
                                </button>
                              )}
                              {inc.status !== "Resolved" && (
                                <button onClick={() => updateIncidentStatus(inc.id, "Resolved")} disabled={updatingStatus} className="p-2 hover:bg-emerald-50 text-emerald-600 rounded-lg transition-colors" title="Mark Resolved">
                                  <CheckCircle size={16} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="px-6 py-4 border-t border-zinc-100 flex items-center justify-between">
                    <p className="text-sm text-zinc-500">Page {currentPage} of {totalPages}</p>
                    <div className="flex gap-2">
                      <button onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} disabled={currentPage === 1} className="p-2 border border-zinc-200 rounded-lg hover:bg-zinc-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                        <ChevronLeft size={18} />
                      </button>
                      <button onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))} disabled={currentPage === totalPages} className="p-2 border border-zinc-200 rounded-lg hover:bg-zinc-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                        <ChevronRight size={18} />
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
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
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-zinc-50 p-3 rounded-xl">
                  <p className="text-zinc-500 text-xs mb-1">Priority</p>
                  <span className={`inline-flex px-3 py-1 text-xs font-semibold rounded-full ${getPriorityColor(selectedIncident.priority)}`}>
                    {selectedIncident.priority || "Normal"}
                  </span>
                </div>
                <div className="bg-zinc-50 p-3 rounded-xl">
                  <p className="text-zinc-500 text-xs mb-1">Status</p>
                  <select value={selectedIncident.status || "Pending"} onChange={(e) => updateIncidentStatus(selectedIncident.id, e.target.value)} disabled={updatingStatus} className={`px-3 py-1 text-xs font-semibold rounded-full border-none focus:ring-1 focus:ring-blue-400 ${getStatusColor(selectedIncident.status)}`}>
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
                  <div className="flex items-center gap-2">
                    <MapPin size={14} className="text-blue-500" />
                    <p className="font-medium text-zinc-900 text-sm">
                      {selectedIncident.latitude && selectedIncident.longitude 
                        ? `${parseFloat(selectedIncident.latitude).toFixed(6)}, ${parseFloat(selectedIncident.longitude).toFixed(6)}`
                        : "Unknown"}
                    </p>
                    <button onClick={() => window.open(`https://maps.google.com?q=${selectedIncident.latitude},${selectedIncident.longitude}`, "_blank")} className="ml-auto text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1">
                      <Navigation size={14} /> Navigate
                    </button>
                  </div>
                </div>
              </div>

              {selectedIncident.description && (
                <div className="bg-zinc-50 p-4 rounded-xl">
                  <h3 className="font-medium text-zinc-900 mb-2">Description</h3>
                  <p className="text-zinc-600 text-sm">{selectedIncident.description}</p>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-zinc-200 flex gap-3">
              {selectedIncident.status !== "In Progress" && selectedIncident.status !== "Resolved" && (
                <button onClick={() => updateIncidentStatus(selectedIncident.id, "In Progress")} disabled={updatingStatus} className="flex-1 py-3 bg-amber-500 text-white rounded-xl font-medium hover:bg-amber-600 transition-colors disabled:opacity-50">
                  Start Response
                </button>
              )}
              {selectedIncident.status !== "Resolved" && (
                <button onClick={() => updateIncidentStatus(selectedIncident.id, "Resolved")} disabled={updatingStatus} className="flex-1 py-3 bg-emerald-500 text-white rounded-xl font-medium hover:bg-emerald-600 transition-colors disabled:opacity-50">
                  Mark as Resolved
                </button>
              )}
              <button onClick={() => setShowModal(false)} className="flex-1 py-3 bg-zinc-500 text-white rounded-xl font-medium hover:bg-zinc-600 transition-colors">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ResponderIncidents;