// src/components/MapView.js
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, CircleMarker, Tooltip, ZoomControl, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { AlertTriangle, Navigation, Eye, X } from 'lucide-react';

// Fix for default marker icons in React Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Custom marker icons based on priority
const createCustomIcon = (priority) => {
  const colors = {
    High: '#ef4444',
    Medium: '#f59e0b',
    Low: '#10b981'
  };
  
  const color = colors[priority] || '#6b7280';
  
  return L.divIcon({
    className: 'custom-marker',
    html: `
      <div style="
        background-color: ${color};
        width: 32px;
        height: 32px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        border: 2px solid white;
        transition: transform 0.2s;
      ">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="8" x2="12" y2="12"/>
          <line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32],
  });
};

// Component to handle map bounds and fit all markers
const MapBounds = ({ incidents }) => {
  const map = useMap();
  
  useEffect(() => {
    if (incidents.length > 0) {
      const bounds = L.latLngBounds(incidents.map(inc => [inc.latitude, inc.longitude]));
      map.fitBounds(bounds, { padding: [50, 50] });
    } else {
      map.setView([9.03, 38.74], 12);
    }
  }, [incidents, map]);
  
  return null;
};

// Component for cluster rendering (optional - requires react-leaflet-cluster)
const MapView = ({ incidents, onMarkerClick, selectedIncident }) => {
  const [selectedMarker, setSelectedMarker] = useState(null);
  const [hoveredMarker, setHoveredMarker] = useState(null);
  const [mapStyle, setMapStyle] = useState('default'); // 'default', 'dark', 'satellite'
  
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
  
  // Group incidents by location for clustering (optional)
  const groupedIncidents = useMemo(() => {
    const groups = {};
    incidents.forEach(inc => {
      const key = `${inc.latitude},${inc.longitude}`;
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(inc);
    });
    return groups;
  }, [incidents]);
  
  // Handle marker click with analytics
  const handleMarkerClick = useCallback((incident) => {
    setSelectedMarker(incident.id);
    if (onMarkerClick) {
      onMarkerClick(incident);
    }
    // You can add analytics here
    console.log('Marker clicked:', incident.id);
  }, [onMarkerClick]);
  
  // Get priority color for circle markers
  const getPriorityColor = useCallback((priority) => {
    switch(priority) {
      case 'High': return '#ef4444';
      case 'Medium': return '#f59e0b';
      case 'Low': return '#10b981';
      default: return '#6b7280';
    }
  }, []);
  
  // Get priority opacity
  const getPriorityOpacity = useCallback((priority) => {
    switch(priority) {
      case 'High': return 0.8;
      case 'Medium': return 0.6;
      case 'Low': return 0.4;
      default: return 0.3;
    }
  }, []);
  
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
                ? 'bg-indigo-600 text-white' 
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
            }`}
          >
            Standard
          </button>
          <button
            onClick={() => setMapStyle('dark')}
            className={`px-3 py-1.5 text-xs rounded-lg transition-all ${
              mapStyle === 'dark' 
                ? 'bg-indigo-600 text-white' 
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
            }`}
          >
            Dark
          </button>
          <button
            onClick={() => setMapStyle('satellite')}
            className={`px-3 py-1.5 text-xs rounded-lg transition-all ${
              mapStyle === 'satellite' 
                ? 'bg-indigo-600 text-white' 
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
              <span className="text-xs text-zinc-400">High Priority</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-amber-500"></div>
              <span className="text-xs text-zinc-400">Medium Priority</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
              <span className="text-xs text-zinc-400">Low Priority</span>
            </div>
          </div>
          <div className="mt-2 pt-2 border-t border-zinc-800">
            <p className="text-[10px] text-zinc-500">
              Total: {incidents.length} incidents
            </p>
          </div>
        </div>
      </div>
      
      {/* Stats Overlay */}
      <div className="absolute bottom-4 left-4 z-[1000] bg-zinc-900/90 backdrop-blur-md rounded-xl shadow-lg border border-zinc-700 px-3 py-2">
        <div className="flex gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-red-500"></div>
            <span className="text-zinc-400">
              High: {incidents.filter(i => i.ai_priority === 'High').length}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-amber-500"></div>
            <span className="text-zinc-400">
              Medium: {incidents.filter(i => i.ai_priority === 'Medium').length}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
            <span className="text-zinc-400">
              Low: {incidents.filter(i => i.ai_priority === 'Low').length}
            </span>
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
        
        <MapBounds incidents={incidents} />
        
        {/* Render markers with custom icons based on priority */}
        {incidents.map((incident) => {
          const isSelected = selectedMarker === incident.id || selectedIncident?.id === incident.id;
          const isHovered = hoveredMarker === incident.id;
          
          return (
            <Marker
              key={incident.id}
              position={[incident.latitude, incident.longitude]}
              icon={createCustomIcon(incident.ai_priority)}
              eventHandlers={{
                click: () => handleMarkerClick(incident),
                mouseover: () => setHoveredMarker(incident.id),
                mouseout: () => setHoveredMarker(null),
              }}
            >
              <Popup className="custom-popup">
                <div className="min-w-[240px]">
                  {/* Popup Header */}
                  <div className="flex items-center justify-between mb-3 pb-2 border-b border-zinc-800">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className={`w-4 h-4 ${
                        incident.ai_priority === 'High' ? 'text-red-500' :
                        incident.ai_priority === 'Medium' ? 'text-amber-500' :
                        'text-emerald-500'
                      }`} />
                      <h3 className="font-semibold text-zinc-100">{incident.type || 'Incident'}</h3>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      incident.ai_priority === 'High' ? 'bg-red-500/20 text-red-400' :
                      incident.ai_priority === 'Medium' ? 'bg-amber-500/20 text-amber-400' :
                      'bg-emerald-500/20 text-emerald-400'
                    }`}>
                      {incident.ai_priority}
                    </span>
                  </div>
                  
                  {/* Popup Content */}
                  <div className="space-y-2 text-sm">
                    <p className="text-zinc-300">{incident.description || 'No description available'}</p>
                    
                    {incident.location && (
                      <div className="flex items-center gap-2 text-zinc-400">
                        <Navigation className="w-3 h-3" />
                        <span className="text-xs">{incident.location}</span>
                      </div>
                    )}
                    
                    {incident.timestamp && (
                      <p className="text-xs text-zinc-500">
                        Reported: {new Date(incident.timestamp).toLocaleString()}
                      </p>
                    )}
                  </div>
                  
                  {/* Popup Actions */}
                  <div className="mt-3 pt-2 border-t border-zinc-800 flex gap-2">
                    <button
                      onClick={() => {
                        // Handle view details
                        console.log('View details:', incident);
                      }}
                      className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 bg-indigo-600 hover:bg-indigo-700 rounded-lg text-xs transition-colors"
                    >
                      <Eye className="w-3 h-3" />
                      View Details
                    </button>
                    <button
                      onClick={() => {
                        // Handle directions
                        window.open(`https://www.google.com/maps/dir//${incident.latitude},${incident.longitude}`, '_blank');
                      }}
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
                  <p className="text-[10px] opacity-75">{incident.ai_priority} Priority</p>
                </div>
              </Tooltip>
            </Marker>
          );
        })}
        
        {/* Optional: Add heatmap layer for high density areas */}
        {/* This requires additional libraries like leaflet-heatmap */}
        
      </MapContainer>
      
      {/* Selected Incident Panel (if needed) */}
      {selectedIncident && (
        <div className="absolute top-20 left-4 z-[1000] bg-zinc-900/95 backdrop-blur-md rounded-xl shadow-2xl border border-zinc-700 w-80 overflow-hidden animate-in slide-in-from-left-5">
          <div className="flex items-center justify-between p-3 border-b border-zinc-800">
            <h3 className="font-semibold text-sm">Selected Incident</h3>
            <button
              onClick={() => onMarkerClick && onMarkerClick(null)}
              className="p-1 hover:bg-zinc-800 rounded-lg transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="p-3">
            <p className="font-medium">{selectedIncident.type}</p>
            <p className="text-sm text-zinc-400 mt-1">{selectedIncident.description}</p>
            <div className="mt-3 flex gap-2">
              <button className="flex-1 px-3 py-1.5 bg-indigo-600 rounded-lg text-xs">
                Assign Team
              </button>
              <button className="flex-1 px-3 py-1.5 bg-zinc-800 rounded-lg text-xs">
                Update Status
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MapView;