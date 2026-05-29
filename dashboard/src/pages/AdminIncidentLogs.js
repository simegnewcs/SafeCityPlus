// src/pages/AdminIncidentLogs.js
import React, { useState, useMemo, useEffect, useRef } from "react";
import AdminSidebar from "../layout/AdminSidebar";
import PageHeader from "../layout/PageHeader";
import { 
  Search, RefreshCw, Eye, Download, X, AlertTriangle, 
  ChevronLeft, ChevronRight, Play, Pause, Volume2, 
  Maximize2, Scan, Camera, Video as VideoIcon,
  Film, Radio
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
  const [placeNames, setPlaceNames] = useState({});
  const [sourceFilter, setSourceFilter] = useState("All"); // All, Reporter, CCTV
  
  // CCTV recording playback state
  const [recPlayback, setRecPlayback] = useState(null);
  const [recPlaybackLoading, setRecPlaybackLoading] = useState(false);
  const recPlayIntervalRef = useRef(null);
  
  const videoRef = useRef(null);

  // Fetch incidents from API (both regular and CCTV)
  const fetchIncidents = async () => {
    try {
      setLoading(true);
      
      // 1. Fetch regular reporter incidents
      const regularResponse = await axios.get(`${API_URL}/incidents`);
      const regularIncidents = regularResponse.data.map(inc => ({
        ...inc,
        incidentSource: 'reporter'
      }));
      
      // 2. Fetch CCTV/AI incidents
      let aiIncidents = [];
      try {
        const aiResponse = await axios.get(`${API_URL}/super-responder/incidents?limit=200`);
        const raw = aiResponse.data || [];
        aiIncidents = raw.map(aiInc => ({
          ...aiInc,
          _rawId: aiInc.id,
          id: `AI-${aiInc.id}`,
          type: aiInc.incident_category || aiInc.decision || 'AI Detected Incident',
          status: aiInc.status || 'pending',
          priority: aiInc.severity === 'Critical Emergency' ? 'Critical' : 
                   (aiInc.severity === 'Medium Risk' ? 'Medium' : 'Low'),
          description: aiInc.decision,
          incidentSource: 'cctv',
          reporter_name: 'AI Detection System',
          created_at: aiInc.created_at,
          assigned_at: aiInc.assigned_at,
          assigned_by: (aiInc.assigned_by === 'ai' || aiInc.assigned_by === 'auto')
            ? '🤖 AI System'
            : (aiInc.assigned_by_name || 'Super Responder'),
          latitude: aiInc.latitude,
          longitude: aiInc.longitude,
          location: aiInc.location,
          confidence: aiInc.ai_confidence ? aiInc.ai_confidence / 100 : 
                     (aiInc.accident_confidence ? aiInc.accident_confidence / 100 : 0),
          assigned_responder_type: aiInc.assigned_to_types,
          ai_metadata: aiInc.ai_metadata,
          priority_score: aiInc.priority_score,
          incident_category: aiInc.incident_category,
          stream_id: aiInc.stream_id,
          recording_id: aiInc.recording_id
        }));
      } catch (aiError) {
        console.warn('Failed to fetch CCTV incidents:', aiError.message);
      }
      
      // 3. Merge both lists
      const allIncidents = [...aiIncidents, ...regularIncidents];
      
      // Fetch place names for all incidents with coordinates
      const newPlaceNames = { ...placeNames };
      const geocodingPromises = allIncidents.map(async (incident) => {
        const key = `${incident.id}`;
        if (incident.latitude && incident.longitude && !newPlaceNames[key]) {
          const placeName = await getPlaceName(incident.latitude, incident.longitude);
          newPlaceNames[key] = placeName;
        }
        return key;
      });
      
      await Promise.all(geocodingPromises);
      setPlaceNames(newPlaceNames);
      setIncidents(allIncidents);
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
    const typeSet = new Set(incidents.map((i) => i.incident_category || i.type || "Unknown"));
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
      const typeMatch = typeFilter === "All" || (inc.incident_category || inc.type || "Unknown") === typeFilter;
      const priorityMatch = priorityFilter === "All" || (inc.priority || "Normal") === priorityFilter;
      const statusMatch = statusFilter === "All" || (inc.status || "Pending") === statusFilter;
      const sourceMatch = sourceFilter === "All" || (inc.incidentSource || "reporter") === sourceFilter.toLowerCase();
      const searchMatch = searchTerm === "" || 
        `${inc.type || ""} ${inc.description || ""} ${inc.incident_category || ""}`.toLowerCase().includes(searchTerm.toLowerCase());
      return typeMatch && priorityMatch && statusMatch && sourceMatch && searchMatch;
    });
  }, [incidents, typeFilter, priorityFilter, statusFilter, sourceFilter, searchTerm]);

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
    
    // For now, return a more readable format
    // TODO: Implement reverse geocoding to get actual place names
    return `Lat: ${latitude.toFixed(4)}, Lng: ${longitude.toFixed(4)}`;
  };

  // Function to get place name from coordinates (using OpenStreetMap Nominatim)
  const getPlaceName = async (lat, lng) => {
    if (!lat || !lng) return "Unknown";
    
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
        {
          headers: {
            'User-Agent': 'SafeCityPlus/1.0'
          }
        }
      );
      
      if (response.ok) {
        const data = await response.json();
        if (data.display_name) {
          // Return a shorter, more readable address
          const address = data.display_name.split(',');
          return address.slice(0, 3).join(','); // Show first 3 parts of address
        }
      }
    } catch (error) {
      console.error('Error fetching place name:', error);
    }
    
    // Fallback to coordinates if geocoding fails
    return formatLocation(lat, lng);
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

  // CCTV Recording playback functions
  const openRecordingForIncident = async (incident) => {
    setRecPlaybackLoading(true);
    try {
      let recId = incident.recording_id || null;

      if (!recId && incident.stream_id) {
        const listRes = await axios.get(`${API_URL}/super-responder/recordings`);
        const recs = listRes.data?.recordings || [];
        const match = recs.find(r => r.stream_id === incident.stream_id);
        if (match) recId = match.id;
      }

      if (!recId) {
        alert('⚠️ No recording found for this incident');
        return;
      }

      const framesRes = await axios.get(`${API_URL}/super-responder/recordings/${recId}/frames`);
      const { recording, frames } = framesRes.data;
      if (!frames || frames.length === 0) {
        alert('⚠️ Recording has no frames');
        return;
      }
      setRecPlayback({ recording, frames, frame: 0, playing: false });
    } catch (e) {
      alert('Failed to load recording: ' + e.message);
    } finally {
      setRecPlaybackLoading(false);
    }
  };

  const closeRecPlayback = () => {
    clearInterval(recPlayIntervalRef.current);
    setRecPlayback(null);
  };

  const toggleRecPlay = () => {
    if (!recPlayback) return;
    if (recPlayback.playing) {
      clearInterval(recPlayIntervalRef.current);
      setRecPlayback(p => ({ ...p, playing: false }));
    } else {
      recPlayIntervalRef.current = setInterval(() => {
        setRecPlayback(p => {
          if (!p) return p;
          const next = p.frame + 1;
          if (next >= p.frames.length) {
            clearInterval(recPlayIntervalRef.current);
            return { ...p, playing: false, frame: p.frames.length - 1 };
          }
          return { ...p, frame: next };
        });
      }, 120);
      setRecPlayback(p => ({ ...p, playing: true }));
    }
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
    <div className="flex h-screen bg-slate-50 text-slate-900 overflow-hidden">
      <AdminSidebar user={user} />

      <div className="flex-1 flex flex-col overflow-hidden">
        <PageHeader
          title="Incident Logs"
          subtitle={`Real-time records • ${filteredIncidents.length} incidents`}
          icon={<Search size={16} />}
          onRefresh={fetchIncidents}
          loading={loading}
          user={user}
        />

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

              <div className="w-full lg:w-48">
                <label className="block text-sm font-medium text-zinc-600 mb-2">Source</label>
                <select
                  className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl focus:outline-none focus:border-emerald-400 transition-colors"
                  value={sourceFilter}
                  onChange={(e) => setSourceFilter(e.target.value)}
                >
                  <option value="All">All Sources</option>
                  <option value="Reporter">Reporter</option>
                  <option value="CCTV">CCTV</option>
                </select>
              </div>
            </div>
          </div>

          {/* Results Info */}
          <div className="flex items-center justify-between mb-4 px-1">
            <p className="text-sm text-zinc-500">
              Showing {paginatedIncidents.length} of {filteredIncidents.length} incidents
            </p>
            {(typeFilter !== "All" || priorityFilter !== "All" || statusFilter !== "All" || sourceFilter !== "All" || searchTerm) && (
              <button
                onClick={() => {
                  setTypeFilter("All");
                  setPriorityFilter("All");
                  setStatusFilter("All");
                  setSourceFilter("All");
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
                        <th className="px-6 py-4 text-left font-medium text-zinc-500 text-xs uppercase tracking-wider">ID / Source</th>
                        <th className="px-6 py-4 text-left font-medium text-zinc-500 text-xs uppercase tracking-wider">Type / Category</th>
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
                          <td className="px-6 py-4 font-mono text-xs text-zinc-500">
                            <div className="flex items-center gap-2">
                              #{String(incident.id).replace('AI-', '')}
                              {incident.incidentSource === 'cctv' ? (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-bold bg-red-100 text-red-700 rounded">
                                  <VideoIcon size={10} /> CCTV
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-bold bg-blue-100 text-blue-700 rounded">
                                  👤 Reporter
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex flex-col">
                              <div className="flex items-center gap-2">
                                <AlertTriangle size={14} className="text-zinc-400" />
                                <span className="font-medium text-zinc-900">{incident.type || "Unknown"}</span>
                              </div>
                              {incident.incident_category && (
                                <span className="text-[10px] text-zinc-500 mt-0.5">{incident.incident_category}</span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            {incident.incidentSource === 'cctv' ? (
                              <button
                                onClick={() => openRecordingForIncident(incident)}
                                disabled={recPlaybackLoading}
                                className="flex items-center gap-1 text-purple-600 hover:text-purple-700 disabled:opacity-50"
                                title="Play CCTV Recording"
                              >
                                {recPlaybackLoading ? <RefreshCw size={14} className="animate-spin" /> : <Film size={14} />}
                                <span className="text-xs">CCTV Video</span>
                              </button>
                            ) : incident.media_name ? (
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
                          <td className="px-6 py-4 text-zinc-600 text-xs max-w-xs">
                            {placeNames[incident.id] || formatLocation(incident.latitude, incident.longitude)}
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
                    {placeNames[selectedIncident.id] || formatLocation(selectedIncident.latitude, selectedIncident.longitude)}
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

      {/* CCTV Recording Playback Modal */}
      {recPlayback && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-[300] p-4"
          onClick={closeRecPlayback}>
          <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-3xl overflow-hidden shadow-2xl"
            onClick={e => e.stopPropagation()}>

            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-700 flex items-center gap-3 bg-slate-800/80">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center flex-shrink-0">
                <Film size={18} className="text-purple-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white font-bold text-base">{recPlayback.recording?.camera_name || 'CCTV Recording'}</p>
                <p className="text-slate-400 text-xs mt-0.5">
                  {recPlayback.frames.length} frames
                  {recPlayback.recording?.location ? ` · ${recPlayback.recording.location}` : ''}
                  {recPlayback.recording?.created_at ? ` · ${new Date(recPlayback.recording.created_at).toLocaleString()}` : ''}
                </p>
              </div>
              <button onClick={closeRecPlayback}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 hover:text-white hover:bg-slate-700 transition-colors">
                <X size={18} />
              </button>
            </div>

            {/* Frame viewer */}
            <div className="relative bg-black aspect-video">
              <img
                src={`http://localhost:5000${recPlayback.frames[recPlayback.frame]}`}
                alt={`Frame ${recPlayback.frame + 1}`}
                className="w-full h-full object-contain"
              />
              <div className="absolute top-3 right-3 bg-black/60 text-white text-xs px-3 py-1 rounded-full font-mono">
                {recPlayback.frame + 1} / {recPlayback.frames.length}
              </div>
              {recPlayback.playing && (
                <div className="absolute bottom-4 left-4 flex items-center gap-2 bg-red-600/80 backdrop-blur px-3 py-1.5 rounded-full">
                  <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
                  <span className="text-white text-xs font-bold">PLAYING</span>
                </div>
              )}
              <button
                onClick={() => { clearInterval(recPlayIntervalRef.current); setRecPlayback(p => ({ ...p, frame: Math.max(0, p.frame - 1), playing: false })); }}
                disabled={recPlayback.frame === 0}
                className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 bg-black/50 rounded-full flex items-center justify-center text-white hover:bg-black/70 transition-colors disabled:opacity-20">
                <ChevronLeft size={20} />
              </button>
              <button
                onClick={() => { clearInterval(recPlayIntervalRef.current); setRecPlayback(p => ({ ...p, frame: Math.min(p.frames.length - 1, p.frame + 1), playing: false })); }}
                disabled={recPlayback.frame === recPlayback.frames.length - 1}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 bg-black/50 rounded-full flex items-center justify-center text-white hover:bg-black/70 transition-colors disabled:opacity-20">
                <ChevronRight size={20} />
              </button>
            </div>

            {/* Controls */}
            <div className="px-6 py-5 space-y-4 bg-slate-900">
              <input
                type="range" min={0} max={recPlayback.frames.length - 1} value={recPlayback.frame}
                onChange={e => { clearInterval(recPlayIntervalRef.current); setRecPlayback(p => ({ ...p, frame: parseInt(e.target.value), playing: false })); }}
                className="w-full accent-purple-500 cursor-pointer h-2"
              />
              <div className="flex items-center gap-3">
                <button onClick={toggleRecPlay}
                  className={`flex-1 py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-colors ${
                    recPlayback.playing
                      ? 'bg-yellow-600 hover:bg-yellow-500 text-white'
                      : 'bg-purple-600 hover:bg-purple-500 text-white'
                  }`}>
                  {recPlayback.playing ? '⏸ Pause' : <><Play size={16} /> Play</>}
                </button>
                <button
                  onClick={() => { clearInterval(recPlayIntervalRef.current); setRecPlayback(p => ({ ...p, frame: 0, playing: false })); }}
                  className="px-5 py-3 bg-slate-700 border border-slate-600 text-slate-300 rounded-xl text-sm font-semibold hover:bg-slate-600 transition-colors">
                  ↩ Restart
                </button>
                <button onClick={closeRecPlayback}
                  className="px-5 py-3 bg-slate-700 border border-slate-600 text-slate-300 rounded-xl text-sm font-semibold hover:bg-slate-600 transition-colors">
                  Close
                </button>
              </div>
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