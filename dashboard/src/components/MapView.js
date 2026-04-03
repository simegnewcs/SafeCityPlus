// src/components/MapView.js
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, CircleMarker, Tooltip, ZoomControl, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { AlertTriangle, Navigation, Eye, X, MapPin, Clock, TrendingUp, CheckCircle } from 'lucide-react';

// Fix for default marker icons in React Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Custom marker icons based on priority and status
const createCustomIcon = (priority, status) => {
  let color = '#6b7280'; // default gray
  let pulse = false;
  
  if (priority === 'Critical' || priority === 'High') {
    color = '#ef4444';
    pulse = true;
  } else if (priority === 'Medium') {
    color = '#f59e0b';
  } else if (priority === 'Low' || priority === 'Normal') {
    color = '#10b981';
  }
  
  if (status === 'Resolved') {
    color = '#9ca3af';
    pulse = false;
  }
  
  return L.divIcon({
    className: 'custom-marker',
    html: `
      <div style="
        background-color: ${color};
        width: ${pulse ? '36px' : '32px'};
        height: ${pulse ? '36px' : '32px'};
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        border: 2px solid white;
        transition: transform 0.2s;
        ${pulse ? 'animation: pulse 1.5s infinite;' : ''}
      ">
        <svg width="${pulse ? '18' : '16'}" height="${pulse ? '18' : '16'}" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="8" x2="12" y2="12"/>
          <line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
      </div>
      <style>
        @keyframes pulse {
          0% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.1); opacity: 0.8; }
          100% { transform: scale(1); opacity: 1; }
        }
      </style>
    `,
    iconSize: [pulse ? 36 : 32, pulse ? 36 : 32],
    iconAnchor: [pulse ? 18 : 16, pulse ? 36 : 32],
    popupAnchor: [0, pulse ? -36 : -32],
  });
};

// Component to handle map bounds and fit all markers
const MapBounds = ({ incidents }) => {
  const map = useMap();
  
  useEffect(() => {
    if (incidents && incidents.length > 0) {
      const validIncidents = incidents.filter(inc => inc.latitude && inc.longitude);
      if (validIncidents.length > 0) {
        const bounds = L.latLngBounds(validIncidents.map(inc => [parseFloat(inc.latitude), parseFloat(inc.longitude)]));
        map.fitBounds(bounds, { padding: [50, 50] });
      } else {
        map.setView([9.03, 38.74], 12);
      }
    } else {
      map.setView([9.03, 38.74], 12);
    }
  }, [incidents, map]);
  
  return null;
};

// Component for cluster rendering
const MapView = ({ incidents, onMarkerClick, selectedIncident, onViewDetails, onNavigate }) => {
  const [selectedMarker, setSelectedMarker] = useState(null);
  const [hoveredMarker, setHoveredMarker] = useState(null);
  const [mapStyle, setMapStyle] = useState('default');
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [showClusters, setShowClusters] = useState(true);
  
  // Filter valid incidents with coordinates
  const validIncidents = useMemo(() => {
    return incidents.filter(inc => inc.latitude && inc.longitude);
  }, [incidents]);
  
  // Get tile layer URL based on style
  const getTileUrl = useCallback(() => {
    switch(mapStyle) {
      case 'dark':
        return 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
      case 'satellite':
        return 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
      default:
        return 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
    }
  }, [mapStyle]);
  
  // Calculate stats
  const stats = useMemo(() => {
    const high = validIncidents.filter(i => i.priority === 'High' || i.priority === 'Critical').length;
    const medium = validIncidents.filter(i => i.priority === 'Medium').length;
    const low = validIncidents.filter(i => i.priority === 'Low' || i.priority === 'Normal').length;
    return { high, medium, low, total: validIncidents.length };
  }, [validIncidents]);
  
  // Handle marker click
  const handleMarkerClick = useCallback((incident) => {
    setSelectedMarker(incident.id);
    if (onMarkerClick) {
      onMarkerClick(incident);
    }
  }, [onMarkerClick]);
  
  // Format date for popup
  const formatDate = (dateString) => {
    if (!dateString) return 'Just now';
    const date = new Date(dateString);
    const now = new Date();
    const diff = Math.floor((now - date) / 1000 / 60);
    
    if (diff < 60) return `${diff} minutes ago`;
    if (diff < 1440) return `${Math.floor(diff / 60)} hours ago`;
    return `${Math.floor(diff / 1440)} days ago`;
  };
  
  // Get status color
  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'resolved': return 'bg-emerald-500/20 text-emerald-400';
      case 'in progress': return 'bg-blue-500/20 text-blue-400';
      default: return 'bg-yellow-500/20 text-yellow-400';
    }
  };
  
  // Get priority color class
  const getPriorityColorClass = (priority) => {
    switch (priority?.toLowerCase()) {
      case 'critical': return 'text-red-400';
      case 'high': return 'text-orange-400';
      case 'medium': return 'text-yellow-400';
      default: return 'text-green-400';
    }
  };
  
  return (
    <div className="relative h-full w-full">
      {/* Map Controls Overlay */}
      <div className="absolute top-4 right-4 z-[1000] flex flex-col gap-2">
        {/* Map Style Selector */}
        <div className="bg-zinc-900/90 backdrop-blur-md rounded-xl shadow-lg border border-zinc-700 p-1">
          <button
            onClick={() => setMapStyle('default')}
            className={`px-3 py-1.5 text-xs rounded-lg transition-all ${
              mapStyle === 'default' 
                ? 'bg-emerald-600 text-white' 
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
            }`}
          >
            Standard
          </button>
          <button
            onClick={() => setMapStyle('dark')}
            className={`px-3 py-1.5 text-xs rounded-lg transition-all ${
              mapStyle === 'dark' 
                ? 'bg-emerald-600 text-white' 
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
            }`}
          >
            Dark
          </button>
          <button
            onClick={() => setMapStyle('satellite')}
            className={`px-3 py-1.5 text-xs rounded-lg transition-all ${
              mapStyle === 'satellite' 
                ? 'bg-emerald-600 text-white' 
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
            }`}
          >
            Satellite
          </button>
        </div>
        
        {/* Legend */}
        <div className="bg-zinc-900/90 backdrop-blur-md rounded-xl shadow-lg border border-zinc-700 p-3 min-w-[140px]">
          <p className="text-xs font-semibold text-zinc-300 mb-2">Priority Legend</p>
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse"></div>
              <span className="text-xs text-zinc-400">Critical/High Priority</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-amber-500"></div>
              <span className="text-xs text-zinc-400">Medium Priority</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
              <span className="text-xs text-zinc-400">Low Priority</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-gray-500"></div>
              <span className="text-xs text-zinc-400">Resolved</span>
            </div>
          </div>
        </div>
      </div>
      
      {/* Stats Overlay */}
      <div className="absolute bottom-4 left-4 z-[1000] bg-zinc-900/90 backdrop-blur-md rounded-xl shadow-lg border border-zinc-700 px-3 py-2">
        <div className="flex gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
            <span className="text-zinc-400">High: {stats.high}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-amber-500"></div>
            <span className="text-zinc-400">Medium: {stats.medium}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
            <span className="text-zinc-400">Low: {stats.low}</span>
          </div>
          <div className="pl-2 border-l border-zinc-700">
            <span className="text-zinc-400">Total: {stats.total}</span>
          </div>
        </div>
      </div>
      
      <MapContainer
        center={[9.03, 38.74]}
        zoom={12}
        style={{ height: '100%', width: '100%' }}
        zoomControl={false}
        className="rounded-2xl"
      >
        <ZoomControl position="bottomright" />
        <TileLayer
          url={getTileUrl()}
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
        />
        
        <MapBounds incidents={validIncidents} />
        
        {/* Render markers with custom icons based on priority and status */}
        {validIncidents.map((incident) => {
          const isSelected = selectedMarker === incident.id || selectedIncident?.id === incident.id;
          const isHovered = hoveredMarker === incident.id;
          const isResolved = incident.status === 'Resolved';
          
          return (
            <Marker
              key={incident.id}
              position={[parseFloat(incident.latitude), parseFloat(incident.longitude)]}
              icon={createCustomIcon(incident.priority, incident.status)}
              eventHandlers={{
                click: () => handleMarkerClick(incident),
                mouseover: () => setHoveredMarker(incident.id),
                mouseout: () => setHoveredMarker(null),
              }}
            >
              <Popup className="custom-popup">
                <div className="min-w-[260px] max-w-[300px]">
                  {/* Popup Header */}
                  <div className="flex items-center justify-between mb-3 pb-2 border-b border-zinc-800">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className={`w-4 h-4 ${getPriorityColorClass(incident.priority)}`} />
                      <h3 className="font-semibold text-zinc-100">{incident.type || 'Unknown Incident'}</h3>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      incident.priority === 'Critical' || incident.priority === 'High' ? 'bg-red-500/20 text-red-400' :
                      incident.priority === 'Medium' ? 'bg-amber-500/20 text-amber-400' :
                      'bg-emerald-500/20 text-emerald-400'
                    }`}>
                      {incident.priority || 'Normal'}
                    </span>
                  </div>
                  
                  {/* Popup Content */}
                  <div className="space-y-2 text-sm">
                    <p className="text-zinc-300 text-sm">
                      {incident.description || 'No description available'}
                    </p>
                    
                    <div className="flex items-center gap-2 text-zinc-400">
                      <MapPin className="w-3 h-3" />
                      <span className="text-xs">
                        {parseFloat(incident.latitude).toFixed(6)}, {parseFloat(incident.longitude).toFixed(6)}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-2 text-zinc-400">
                      <Clock className="w-3 h-3" />
                      <span className="text-xs">{formatDate(incident.created_at)}</span>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${getStatusColor(incident.status)}`}>
                        {incident.status || 'Pending'}
                      </span>
                      {incident.reporter_name && (
                        <span className="text-xs text-zinc-500">Reported by: {incident.reporter_name}</span>
                      )}
                    </div>
                  </div>
                  
                  {/* Popup Actions */}
                  <div className="mt-3 pt-2 border-t border-zinc-800 flex gap-2">
                    <button
                      onClick={() => onViewDetails?.(incident)}
                      className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 bg-emerald-600 hover:bg-emerald-700 rounded-lg text-xs transition-colors"
                    >
                      <Eye className="w-3 h-3" />
                      View Details
                    </button>
                    <button
                      onClick={() => onNavigate?.(incident)}
                      className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-xs transition-colors"
                    >
                      <Navigation className="w-3 h-3" />
                      Directions
                    </button>
                  </div>
                </div>
              </Popup>
              
              {/* Tooltip on hover */}
              <Tooltip 
                permanent={isHovered}
                direction="top"
                offset={[0, -20]}
                className="custom-tooltip"
              >
                <div className="px-2 py-1">
                  <p className="font-medium text-xs">{incident.type || 'Incident'}</p>
                  <p className="text-[10px] opacity-75">
                    {incident.priority || 'Normal'} Priority • {incident.status || 'Pending'}
                  </p>
                </div>
              </Tooltip>
            </Marker>
          );
        })}
        
        {/* Optional: Add circle markers for heatmap effect */}
        {showHeatmap && validIncidents.map((incident) => (
          <CircleMarker
            key={`heat-${incident.id}`}
            center={[parseFloat(incident.latitude), parseFloat(incident.longitude)]}
            radius={20}
            fillColor={incident.priority === 'High' ? '#ef4444' : incident.priority === 'Medium' ? '#f59e0b' : '#10b981'}
            fillOpacity={0.3}
            stroke={false}
          />
        ))}
      </MapContainer>
      
      {/* Selected Incident Panel */}
      {selectedIncident && (
        <div className="absolute top-20 left-4 z-[1000] bg-zinc-900/95 backdrop-blur-md rounded-xl shadow-2xl border border-zinc-700 w-80 overflow-hidden animate-in slide-in-from-left-5">
          <div className="flex items-center justify-between p-3 border-b border-zinc-800">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-emerald-500" />
              <h3 className="font-semibold text-sm text-white">Incident #{selectedIncident.id}</h3>
            </div>
            <button
              onClick={() => onMarkerClick && onMarkerClick(null)}
              className="p-1 hover:bg-zinc-800 rounded-lg transition-colors"
            >
              <X className="w-4 h-4 text-zinc-400" />
            </button>
          </div>
          <div className="p-3">
            <p className="font-medium text-white">{selectedIncident.type || 'Unknown Incident'}</p>
            <p className="text-sm text-zinc-400 mt-1 line-clamp-2">{selectedIncident.description || 'No description'}</p>
            <div className="mt-3 flex gap-2">
              <button 
                onClick={() => onViewDetails?.(selectedIncident)}
                className="flex-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 rounded-lg text-xs font-medium transition-colors"
              >
                View Details
              </button>
              <button 
                onClick={() => onNavigate?.(selectedIncident)}
                className="flex-1 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-xs font-medium transition-colors"
              >
                Get Directions
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MapView;