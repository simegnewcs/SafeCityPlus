// src/pages/AdminHeatmap.js
import React, { useState, useEffect, useMemo } from "react";
import AdminSidebar from "../layout/AdminSidebar";
import PageHeader from "../layout/PageHeader";
import { 
  ThermometerSun, Layers, Eye, RefreshCw, 
  ZoomIn, ZoomOut, Navigation, MapPin, AlertTriangle,
  Calendar, TrendingUp, Activity
} from "lucide-react";
import axios from "axios";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Tooltip as LeafletTooltip,
  useMap
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.heat";

// Fix for default marker icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

const API_URL = "http://localhost:5000/api";

// Custom marker icons by priority
const getMarkerIcon = (priority) => {
  let color = "#10b981"; // green default
  if (priority === "High" || priority === "Critical") color = "#ef4444";
  else if (priority === "Medium") color = "#f59e0b";
  
  return L.divIcon({
    html: `<div style="background-color: ${color}; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 10px rgba(0,0,0,0.3);"></div>`,
    iconSize: [12, 12],
    className: "custom-marker"
  });
};

// Component to add heatmap layer
const HeatmapLayer = ({ points }) => {
  const map = useMap();
  
  useEffect(() => {
    if (!map || !points || points.length === 0) return;
    
    // Format points for heatmap: [lat, lng, intensity]
    const heatPoints = points.map(p => [
      p.latitude,
      p.longitude,
      p.priority === "High" || p.priority === "Critical" ? 1.0 :
      p.priority === "Medium" ? 0.6 : 0.3
    ]);
    
    const heat = L.heatLayer(heatPoints, {
      radius: 25,
      blur: 15,
      maxZoom: 17,
      minOpacity: 0.3,
      gradient: {
        0.2: '#10b981',
        0.5: '#f59e0b',
        0.8: '#ef4444'
      }
    });
    
    heat.addTo(map);
    
    return () => {
      map.removeLayer(heat);
    };
  }, [map, points]);
  
  return null;
};

// Component to fit bounds
const FitBounds = ({ incidents }) => {
  const map = useMap();
  
  useEffect(() => {
    if (incidents && incidents.length > 0) {
      const validIncidents = incidents.filter(i => i.latitude && i.longitude);
      if (validIncidents.length > 0) {
        const bounds = L.latLngBounds(validIncidents.map(i => [parseFloat(i.latitude), parseFloat(i.longitude)]));
        map.fitBounds(bounds, { padding: [50, 50] });
      }
    }
  }, [incidents, map]);
  
  return null;
};

const AdminHeatmap = () => {
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [showMarkers, setShowMarkers] = useState(true);
  const [selectedPriority, setSelectedPriority] = useState("All");
  const [mapCenter, setMapCenter] = useState([9.03, 38.74]); // Addis Ababa center
  const [mapZoom, setMapZoom] = useState(12);
  const [stats, setStats] = useState({ total: 0, high: 0, medium: 0, low: 0 });

  // Fetch incidents from API
  const fetchIncidents = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/incidents`);
      setIncidents(response.data);
      setLastUpdated(new Date());
      
      // Calculate stats
      const high = response.data.filter(i => i.priority === "High" || i.priority === "Critical").length;
      const medium = response.data.filter(i => i.priority === "Medium").length;
      const low = response.data.filter(i => i.priority === "Low" || i.priority === "Normal").length;
      setStats({ total: response.data.length, high, medium, low });
    } catch (error) {
      console.error("Error fetching incidents:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIncidents();
    // Refresh every 30 seconds
    const interval = setInterval(fetchIncidents, 30000);
    return () => clearInterval(interval);
  }, []);

  // Filter incidents by priority
  const filteredIncidents = useMemo(() => {
    if (selectedPriority === "All") return incidents;
    if (selectedPriority === "High") return incidents.filter(i => i.priority === "High" || i.priority === "Critical");
    return incidents.filter(i => i.priority === selectedPriority);
  }, [incidents, selectedPriority]);

  // Get valid incidents with coordinates
  const validIncidents = useMemo(() => {
    return filteredIncidents.filter(i => i.latitude && i.longitude);
  }, [filteredIncidents]);

  // Heatmap points
  const heatmapPoints = useMemo(() => {
    return validIncidents.map(i => ({
      latitude: parseFloat(i.latitude),
      longitude: parseFloat(i.longitude),
      priority: i.priority,
      type: i.type,
      description: i.description,
      created_at: i.created_at
    }));
  }, [validIncidents]);

  const getPriorityColor = (priority) => {
    switch (priority?.toLowerCase()) {
      case 'critical': return 'bg-red-100 text-red-700 border-red-200';
      case 'high': return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'medium': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      default: return 'bg-green-100 text-green-700 border-green-200';
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

  const handleZoomIn = () => {
    setMapZoom(prev => Math.min(prev + 1, 18));
  };

  const handleZoomOut = () => {
    setMapZoom(prev => Math.max(prev - 1, 3));
  };

  const handleResetView = () => {
    setMapCenter([9.03, 38.74]);
    setMapZoom(12);
  };

  if (loading && incidents.length === 0) {
    return (
      <div className="flex h-screen bg-slate-50">
        <AdminSidebar user={user} />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="relative w-14 h-14 mx-auto mb-5">
              <div className="w-14 h-14 border-4 border-indigo-100 rounded-full"></div>
              <div className="absolute inset-0 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
            <p className="text-slate-500 font-medium">Loading heatmap data…</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900 overflow-hidden">
      <AdminSidebar user={user} />

      <div className="flex-1 flex flex-col overflow-hidden">
        <PageHeader
          title="Incident Heatmap"
          subtitle="Visual density of incidents across the city"
          icon={<ThermometerSun size={16} />}
          onRefresh={handleRefresh}
          loading={loading}
          user={user}
        />

        {/* Main Content */}
        <main className="flex-1 p-6 md:p-8 overflow-auto flex flex-col">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
            <div className="bg-white p-4 rounded-2xl border border-zinc-200 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-zinc-500 text-xs font-medium">Total Incidents</p>
                  <p className="text-2xl font-bold text-zinc-900">{stats.total}</p>
                </div>
                <MapPin className="w-5 h-5 text-emerald-500" />
              </div>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-zinc-200 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-zinc-500 text-xs font-medium">High Priority</p>
                  <p className="text-2xl font-bold text-red-600">{stats.high}</p>
                </div>
                <AlertTriangle className="w-5 h-5 text-red-500" />
              </div>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-zinc-200 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-zinc-500 text-xs font-medium">Medium Priority</p>
                  <p className="text-2xl font-bold text-amber-600">{stats.medium}</p>
                </div>
                <Activity className="w-5 h-5 text-amber-500" />
              </div>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-zinc-200 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-zinc-500 text-xs font-medium">Low Priority</p>
                  <p className="text-2xl font-bold text-emerald-600">{stats.low}</p>
                </div>
                <TrendingUp className="w-5 h-5 text-emerald-500" />
              </div>
            </div>
          </div>

          {/* Controls Bar */}
          <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 p-4 mb-6 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="flex flex-wrap gap-3 items-center">
              <div>
                <p className="text-sm font-medium text-zinc-700">
                  Showing <span className="text-emerald-600 font-semibold">{validIncidents.length}</span> incidents
                </p>
                <p className="text-xs text-zinc-500">Darker areas indicate higher incident density</p>
              </div>
              
              {/* Priority Filter */}
              <select
                value={selectedPriority}
                onChange={(e) => setSelectedPriority(e.target.value)}
                className="px-3 py-1.5 bg-zinc-50 border border-zinc-200 rounded-lg text-sm focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 outline-none"
              >
                <option value="All">All Priorities</option>
                <option value="High">High Priority</option>
                <option value="Medium">Medium Priority</option>
                <option value="Low">Low Priority</option>
              </select>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowHeatmap(!showHeatmap)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-all ${
                  showHeatmap ? "bg-emerald-100 text-emerald-700" : "bg-zinc-100 text-zinc-600"
                }`}
              >
                <ThermometerSun size={16} />
                Heatmap
              </button>
              <button
                onClick={() => setShowMarkers(!showMarkers)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-all ${
                  showMarkers ? "bg-emerald-100 text-emerald-700" : "bg-zinc-100 text-zinc-600"
                }`}
              >
                <MapPin size={16} />
                Markers
              </button>
            </div>
          </div>

          {/* Map Container */}
          <div className="flex-1 bg-white rounded-2xl shadow-sm border border-zinc-200 overflow-hidden flex flex-col">
            <div className="p-4 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-zinc-900">Live Incident Heatmap</h2>
                <span className="px-2 py-0.5 text-xs font-medium bg-emerald-100 text-emerald-700 rounded-full">
                  {showHeatmap ? "HEATMAP MODE" : "MARKER MODE"}
                </span>
              </div>
              
              <div className="flex gap-2">
                <button 
                  onClick={handleZoomIn}
                  className="p-1.5 hover:bg-zinc-100 rounded-lg transition-colors"
                  title="Zoom In"
                >
                  <ZoomIn size={16} />
                </button>
                <button 
                  onClick={handleZoomOut}
                  className="p-1.5 hover:bg-zinc-100 rounded-lg transition-colors"
                  title="Zoom Out"
                >
                  <ZoomOut size={16} />
                </button>
                <button 
                  onClick={handleResetView}
                  className="p-1.5 hover:bg-zinc-100 rounded-lg transition-colors"
                  title="Reset View"
                >
                  <Navigation size={16} />
                </button>
              </div>
            </div>

            {/* Map Area */}
            <div className="flex-1 relative min-h-[500px]">
              <MapContainer
                center={mapCenter}
                zoom={mapZoom}
                style={{ height: "100%", width: "100%", zIndex: 1, minHeight: "500px" }}
                zoomControl={false}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
                />
                
                {showHeatmap && heatmapPoints.length > 0 && (
                  <HeatmapLayer points={heatmapPoints} />
                )}
                
                {showMarkers && validIncidents.map((incident) => (
                  <Marker
                    key={incident.id}
                    position={[parseFloat(incident.latitude), parseFloat(incident.longitude)]}
                    icon={getMarkerIcon(incident.priority)}
                  >
                    <Popup>
                      <div className="min-w-[200px] p-1">
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="font-semibold text-zinc-900">{incident.type || "Unknown Incident"}</h3>
                          <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${getPriorityColor(incident.priority)}`}>
                            {incident.priority || "Normal"}
                          </span>
                        </div>
                        {incident.description && (
                          <p className="text-sm text-zinc-600 mb-2">{incident.description}</p>
                        )}
                        <div className="text-xs text-zinc-500 space-y-1">
                          <div className="flex items-center gap-1">
                            <MapPin size={10} />
                            <span>{parseFloat(incident.latitude).toFixed(4)}, {parseFloat(incident.longitude).toFixed(4)}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Calendar size={10} />
                            <span>{formatDate(incident.created_at)}</span>
                          </div>
                          <div className="mt-2 pt-1 border-t border-zinc-100">
                            <span className={`inline-flex px-2 py-0.5 text-xs rounded-full ${
                              incident.status === "Resolved" ? "bg-green-100 text-green-700" :
                              incident.status === "In Progress" ? "bg-blue-100 text-blue-700" :
                              "bg-yellow-100 text-yellow-700"
                            }`}>
                              {incident.status || "Pending"}
                            </span>
                          </div>
                        </div>
                      </div>
                    </Popup>
                    <LeafletTooltip permanent={false} direction="top" offset={[0, -10]}>
                      <span className="text-xs font-medium">{incident.type || "Incident"}</span>
                    </LeafletTooltip>
                  </Marker>
                ))}
                
                <FitBounds incidents={validIncidents} />
              </MapContainer>
            </div>
          </div>

          {/* Legend / Info Footer */}
          <div className="mt-6 text-xs text-zinc-500 text-center">
            Heatmap shows concentration of incidents • Zoom and pan to explore hotspots • Click markers for details
          </div>
        </main>
      </div>
    </div>
  );
};

export default AdminHeatmap;