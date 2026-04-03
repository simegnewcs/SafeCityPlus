// src/pages/AdminIncidentLogs.js
import React, { useState, useMemo, useEffect, useRef } from "react";
import AdminSidebar from "../layout/AdminSidebar";
import { 
  Search, RefreshCw, Eye, Download, X, AlertTriangle, 
  ChevronLeft, ChevronRight, Play, Pause, Volume2, 
  Maximize2, Scan, Camera, Video as VideoIcon
} from "lucide-react";
import axios from "axios";

const API_URL = "http://localhost:5000/api";

const AdminIncidentLogs = () => {
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState("All");
  const [priorityFilter, setPriorityFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedIncident, setSelectedIncident] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [selectedDetection, setSelectedDetection] = useState(null);
  const [showDetectionModal, setShowDetectionModal] = useState(false);
  
  const videoRef = useRef(null);

  // Fetch incidents from API
  const fetchIncidents = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/incidents`);
      setIncidents(response.data);
    } catch (error) {
      console.error("Error fetching incidents:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIncidents();
    const interval = setInterval(fetchIncidents, 30000);
    return () => clearInterval(interval);
  }, []);

  // Compute unique types from actual data
  const types = useMemo(() => {
    const typeSet = new Set(incidents.map((i) => i.type || "Unknown"));
    const allTypes = ["All", ...Array.from(typeSet).filter(t => t !== "Unknown").sort()];
    if (typeSet.has("Unknown")) allTypes.push("Unknown");
    return allTypes;
  }, [incidents]);

  const priorities = useMemo(() => {
    const prioritySet = new Set(incidents.map((i) => i.priority || "Normal"));
    return ["All", ...Array.from(prioritySet).sort()];
  }, [incidents]);

  const statuses = useMemo(() => {
    const statusSet = new Set(incidents.map((i) => i.status || "Pending"));
    return ["All", ...Array.from(statusSet).sort()];
  }, [incidents]);

  const filteredIncidents = useMemo(() => {
    return incidents.filter((inc) => {
      const typeMatch = typeFilter === "All" || (inc.type || "Unknown") === typeFilter;
      const priorityMatch = priorityFilter === "All" || (inc.priority || "Normal") === priorityFilter;
      const statusMatch = statusFilter === "All" || (inc.status || "Pending") === statusFilter;
      const searchMatch = searchTerm === "" || 
        `${inc.type || ""} ${inc.description || ""}`.toLowerCase().includes(searchTerm.toLowerCase());
      return typeMatch && priorityMatch && statusMatch && searchMatch;
    });
  }, [incidents, typeFilter, priorityFilter, statusFilter, searchTerm]);

  const totalPages = Math.ceil(filteredIncidents.length / itemsPerPage);
  const paginatedIncidents = filteredIncidents.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const getPriorityColor = (priority) => {
    switch (priority?.toLowerCase()) {
      case 'critical': return 'bg-red-100 text-red-700';
      case 'high': return 'bg-orange-100 text-orange-700';
      case 'medium': return 'bg-yellow-100 text-yellow-700';
      default: return 'bg-green-100 text-green-700';
    }
  };

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'resolved': return 'bg-green-100 text-green-700';
      case 'in progress': return 'bg-blue-100 text-blue-700';
      case 'pending': return 'bg-yellow-100 text-yellow-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  const formatLocation = (lat, lng) => {
    if (!lat || !lng) return "Unknown";
    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);
    if (isNaN(latitude) || isNaN(longitude)) return "Unknown";
    return `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
  };

  const getMediaUrl = (incident) => {
    if (incident.media_name) {
      return `${API_URL.replace('/api', '')}/uploads/${incident.media_name}`;
    }
    return null;
  };

  const isVideo = (incident) => {
    return incident.media_type === 'video';
  };

  const handleViewDetails = (incident) => {
    setSelectedIncident(incident);
    setShowModal(true);
  };

  const handleDetectionClick = (detection) => {
    setSelectedDetection(detection);
    setShowDetectionModal(true);
  };

  const updateIncidentStatus = async (id, status) => {
    try {
      await axios.put(`${API_URL}/incidents/${id}`, { status });
      fetchIncidents();
    } catch (error) {
      console.error("Error updating status:", error);
    }
  };

  return (
    <div className="flex h-screen bg-zinc-50 text-zinc-900 overflow-hidden">
      <AdminSidebar user={user} />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Navbar */}
        <header className="h-16 bg-white border-b border-zinc-200 px-8 flex items-center justify-between shadow-sm">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Incident Logs</h1>
            <p className="text-sm text-zinc-500">Real-time records • {filteredIncidents.length} incidents</p>
          </div>

          <button 
            onClick={fetchIncidents}
            className="flex items-center gap-2 px-5 py-2 bg-white border border-zinc-300 hover:border-emerald-300 rounded-2xl text-sm font-medium transition-all"
          >
            <RefreshCw size={18} className="text-emerald-600" />
            Refresh
          </button>
        </header>

        {/* Main Content */}
        <main className="flex-1 p-6 md:p-8 overflow-auto">
          {/* Filters Section */}
          <div className="bg-white rounded-3xl shadow-sm border border-zinc-100 p-6 mb-8">
            <div className="flex flex-col lg:flex-row gap-6">
              <div className="flex-1">
                <label className="block text-sm font-medium text-zinc-600 mb-2">Search Incidents</label>
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={20} />
                  <input
                    type="text"
                    placeholder="Search by type, description..."
                    className="w-full pl-12 pr-4 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl focus:outline-none focus:border-emerald-400 transition-colors"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>

              <div className="w-full lg:w-56">
                <label className="block text-sm font-medium text-zinc-600 mb-2">Incident Type</label>
                <select
                  className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl focus:outline-none focus:border-emerald-400 transition-colors"
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                >
                  {types.map((type) => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>

              <div className="w-full lg:w-48">
                <label className="block text-sm font-medium text-zinc-600 mb-2">Priority</label>
                <select
                  className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl focus:outline-none focus:border-emerald-400 transition-colors"
                  value={priorityFilter}
                  onChange={(e) => setPriorityFilter(e.target.value)}
                >
                  {priorities.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>

              <div className="w-full lg:w-48">
                <label className="block text-sm font-medium text-zinc-600 mb-2">Status</label>
                <select
                  className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl focus:outline-none focus:border-emerald-400 transition-colors"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  {statuses.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Results Info */}
          <div className="flex items-center justify-between mb-4 px-1">
            <p className="text-sm text-zinc-500">
              Showing {paginatedIncidents.length} of {filteredIncidents.length} incidents
            </p>
            {(typeFilter !== "All" || priorityFilter !== "All" || statusFilter !== "All" || searchTerm) && (
              <button
                onClick={() => {
                  setTypeFilter("All");
                  setPriorityFilter("All");
                  setStatusFilter("All");
                  setSearchTerm("");
                }}
                className="text-sm text-emerald-600 hover:text-emerald-700 font-medium"
              >
                Clear all filters
              </button>
            )}
          </div>

          {/* Table Container */}
          <div className="bg-white rounded-3xl shadow-sm border border-zinc-100 overflow-hidden">
            {loading ? (
              <div className="py-20 text-center">
                <div className="animate-spin w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full mx-auto mb-4"></div>
                <p className="text-zinc-500">Loading incidents...</p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-zinc-50 border-b border-zinc-200">
                        <th className="px-6 py-4 text-left font-medium text-zinc-500 text-xs uppercase tracking-wider">ID</th>
                        <th className="px-6 py-4 text-left font-medium text-zinc-500 text-xs uppercase tracking-wider">Type</th>
                        <th className="px-6 py-4 text-left font-medium text-zinc-500 text-xs uppercase tracking-wider">Media</th>
                        <th className="px-6 py-4 text-left font-medium text-zinc-500 text-xs uppercase tracking-wider">Priority</th>
                        <th className="px-6 py-4 text-left font-medium text-zinc-500 text-xs uppercase tracking-wider">Status</th>
                        <th className="px-6 py-4 text-left font-medium text-zinc-500 text-xs uppercase tracking-wider">Location</th>
                        <th className="px-6 py-4 text-left font-medium text-zinc-500 text-xs uppercase tracking-wider">Reported</th>
                        <th className="px-6 py-4 text-center font-medium text-zinc-500 text-xs uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {paginatedIncidents.map((incident) => (
                        <tr key={incident.id} className="hover:bg-zinc-50/50 transition-colors">
                          <td className="px-6 py-4 font-mono text-xs text-zinc-500">#{incident.id}</td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <AlertTriangle size={14} className="text-zinc-400" />
                              <span className="font-medium text-zinc-900">{incident.type || "Unknown"}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            {incident.media_name ? (
                              <button
                                onClick={() => handleViewDetails(incident)}
                                className="flex items-center gap-1 text-emerald-600 hover:text-emerald-700"
                              >
                                {isVideo(incident) ? <VideoIcon size={14} /> : <Camera size={14} />}
                                <span className="text-xs">{isVideo(incident) ? "Video" : "Photo"}</span>
                              </button>
                            ) : (
                              <span className="text-zinc-400 text-xs">No media</span>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex px-3 py-1 text-xs font-semibold rounded-full ${getPriorityColor(incident.priority)}`}>
                              {incident.priority || "Normal"}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <select
                              value={incident.status || "Pending"}
                              onChange={(e) => updateIncidentStatus(incident.id, e.target.value)}
                              className={`px-3 py-1 text-xs font-semibold rounded-full border-none focus:ring-1 focus:ring-emerald-400 ${getStatusColor(incident.status)}`}
                            >
                              <option value="Pending">Pending</option>
                              <option value="In Progress">In Progress</option>
                              <option value="Resolved">Resolved</option>
                            </select>
                          </td>
                          <td className="px-6 py-4 text-zinc-600 text-xs">
                            {formatLocation(incident.latitude, incident.longitude)}
                          </td>
                          <td className="px-6 py-4 text-zinc-500 text-xs">
                            {formatDate(incident.created_at)}
                          </td>
                          <td className="px-6 py-4 text-center">
                            <button
                              onClick={() => handleViewDetails(incident)}
                              className="p-2 hover:bg-emerald-50 text-emerald-600 rounded-lg transition-colors"
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

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="px-6 py-4 border-t border-zinc-100 flex items-center justify-between">
                    <p className="text-sm text-zinc-500">Page {currentPage} of {totalPages}</p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                        disabled={currentPage === 1}
                        className="p-2 border border-zinc-200 rounded-lg hover:bg-zinc-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        <ChevronLeft size={18} />
                      </button>
                      <button
                        onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                        disabled={currentPage === totalPages}
                        className="p-2 border border-zinc-200 rounded-lg hover:bg-zinc-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        <ChevronRight size={18} />
                      </button>
                    </div>
                  </div>
                )}

                {filteredIncidents.length === 0 && (
                  <div className="py-20 text-center">
                    <AlertTriangle className="w-12 h-12 text-zinc-300 mx-auto mb-3" />
                    <p className="text-zinc-500 font-medium">No incidents found</p>
                    <p className="text-sm text-zinc-400 mt-1">Try adjusting your filters</p>
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
          <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[90vh] overflow-hidden shadow-xl" onClick={(e) => e.stopPropagation()}>
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
              {/* Media Section */}
              {getMediaUrl(selectedIncident) && (
                <div className="bg-zinc-50 rounded-2xl p-4">
                  <h3 className="font-medium text-zinc-900 mb-3">Evidence Media</h3>
                  {isVideo(selectedIncident) ? (
                    <video
                      ref={videoRef}
                      src={getMediaUrl(selectedIncident)}
                      controls
                      className="w-full rounded-xl max-h-96 object-contain"
                      controlsList="nodownload"
                    />
                  ) : (
                    <img
                      src={getMediaUrl(selectedIncident)}
                      alt="Incident evidence"
                      className="w-full rounded-xl max-h-96 object-contain"
                    />
                  )}
                  <button
                    onClick={() => window.open(getMediaUrl(selectedIncident), '_blank')}
                    className="mt-3 flex items-center gap-2 text-sm text-emerald-600 hover:text-emerald-700"
                  >
                    <Download size={14} />
                    Download
                  </button>
                </div>
              )}

              {/* Details Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-zinc-50 p-3 rounded-xl">
                  <p className="text-zinc-500 text-xs mb-1">Priority</p>
                  <p className={`inline-flex px-3 py-1 text-xs font-semibold rounded-full ${getPriorityColor(selectedIncident.priority)}`}>
                    {selectedIncident.priority || "Normal"}
                  </p>
                </div>
                <div className="bg-zinc-50 p-3 rounded-xl">
                  <p className="text-zinc-500 text-xs mb-1">Status</p>
                  <p className={`inline-flex px-3 py-1 text-xs font-semibold rounded-full ${getStatusColor(selectedIncident.status)}`}>
                    {selectedIncident.status || "Pending"}
                  </p>
                </div>
                <div className="bg-zinc-50 p-3 rounded-xl">
                  <p className="text-zinc-500 text-xs mb-1">Confidence</p>
                  <p className="font-medium text-zinc-900">{selectedIncident.confidence ? `${Math.round(selectedIncident.confidence * 100)}%` : "N/A"}</p>
                </div>
                <div className="bg-zinc-50 p-3 rounded-xl">
                  <p className="text-zinc-500 text-xs mb-1">Reported By</p>
                  <p className="font-medium text-zinc-900">{selectedIncident.reporter_name || "Anonymous"}</p>
                </div>
                <div className="bg-zinc-50 p-3 rounded-xl">
                  <p className="text-zinc-500 text-xs mb-1">Location</p>
                  <p className="font-medium text-zinc-900 text-sm">
                    {formatLocation(selectedIncident.latitude, selectedIncident.longitude)}
                  </p>
                </div>
                <div className="bg-zinc-50 p-3 rounded-xl">
                  <p className="text-zinc-500 text-xs mb-1">Reported At</p>
                  <p className="font-medium text-zinc-900 text-sm">{formatDate(selectedIncident.created_at)}</p>
                </div>
              </div>

              {/* Description */}
              {selectedIncident.description && (
                <div className="bg-zinc-50 p-4 rounded-xl">
                  <h3 className="font-medium text-zinc-900 mb-2">Description</h3>
                  <p className="text-zinc-600 text-sm">{selectedIncident.description}</p>
                </div>
              )}

              {/* AI Detection Results - Clickable */}
              {selectedIncident.all_detections && selectedIncident.all_detections.length > 0 && (
                <div className="bg-zinc-50 p-4 rounded-xl">
                  <div className="flex items-center gap-2 mb-3">
                    <Scan size={18} className="text-emerald-600" />
                    <h3 className="font-medium text-zinc-900">AI Detection Results</h3>
                    <span className="text-xs text-zinc-400">(Click on any detection for details)</span>
                  </div>
                  <div className="space-y-2">
                    {selectedIncident.all_detections.map((detection, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleDetectionClick(detection)}
                        className="w-full flex items-center justify-between text-sm p-3 bg-white rounded-xl border border-zinc-200 hover:border-emerald-300 hover:shadow-md transition-all cursor-pointer group"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center group-hover:bg-emerald-200 transition-colors">
                            <Scan size={14} className="text-emerald-600" />
                          </div>
                          <span className="text-zinc-700 font-medium">{detection.ai_type}</span>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="text-emerald-600 font-semibold">
                            {detection.confidence ? `${Math.round(detection.confidence * 100)}%` : "N/A"}
                          </span>
                          <span className={`text-xs px-2 py-1 rounded-full ${getPriorityColor(detection.priority)}`}>
                            {detection.priority || "Normal"}
                          </span>
                          <ChevronRight size={16} className="text-zinc-400 group-hover:text-emerald-600 transition-colors" />
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-zinc-200 flex gap-3">
              <button
                onClick={() => {
                  updateIncidentStatus(selectedIncident.id, "Resolved");
                  setShowModal(false);
                }}
                className="flex-1 py-3 bg-green-500 text-white rounded-xl font-medium hover:bg-green-600 transition-colors"
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

      {/* Detection Detail Modal */}
      {showDetectionModal && selectedDetection && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={() => setShowDetectionModal(false)}>
          <div className="bg-white rounded-3xl max-w-md w-full shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-zinc-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
                  <Scan size={20} className="text-emerald-600" />
                </div>
                <h2 className="text-xl font-semibold text-zinc-900">Detection Details</h2>
              </div>
              <button onClick={() => setShowDetectionModal(false)} className="p-2 hover:bg-zinc-100 rounded-lg transition-colors">
                <X size={20} className="text-zinc-500" />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="bg-zinc-50 p-4 rounded-xl">
                <p className="text-zinc-500 text-xs mb-1">Detected Object</p>
                <p className="text-lg font-bold text-zinc-900">{selectedDetection.ai_type}</p>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-zinc-50 p-3 rounded-xl">
                  <p className="text-zinc-500 text-xs mb-1">Confidence</p>
                  <p className="text-xl font-bold text-emerald-600">
                    {selectedDetection.confidence ? `${Math.round(selectedDetection.confidence * 100)}%` : "N/A"}
                  </p>
                </div>
                <div className="bg-zinc-50 p-3 rounded-xl">
                  <p className="text-zinc-500 text-xs mb-1">Priority</p>
                  <p className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full ${getPriorityColor(selectedDetection.priority)}`}>
                    {selectedDetection.priority || "Normal"}
                  </p>
                </div>
              </div>
              
              <div className="bg-zinc-50 p-3 rounded-xl">
                <p className="text-zinc-500 text-xs mb-1">Severity</p>
                <p className="text-lg font-bold text-zinc-900">{selectedDetection.severity || "Unknown"}</p>
              </div>
              
              {selectedDetection.raw_response && (
                <div className="bg-zinc-50 p-3 rounded-xl">
                  <p className="text-zinc-500 text-xs mb-1">Additional Data</p>
                  <p className="text-xs text-zinc-600 break-words">
                    {JSON.stringify(JSON.parse(selectedDetection.raw_response), null, 2)}
                  </p>
                </div>
              )}
            </div>
            
            <div className="p-6 border-t border-zinc-200">
              <button
                onClick={() => setShowDetectionModal(false)}
                className="w-full py-3 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 transition-colors"
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

export default AdminIncidentLogs;