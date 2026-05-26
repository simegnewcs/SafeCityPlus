import React, { useState, useEffect, useRef, useCallback } from "react";
import AdminSidebar from "../layout/AdminSidebar";
import {
  Play, Maximize2, RefreshCw, Camera,
  AlertTriangle, Eye, Radio, WifiOff, X,
  Circle, MapPin, Cpu, Zap, Shield, Activity,
  TrendingUp, Clock, ChevronDown, ChevronUp, Download,
  AlertCircle, CheckCircle, Crosshair, BarChart2
} from "lucide-react";
import axios from "axios";
import io from 'socket.io-client';

const API_URL = "http://localhost:5000/api";
const SOCKET_URL = "http://localhost:5000";

// ── Helper components ─────────────────────────────────────────────────────────

const SeverityBadge = ({ severity }) => {
  const map = {
    'Critical Emergency': 'bg-red-500/20 text-red-300 border border-red-500/40',
    'Medium Risk':        'bg-yellow-500/20 text-yellow-300 border border-yellow-500/40',
    'Low Risk':           'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40',
  };
  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${map[severity] || map['Low Risk']}`}>
      {severity}
    </span>
  );
};

const ConfidenceBar = ({ value }) => {
  const color = value >= 70 ? 'bg-red-500' : value >= 45 ? 'bg-yellow-400' : 'bg-emerald-400';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${value}%` }} />
      </div>
      <span className="text-[11px] font-mono text-white/70 w-8 text-right">{value}%</span>
    </div>
  );
};

// Shared geocoding function
const getPlaceName = async (locationStr, setPlaceNames) => {
  if (!locationStr || locationStr === 'Unknown') return 'Unknown';
  
  // Check if we already have this place name cached
  if (setPlaceNames && typeof setPlaceNames === 'function') {
    // This is a state setter, we can't check cache here without state
    // The caching will be handled by the caller
  } else {
    // Simple cache for standalone usage
    if (!getPlaceName.cache) getPlaceName.cache = {};
    if (getPlaceName.cache[locationStr]) {
      return getPlaceName.cache[locationStr];
    }
  }

  // Check if it's already a place name (not coordinates)
  if (!locationStr.includes(',') || isNaN(locationStr.split(',')[0]) || isNaN(locationStr.split(',')[1])) {
    return locationStr;
  }

  const [lat, lng] = locationStr.split(',').map(s => parseFloat(s.trim()));
  if (isNaN(lat) || isNaN(lng)) return locationStr;

  // Try multiple geocoding approaches with OpenStreetMap
  const services = [
    {
      name: 'OpenStreetMap Nominatim Building Focus',
      url: `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1&zoom=18`,
      timeout: 12000 // 12 seconds
    },
    {
      name: 'OpenStreetMap Search Buildings',
      url: `https://nominatim.openstreetmap.org/search?q=building&format=json&limit=3&addressdetails=1&viewbox=${lng-0.003},${lat+0.003},${lng+0.003},${lat-0.003}`,
      timeout: 8000 // 8 seconds
    },
    {
      name: 'OpenStreetMap Search Shops',
      url: `https://nominatim.openstreetmap.org/search?q=shop&format=json&limit=3&addressdetails=1&viewbox=${lng-0.003},${lat+0.003},${lng+0.003},${lat-0.003}`,
      timeout: 8000 // 8 seconds
    },
    {
      name: 'OpenStreetMap Search Amenities',
      url: `https://nominatim.openstreetmap.org/search?q=amenity&format=json&limit=3&addressdetails=1&viewbox=${lng-0.003},${lat+0.003},${lng+0.003},${lat-0.003}`,
      timeout: 8000 // 8 seconds
    },
    {
      name: 'OpenStreetMap Search University',
      url: `https://nominatim.openstreetmap.org/search?q=university&format=json&limit=3&addressdetails=1&viewbox=${lng-0.005},${lat+0.005},${lng+0.005},${lat-0.005}`,
      timeout: 8000 // 8 seconds
    },
    {
      name: 'OpenStreetMap Search Offices',
      url: `https://nominatim.openstreetmap.org/search?q=office&format=json&limit=3&addressdetails=1&viewbox=${lng-0.003},${lat+0.003},${lng+0.003},${lat-0.003}`,
      timeout: 8000 // 8 seconds
    }
  ];

  for (const service of services) {
    try {
      console.log(`Admin AI: Trying ${service.name} for ${locationStr}...`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), service.timeout);
      
      const response = await fetch(service.url, {
        headers: {
          'Accept-Language': 'en',
          'User-Agent': 'SafeCityAdmin/1.0'
        },
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const data = await response.json();
      
      // Handle both reverse geocoding and search results
      let placeName = null;
      
      if (service.name.includes('Search Nearby')) {
        // Handle search results (array of places)
        if (Array.isArray(data) && data.length > 0) {
          // Find the most relevant place (prioritize buildings and walkable locations)
          const relevantPlace = data.find(place => {
            const name = (place.display_name || '').toLowerCase();
            const type = place.type || '';
            const class_ = place.class || '';
            return name.includes('university') || 
                   name.includes('college') || 
                   name.includes('institute') || 
                   name.includes('computer') || 
                   name.includes('science') || 
                   name.includes('technology') ||
                   name.includes('building') ||
                   name.includes('restaurant') ||
                   name.includes('hospital') ||
                   name.includes('bank') ||
                   name.includes('shop') ||
                   name.includes('office') ||
                   type === 'university' ||
                   type === 'building' ||
                   type === 'shop' ||
                   type === 'office' ||
                   class_ === 'education' ||
                   class_ === 'building' ||
                   class_ === 'shop';
          }) || data.find(place => {
            // Fallback: avoid highways and roads
            const name = (place.display_name || '').toLowerCase();
            return !name.includes('highway') && 
                   !name.includes('road') && 
                   !name.match(/^a\d+$/);
          }) || data[0]; // Ultimate fallback to first result
          
          if (relevantPlace) {
            placeName = relevantPlace.display_name.split(',')[0].trim();
          }
        }
      } else {
        // Handle reverse geocoding results
        if (data && data.display_name) {
          const address = data.address || {};
          
          // Priority order for meaningful place names - prioritize specific buildings
          if (data.name && data.name.trim() && 
              !data.name.toLowerCase().includes('atm') &&
              !data.name.toLowerCase().match(/^\d+/) &&
              !data.name.toLowerCase().match(/^a\d+/) &&
              !data.name.toLowerCase().includes('highway')) {
            placeName = data.name.trim();
          } else if (address.building && 
                      !address.building.toLowerCase().includes('highway') &&
                      !address.building.toLowerCase().match(/^a\d+/)) {
            placeName = address.building;
          } else if (address.university || address.college) {
            placeName = address.university || address.college;
          } else if (address.education) {
            placeName = address.education;
          } else if (address.shop && 
                      !address.shop.toLowerCase().includes('atm') &&
                      !address.shop.toLowerCase().match(/^a\d+/)) {
            placeName = address.shop;
          } else if (address.amenity && 
                      (address.amenity.includes('university') || 
                       address.amenity.includes('college') ||
                       address.amenity.includes('school') ||
                       address.amenity.includes('institute') ||
                       address.amenity.includes('restaurant') ||
                       address.amenity.includes('hospital') ||
                       address.amenity.includes('bank') ||
                       address.amenity.includes('pharmacy'))) {
            placeName = address.amenity;
          } else if (address.tourism) {
            placeName = address.tourism;
          } else if (address.office) {
            placeName = address.office;
          } else if (data.class === 'education' || data.class === 'building') {
            placeName = data.type || data.display_name.split(',')[0].trim();
          } else if (address.road && (address.suburb || address.neighbourhood)) {
            // Combine road and area for better context
            const area = address.suburb || address.neighbourhood;
            placeName = `${address.road}, ${area}`;
          } else if (address.road) {
            placeName = address.road;
          } else if (address.neighbourhood || address.suburb) {
            placeName = address.neighbourhood || address.suburb;
          } else if (address.village) {
            placeName = address.village;
          } else if (address.city || address.town) {
            placeName = address.city || address.town;
          } else {
            // Smart fallback - extract meaningful parts, avoid highways and roads
            const parts = data.display_name.split(',');
            const meaningfulParts = parts.filter(part => {
              const trimmed = part.trim();
              return trimmed && 
                     !trimmed.match(/^\d+$/) && // Skip postcodes
                     !trimmed.match(/Ethiopia$/i) && // Skip country
                     !trimmed.match(/\d{4}$/) && // Skip 4-digit codes
                     !trimmed.toLowerCase().includes('atm') && // Skip ATMs
                     !trimmed.toLowerCase().match(/^a\d+$/) && // Skip highway names like A3
                     !trimmed.toLowerCase().includes('highway') &&
                     !trimmed.toLowerCase().includes('road') &&
                     !trimmed.toLowerCase().includes('street');
            });
            
            // If we filtered out everything, try to find a specific area
            if (meaningfulParts.length === 0) {
              const areaParts = parts.filter(part => {
                const trimmed = part.trim();
                return trimmed && 
                       !trimmed.match(/^\d+$/) && 
                       !trimmed.match(/Ethiopia$/i) &&
                       !trimmed.match(/\d{4}$/) &&
                       !trimmed.toLowerCase().includes('atm');
              });
              placeName = areaParts.slice(0, 2).join(', ').trim();
            } else {
              placeName = meaningfulParts.slice(0, 2).join(', ').trim();
            }
          }
        }
      }
      
      if (placeName && placeName !== 'Unknown Location' && placeName.length > 0) {
        console.log(`Admin AI: ✅ Found place name: ${placeName}`);
        
        // Cache the result
        if (setPlaceNames && typeof setPlaceNames === 'function') {
          setPlaceNames(prev => ({ ...prev, [locationStr]: placeName }));
        } else {
          if (!getPlaceName.cache) getPlaceName.cache = {};
          getPlaceName.cache[locationStr] = placeName;
        }
        
        return placeName;
      }
    } catch (error) {
      console.error(`Admin AI: ❌ ${service.name} failed:`, error.message);
      if (error.name === 'AbortError') {
        console.log(`Admin AI: ⏰ ${service.name} timed out`);
      }
      // Continue to next service
      continue;
    }
  }
  
  // If all services fail, create a meaningful fallback name
  console.log(`Admin AI: 📍 All geocoding services failed for ${locationStr}, creating intelligent fallback`);
  
  // Create a meaningful fallback based on coordinate patterns
  const fallbackLat = parseFloat(lat);
  const fallbackLng = parseFloat(lng);
  
  // Ethiopian coordinate ranges for common areas
  const ethiopianLocations = {
    'Addis Ababa Area': { latMin: 8.8, latMax: 9.2, lngMin: 38.6, lngMax: 38.9 },
    'Bahir Dar Area': { latMin: 11.5, latMax: 11.7, lngMin: 37.3, lngMax: 37.5 },
    'Gondar Area': { latMin: 12.5, latMax: 12.7, lngMin: 37.4, lngMax: 37.5 },
    'Mekelle Area': { latMin: 13.4, latMax: 13.6, lngMin: 39.4, lngMax: 39.6 }
  };
  
  let fallbackName = 'Unknown Location';
  
  // Check if coordinates match known Ethiopian areas
  for (const [areaName, bounds] of Object.entries(ethiopianLocations)) {
    if (fallbackLat >= bounds.latMin && fallbackLat <= bounds.latMax && 
        fallbackLng >= bounds.lngMin && fallbackLng <= bounds.lngMax) {
      fallbackName = areaName;
      break;
    }
  }
  
  // If no specific area, create a generic but meaningful name
  if (fallbackName === 'Unknown Location') {
    // Use more readable coordinate format
    fallbackName = `Location ${fallbackLat.toFixed(4)}°N, ${fallbackLng.toFixed(4)}°E`;
  }
  
  console.log(`Admin AI: 🎯 Using fallback location name: ${fallbackName}`);
  return fallbackName;
};

// ── Stream Location Map with Routing ─────────────────────────────────────────
const StreamLocationMap = ({ locationStr }) => {
  const [incidentCoords, setIncidentCoords] = React.useState(null);
  const [placeName,      setPlaceName]      = React.useState(null);
  const [iframeSrc,      setIframeSrc]      = React.useState(null);
  const blobUrlRef = React.useRef(null);

  // Parse incident coords from location string (mobile app approach)
  React.useEffect(() => {
    console.log('Parsing incident location:', locationStr);
    
    if (!locationStr || locationStr === 'Unknown') {
      console.log('No valid location string provided');
      return;
    }
    
    const parts = locationStr.split(',').map(s => parseFloat(s.trim()));
    console.log('Parsed coordinate parts:', parts);
    
    if (parts.length < 2 || isNaN(parts[0]) || isNaN(parts[1])) {
      console.log('Invalid coordinate format');
      return;
    }
    
    // Sanity check: valid lat/lng ranges
    const [lat, lng] = parts;
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      console.log('Coordinates out of valid range:', { lat, lng });
      return;
    }
    
    const coords = { lat, lng };
    console.log('Setting incident coordinates:', coords);
    setIncidentCoords(coords);
    
    // Simple coordinate display like mobile app - no complex geocoding
    
    // Get place name for the coordinates
    getPlaceName(locationStr, null).then(name => {
      setPlaceName(name);
    }).catch(error => {
      console.error('Error getting place name:', error);
      setPlaceName(null);
    });
  }, [locationStr]);

  
  
  
  // Build Leaflet HTML blob and inject into iframe whenever incident location changes
  React.useEffect(() => {
    if (!incidentCoords) return;
    const { lat: iLat, lng: iLng } = incidentCoords;

    const html = `<!DOCTYPE html><html><head>
<meta charset="utf-8"/>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"><\/script>
<style>
  html,body,#map{margin:0;padding:0;width:100%;height:100%;background:#0f172a}
  .incident-label {
    background: #dc2626;
    color: white;
    padding: 8px 12px;
    border-radius: 8px;
    font-weight: bold;
    font-size: 14px;
    box-shadow: 0 4px 12px rgba(220, 38, 38, 0.4);
    border: 2px solid #fff;
    white-space: nowrap;
    z-index: 10000;
  }
  .incident-marker {
    width: 24px;
    height: 24px;
    background: #dc2626;
    border: 4px solid #fff;
    border-radius: 50%;
    box-shadow: 0 0 20px rgba(220, 38, 38, 0.6);
    z-index: 10001;
  }
  .incident-popup {
    font-family: system-ui, -apple-system, sans-serif;
  }
  .incident-popup .leaflet-popup-content-wrapper {
    background: #1e293b;
    color: #f1f5f9;
    border-radius: 12px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  }
  .incident-popup .leaflet-popup-content {
    margin: 16px;
    min-width: 200px;
  }
  .incident-popup .leaflet-popup-tip {
    background: #1e293b;
  }
</style>
</head><body>
<div id="map"></div>
<script>
  var map = L.map('map',{zoomControl:true,attributionControl:false}).setView([${iLat},${iLng}],18);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19}).addTo(map);

  // Enhanced incident marker with label
  var incidentIcon = L.divIcon({
    className: 'incident-marker',
    iconAnchor: [12, 12],
    popupAnchor: [0, -20]
  });
  
  var incidentMarker = L.marker([${iLat},${iLng}], {icon: incidentIcon}).addTo(map);
  
  // Add permanent label for the incident with place name
  var labelText = '${placeName ? "🚨 " + placeName.toUpperCase() : "🚨 INCIDENT LOCATION"}';
  var incidentLabel = L.divIcon({
    className: 'incident-label',
    html: labelText,
    iconAnchor: [80, -10],
    iconSize: [160, 32]
  });
  
  L.marker([${iLat},${iLng}], {icon: incidentLabel}).addTo(map);
  
  // Enhanced popup with better styling
  var popupContent = '<div class="incident-popup">' +
    '<h3 style="margin:0 0 8px 0;color:#dc2626;font-size:16px;">🚨 EMERGENCY INCIDENT</h3>' +
    '<p style="margin:0 0 12px 0;font-size:18px;font-weight:bold;color:#f1f5f9;">${placeName || "Incident Location"}</p>' +
    '<p style="margin:4px 0;font-size:12px;color:#94a3b8;"><strong>GPS Coordinates:</strong><br>' +
    '<code style="background:#334155;padding:4px 6px;border-radius:4px;font-size:11px;">${iLat.toFixed(6)}, ${iLng.toFixed(6)}</code></p>' +
    '<p style="margin:8px 0 0 0;font-size:11px;color:#64748b;">📍 High precision location for emergency response teams</p>' +
    '</div>';
  
  incidentMarker.bindPopup(popupContent, {
    maxWidth: 300,
    className: 'incident-popup'
  }).openPopup();
<\/script>
</body></html>`;

    // Revoke previous blob URL to avoid memory leak
    if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
    const blob = new Blob([html], { type: 'text/html' });
    const url  = URL.createObjectURL(blob);
    blobUrlRef.current = url;
    setIframeSrc(url);
  }, [incidentCoords]);

  // Cleanup blob on unmount
  React.useEffect(() => () => { if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current); }, []);

  if (!incidentCoords) {
    return (
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-3 flex items-center gap-2">
        <MapPin size={12} className="text-slate-500" />
        <span className="text-[11px] text-slate-400">{locationStr || 'No location data'}</span>
      </div>
    );
  }

  const { lat: iLat, lng: iLng } = incidentCoords;
  const googleMapsLink = `https://www.google.com/maps?q=${iLat},${iLng}&z=16`;

  const fmtDist = (m) => m >= 1000 ? `${(m/1000).toFixed(1)} km` : `${Math.round(m)} m`;
  const fmtTime = (s) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    return h > 0 ? `${h}h ${m}m` : `${m} min`;
  };

  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
      {/* Header */}
      <div className="px-3 py-2 border-b border-slate-700 flex items-center gap-1.5">
        <MapPin size={11} className="text-emerald-400" />
        <span className="text-[10px] font-bold text-slate-300">Incident Location</span>
        <a href={googleMapsLink} target="_blank" rel="noreferrer"
          className="ml-auto text-[9px] text-indigo-400 hover:text-indigo-300 transition-colors">
          Open ↗
        </a>
      </div>

      {/* Leaflet map iframe */}
      {iframeSrc && (
        <iframe
          title="stream-location"
          src={iframeSrc}
          width="100%" height="200"
          style={{ border: 0, display: 'block' }}
          sandbox="allow-scripts allow-same-origin"
        />
      )}

      {/* Route stats */}
      <div className="px-3 py-2.5 space-y-2">
        {/* Location display with place name */}
        <div>
          <span className="text-[9px] font-mono text-emerald-400">Incident Location</span>
          <p className="text-[10px] text-slate-300 leading-tight mt-0.5 font-semibold">
            {placeName || 'Getting location...'}
          </p>
          <p className="text-[9px] text-slate-500 leading-tight mt-1 font-mono">
            {iLat.toFixed(6)}, {iLng.toFixed(6)}
          </p>
        </div>

        
        {/* Legend */}
        <div className="flex items-center gap-3 text-[9px] text-slate-500">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> Incident Location</span>
        </div>
      </div>
    </div>
  );
};

// ── Main Component ────────────────────────────────────────────────────────────

const AdminCCTV = () => {
  const user = JSON.parse(localStorage.getItem("user") || "{}");

  // Core state
  const [cameras, setCameras] = useState([]);
  const [selectedCamera, setSelectedCamera] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [stats, setStats] = useState({ total: 0, active: 0, offline: 0, viewers: 0, liveStreams: 0 });
  const [alerts, setAlerts] = useState([]);
  const [showAlerts, setShowAlerts] = useState(false);
  const [liveStreams, setLiveStreams] = useState([]);
  const [selectedStream, setSelectedStream] = useState(null);
  const [showStreamModal, setShowStreamModal] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [streamFrames, setStreamFrames] = useState({});

  // AI Detection state
  const [aiEnabled, setAiEnabled] = useState(true);
  const [aiStatus, setAiStatus] = useState('idle'); // idle | active | alert
  const [aiServiceOnline, setAiServiceOnline] = useState(false);
  const [currentDetection, setCurrentDetection] = useState(null);   // latest ai-detection payload
  const [aiEventTimeline, setAiEventTimeline] = useState([]);        // last 30 events
  const [aiAlerts, setAiAlerts] = useState([]);                      // alert-level events only
  const [showAiPanel, setShowAiPanel] = useState(true);
  const [showTimeline, setShowTimeline] = useState(true);
  const [aiFrameCounter, setAiFrameCounter] = useState(0);
  const aiAnalyzeIntervalRef = useRef(null);
  
  // Geocoding state for place names
  const [placeNames, setPlaceNames] = useState({});
  const [streamPlaceNames, setStreamPlaceNames] = useState({});

  const selectedStreamRef = useRef(null);
  const socketRef = useRef(null);
  const modalCanvasRef = useRef(null);
  const currentDetectionRef = useRef(null); // always-current bbox data for canvas draw

  // Draggable panel divider
  const [aiPanelWidth, setAiPanelWidth] = useState(288); // default 288px (lg:w-72)
  const isDraggingRef = useRef(false);
  const dragStartXRef = useRef(0);
  const dragStartWidthRef = useRef(288);
  const modalRowRef = useRef(null);

  const onDividerMouseDown = (e) => {
    e.preventDefault();
    isDraggingRef.current = true;
    dragStartXRef.current = e.clientX;
    dragStartWidthRef.current = aiPanelWidth;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  useEffect(() => {
    const onMouseMove = (e) => {
      if (!isDraggingRef.current) return;
      const delta = dragStartXRef.current - e.clientX; // drag left = wider AI panel
      const newW = Math.min(560, Math.max(200, dragStartWidthRef.current + delta));
      setAiPanelWidth(newW);
    };
    const onMouseUp = () => {
      if (!isDraggingRef.current) return;
      isDraggingRef.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, []);

  // Label colour map matching mobile overlay
  const LABEL_COLORS = {
    person:'#facc15', car:'#60a5fa', truck:'#f87171', bus:'#f97316',
    motorcycle:'#a78bfa', bicycle:'#34d399', chair:'#fb7185', table:'#38bdf8',
    bottle:'#a3e635', phone:'#e879f9', laptop:'#fbbf24', dog:'#4ade80',
    cat:'#22d3ee', accident:'#ef4444', fire:'#ef4444',
  };
  const getLabelColor = (label) => LABEL_COLORS[label?.toLowerCase()] ?? '#facc15';

  // Frame buffering for smooth rendering
  const frameBufferRef = useRef(null);
  const animationFrameRef = useRef(null);
  const lastFrameTimeRef = useRef(0);
  const frameThrottleMs = 200; // Throttle to 5 FPS max for smoother display
  const pendingFrameRef = useRef(null);
  
  // Stream card frame throttling
  const streamFrameTimesRef = useRef({});
  const streamPendingFramesRef = useRef({});

  // Draw a JPEG frame onto the modal canvas, then overlay bounding boxes
  const drawFrameOnCanvas = useCallback((base64Frame, detection) => {
    const canvas = modalCanvasRef.current;
    if (!canvas) return;
    
    const now = Date.now();
    
    // Throttle frame updates to prevent flickering
    if (now - lastFrameTimeRef.current < frameThrottleMs) {
      // Store the latest frame but don't render yet
      pendingFrameRef.current = { base64Frame, detection };
      return;
    }
    
    lastFrameTimeRef.current = now;
    
    // Cancel any pending animation frame
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    const ctx = canvas.getContext('2d');
    const img = new Image();
    
    img.onload = () => {
      // Use requestAnimationFrame for smooth rendering
      animationFrameRef.current = requestAnimationFrame(() => {
        // Set canvas dimensions only if they've changed to prevent flicker
        const newWidth = img.naturalWidth || canvas.offsetWidth || 640;
        const newHeight = img.naturalHeight || canvas.offsetHeight || 360;
        
        if (canvas.width !== newWidth || canvas.height !== newHeight) {
          canvas.width = newWidth;
          canvas.height = newHeight;
        }

        // Create off-screen canvas for double buffering
        const offscreenCanvas = document.createElement('canvas');
        offscreenCanvas.width = newWidth;
        offscreenCanvas.height = newHeight;
        const offscreenCtx = offscreenCanvas.getContext('2d');
        
        // Draw to off-screen canvas first
        offscreenCtx.fillStyle = '#000';
        offscreenCtx.fillRect(0, 0, newWidth, newHeight);
        
        // Draw image with smoothing for mobile
        offscreenCtx.imageSmoothingEnabled = true;
        offscreenCtx.imageSmoothingQuality = 'high';
        offscreenCtx.drawImage(img, 0, 0, newWidth, newHeight);

        // Draw bounding boxes
        const boxes = detection?.detections || [];
        boxes.forEach(box => {
          if (!box.w || !box.h) return;
          const x = box.x * newWidth;
          const y = box.y * newHeight;
          const w = box.w * newWidth;
          const h = box.h * newHeight;
          const color = getLabelColor(box.label);
          const label = `${(box.label || 'obj').toUpperCase()} ${Math.round((box.confidence||0)*100)}%`;

          // Box with anti-aliasing
          offscreenCtx.strokeStyle = color;
          offscreenCtx.lineWidth = 2;
          offscreenCtx.setLineDash([]);
          offscreenCtx.strokeRect(x, y, w, h);

          // Corner accents (L-shapes)
          const cs = 12;
          offscreenCtx.lineWidth = 3;
          [[x,y,1,1],[x+w,y,-1,1],[x,y+h,1,-1],[x+w,y+h,-1,-1]].forEach(([cx,cy,dx,dy]) => {
            offscreenCtx.beginPath(); offscreenCtx.moveTo(cx+dx*cs,cy); offscreenCtx.lineTo(cx,cy); offscreenCtx.lineTo(cx,cy+dy*cs); offscreenCtx.stroke();
          });

          // Label chip with background
          offscreenCtx.font = 'bold 11px monospace';
          const tw = offscreenCtx.measureText(label).width;
          offscreenCtx.fillStyle = color;
          offscreenCtx.fillRect(x, y - 18, tw + 10, 18);
          offscreenCtx.fillStyle = '#000';
          offscreenCtx.fillText(label, x + 5, y - 4);
        });

        // Subtle scan-line overlay
        offscreenCtx.fillStyle = 'rgba(0,0,0,0.02)';
        for (let i = 0; i < newHeight; i += 4) {
          offscreenCtx.fillRect(0, i, newWidth, 2);
        }
        
        // Copy from off-screen canvas to main canvas (atomic operation)
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(offscreenCanvas, 0, 0);
        
        // Schedule next frame if there's a pending one
        if (pendingFrameRef.current) {
          const pending = pendingFrameRef.current;
          pendingFrameRef.current = null;
          setTimeout(() => drawFrameOnCanvas(pending.base64Frame, pending.detection), frameThrottleMs);
        }
      });
    };
    
    img.onerror = () => {
      console.warn('Failed to load frame image');
    };
    
    img.src = `data:image/jpeg;base64,${base64Frame}`;
  }, []);

  // Smooth frame update for stream cards
  const updateStreamCard = useCallback((streamId, frameData) => {
    const now = Date.now();
    const lastTime = streamFrameTimesRef.current[streamId] || 0;
    
    // Throttle updates for each stream individually
    if (now - lastTime < frameThrottleMs) {
      // Store the latest frame for this stream
      streamPendingFramesRef.current[streamId] = frameData;
      return;
    }
    
    streamFrameTimesRef.current[streamId] = now;
    
    // Update the image element with smooth transition
    const thumbEl = document.getElementById(`video-${streamId}`);
    if (thumbEl) {
      // Add fade effect for smooth transition
      thumbEl.style.opacity = '0.8';
      thumbEl.style.transition = 'opacity 0.1s ease-in-out';
      
      setTimeout(() => {
        thumbEl.src = `data:image/jpeg;base64,${frameData}`;
        thumbEl.style.display = 'block';
        thumbEl.style.opacity = '1';
        
        const ph = document.getElementById(`placeholder-${streamId}`);
        if (ph) ph.style.display = 'none';
      }, 50);
    }
    
    // Process any pending frames for this stream
    setTimeout(() => {
      const pending = streamPendingFramesRef.current[streamId];
      if (pending) {
        streamPendingFramesRef.current[streamId] = null;
        updateStreamCard(streamId, pending);
      }
    }, frameThrottleMs);
  }, []);

  // Check AI service health on mount
  useEffect(() => {
    const checkAI = async () => {
      try {
        const res = await axios.get(`${API_URL}/ai/health`, { timeout: 3000 });
        setAiServiceOnline(res.data?.status === 'healthy');
      } catch { setAiServiceOnline(false); }
    };
    checkAI();
    const aiHealthInterval = setInterval(checkAI, 15000);
    return () => clearInterval(aiHealthInterval);
  }, []);

  useEffect(() => {
    fetchCameras();
    fetchAlerts();
    fetchLiveStreams();
    connectSocket();
    
    const interval = setInterval(() => {
      fetchCameras();
      fetchAlerts();
      fetchLiveStreams();
    }, 10000);
    
    return () => {
      clearInterval(interval);
      if (aiAnalyzeIntervalRef.current) clearInterval(aiAnalyzeIntervalRef.current);
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      if (socketRef.current) socketRef.current.disconnect();
    };
  }, []);

  const connectSocket = () => {
    try {
      // Get user token from localStorage
      const userData = JSON.parse(localStorage.getItem('user') || '{}');
      const authToken = userData?.id ? String(userData.id) : null;
      
      if (authToken) {
        console.log('🔐 Authenticating socket with user ID:', authToken);
      }
      
      const socket = io(SOCKET_URL, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 3000,
        timeout: 10000,
        auth: {
          token: authToken
        }
      });
      
      socket.on('connect', () => {
        console.log('✅ Socket.IO connected:', socket.id);
        setIsConnected(true);
        socket.emit('get-streams');
      });
      
      socket.on('connect_error', (error) => {
        console.error('❌ Socket.IO connection error:', error);
        setIsConnected(false);
      });
      
      socket.on('disconnect', (reason) => {
        console.log('🔌 Socket.IO disconnected:', reason);
        setIsConnected(false);
      });
      
      socket.on('streams-list', (streams) => {
        console.log('📡 Received streams list:', streams?.length || 0);
        setLiveStreams(streams || []);
        setStats(prev => ({ ...prev, liveStreams: streams?.length || 0 }));
      });
      
      socket.on('stream-started', (data) => {
        console.log('🎥 Stream started:', data);
        setLiveStreams(prev => [...prev, {
          streamId: data.streamId,
          cameraName: data.cameraName,
          location: data.location,
          viewerCount: 0,
          startTime: data.startTime
        }]);
        setStats(prev => ({ ...prev, liveStreams: prev.liveStreams + 1 }));
        addAlert(`🎥 New live stream started: ${data.cameraName}`);
      });
      
      socket.on('stream-ended', (data) => {
        console.log('🛑 Stream ended:', data);
        setLiveStreams(prev => prev.filter(s => s.streamId !== data.streamId));
        setStats(prev => ({ ...prev, liveStreams: prev.liveStreams - 1 }));
        if (selectedStream?.streamId === data.streamId) {
          setShowStreamModal(false);
          setSelectedStream(null);
        }
        addAlert(`🛑 Live stream ended: ${data.cameraName}`);
      });
      
      socket.on('stream-updated', (data) => {
        setLiveStreams(prev => prev.map(s => 
          s.streamId === data.streamId 
            ? { ...s, viewerCount: data.viewerCount }
            : s
        ));
      });
      
      socket.on('stream-frame', (data) => {
        if (!data.frame || data.frame.length < 100) return;
        const isValidBase64 = /^[A-Za-z0-9+/]*={0,2}$/.test(data.frame.substring(0, 100));
        if (!isValidBase64) return;

        setStreamFrames(prev => ({ ...prev, [data.streamId]: data.frame }));

        // Trigger AI analysis for watched stream (backend throttles to 1.5s)
        if (selectedStreamRef.current?.streamId === data.streamId) {
          socket.emit('ai-analyze-frame', { streamId: data.streamId, frame: data.frame });
        }

        // Update thumbnail card with smooth rendering
        updateStreamCard(data.streamId, data.frame);

        // Draw frame + bounding boxes on modal canvas
        if (selectedStreamRef.current?.streamId === data.streamId) {
          drawFrameOnCanvas(data.frame, currentDetectionRef.current);
        }
      });
      
      // ── AI Detection Events ──────────────────────────────────
      socket.on('ai-detection', (data) => {
        if (!aiEnabled) return;
        currentDetectionRef.current = data; // keep ref in sync for canvas draw
        setCurrentDetection(data);
        setAiFrameCounter(c => c + 1);
        setAiStatus(data.isAlert ? 'alert' : 'active');
        setAiEventTimeline(prev => [data, ...prev].slice(0, 30));
      });

      socket.on('ai-alert', (data) => {
        setAiAlerts(prev => [data, ...prev].slice(0, 10));
        setAiStatus('alert');
        // Auto-clear alert badge after 8s
        setTimeout(() => setAiStatus(prev => prev === 'alert' ? 'active' : prev), 8000);
      });

      socketRef.current = socket;
    } catch (error) {
      console.error('Socket.IO connection error:', error);
    }
  };

  // Send frame to backend for AI analysis (throttled by backend)
  const triggerAIAnalysis = useCallback((streamId, frame) => {
    if (!aiEnabled || !socketRef.current?.connected || !frame) return;
    socketRef.current.emit('ai-analyze-frame', { streamId, frame });
  }, [aiEnabled]);

  // Start periodic AI analysis when stream modal opens
  const startAIAnalysis = useCallback((streamId) => {
    if (aiAnalyzeIntervalRef.current) clearInterval(aiAnalyzeIntervalRef.current);
    setAiStatus('active');
    aiAnalyzeIntervalRef.current = setInterval(() => {
      const frame = streamId ? document.getElementById('modal-video')?.src : null;
      // Prefer raw base64 from streamFrames state
    }, 2000);
  }, []);

  const stopAIAnalysis = useCallback(() => {
    if (aiAnalyzeIntervalRef.current) clearInterval(aiAnalyzeIntervalRef.current);
    setAiStatus('idle');
  }, []);

  const exportAIEvents = () => {
    const blob = new Blob([JSON.stringify(aiEventTimeline, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `ai-events-${Date.now()}.json`; a.click();
    URL.revokeObjectURL(url);
  };

  
  const saveVideoClip = async () => {
    if (!selectedStream || !streamFrames[selectedStream.streamId]) {
      addAlert('No video frame available to save');
      return;
    }

    try {
      // Get the current frame from the stream
      const currentFrame = streamFrames[selectedStream.streamId];
      
      // Create a canvas to capture the current video frame
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();
      
      img.onload = () => {
        // Set canvas dimensions to match the video
        canvas.width = img.naturalWidth || 640;
        canvas.height = img.naturalHeight || 360;
        
        // Draw the current frame
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        // Add timestamp and stream info overlay
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(0, canvas.height - 60, canvas.width, 60);
        
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 14px Arial';
        ctx.fillText(`Camera: ${selectedStream.cameraName || 'Unknown'}`, 10, canvas.height - 35);
        
        ctx.font = '12px Arial';
        ctx.fillText(`Stream ID: ${selectedStream.streamId}`, 10, canvas.height - 20);
        ctx.fillText(`Location: ${streamPlaceNames[selectedStream.streamId] || selectedStream.location || 'Unknown'}`, 10, canvas.height - 5);
        
        ctx.font = '10px Arial';
        ctx.fillText(`Time: ${new Date().toLocaleString()}`, canvas.width - 200, canvas.height - 5);
        
        // Convert canvas to blob and download
        canvas.toBlob((blob) => {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `cctv-clip-${selectedStream.cameraName || 'unknown'}-${Date.now()}.jpg`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          
          addAlert(`Video clip saved: ${selectedStream.cameraName || 'Unknown Camera'}`);
        }, 'image/jpeg', 0.9);
      };
      
      img.src = `data:image/jpeg;base64,${currentFrame}`;
      
    } catch (error) {
      console.error('Error saving video clip:', error);
      addAlert('Failed to save video clip');
    }
  };

  const addAlert = (message) => {
    const newAlert = {
      id: Date.now(),
      message,
      time: new Date().toISOString(),
      read: false
    };
    setAlerts(prev => [newAlert, ...prev].slice(0, 20));
  };

  const fetchCameras = async () => {
    try {
      const response = await axios.get(`${API_URL}/cctv/cameras`);
      const data = response.data;
      setCameras(Array.isArray(data) ? data : []);
      
      const activeCount = data.filter(c => c.status === 'active').length;
      const offlineCount = data.filter(c => c.status === 'inactive' || c.status === 'maintenance').length;
      
      setStats(prev => ({
        ...prev,
        total: data.length,
        active: activeCount,
        offline: offlineCount,
        viewers: data.reduce((sum, c) => sum + (c.viewers || 0), 0)
      }));
    } catch (error) {
      console.error('Error fetching cameras:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchAlerts = async () => {
    try {
      const response = await axios.get(`${API_URL}/cctv/alerts`);
      const data = response.data;
      setAlerts(Array.isArray(data) ? data.slice(0, 10) : []);
    } catch (error) {
      console.error('Error fetching alerts:', error);
    }
  };

  const fetchLiveStreams = async () => {
    try {
      const response = await axios.get(`${API_URL}/streams`);
      const data = response.data;
      setLiveStreams(Array.isArray(data) ? data : []);
      setStats(prev => ({ ...prev, liveStreams: data.length }));
    } catch (error) {
      console.error('Error fetching live streams:', error);
    }
  };

  const updateCameraStatus = async (cameraId, status) => {
    try {
      await axios.put(`${API_URL}/cctv/cameras/${cameraId}/status`, { status });
      fetchCameras();
      addAlert(`Camera ${cameraId} status changed to ${status}`);
    } catch (error) {
      console.error('Error updating camera:', error);
    }
  };

  const startRecording = async (cameraId) => {
    try {
      await axios.post(`${API_URL}/cctv/cameras/${cameraId}/record`);
      addAlert(`Started recording on camera ${cameraId}`);
      fetchCameras();
    } catch (error) {
      console.error('Error starting recording:', error);
    }
  };

  const markAlertRead = async (alertId) => {
    try {
      await axios.put(`${API_URL}/cctv/alerts/${alertId}/view`);
      fetchAlerts();
    } catch (error) {
      console.error('Error marking alert:', error);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchCameras();
    fetchAlerts();
    fetchLiveStreams();
  };

  const watchLiveStream = (stream) => {
    setSelectedStream(stream);
    selectedStreamRef.current = stream;
    setShowStreamModal(true);
    setCurrentDetection(null);
    setAiStatus(aiEnabled ? 'active' : 'idle');

    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('join-stream', stream.streamId);
    }

    // Fetch place name for this stream if not already cached
    if (stream.location && !streamPlaceNames[stream.streamId]) {
      getPlaceName(stream.location, setPlaceNames).then(placeName => {
        setStreamPlaceNames(prev => ({ ...prev, [stream.streamId]: placeName }));
      });
    }

    const existingFrame = streamFrames[stream.streamId];
    if (existingFrame) {
      setTimeout(() => {
        const modalVideo = document.getElementById('modal-video');
        const modalPlaceholder = document.getElementById('modal-placeholder');
        if (modalVideo) { modalVideo.src = `data:image/jpeg;base64,${existingFrame}`; modalVideo.style.display = 'block'; }
        if (modalPlaceholder) modalPlaceholder.style.display = 'none';
        // Immediately kick off first AI analysis on existing frame
        if (aiEnabled) socketRef.current?.emit('ai-analyze-frame', { streamId: stream.streamId, frame: existingFrame });
      }, 200);
    }
  };

  const closeStreamModal = () => {
    if (selectedStreamRef.current && socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('leave-stream', selectedStreamRef.current.streamId);
    }
    stopAIAnalysis();
    setShowStreamModal(false);
    setSelectedStream(null);
    selectedStreamRef.current = null;
    setCurrentDetection(null);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return 'bg-emerald-500';
      case 'maintenance': return 'bg-amber-500';
      default: return 'bg-red-500';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'active': return 'ACTIVE';
      case 'maintenance': return 'MAINTENANCE';
      default: return 'OFFLINE';
    }
  };

  const formatTime = (dateString) => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    const now = new Date();
    const diff = Math.floor((now - date) / 1000 / 60);
    if (diff < 60) return `${diff} min ago`;
    if (diff < 1440) return `${Math.floor(diff / 60)} hours ago`;
    return `${Math.floor(diff / 1440)} days ago`;
  };

  if (loading) {
    return (
      <div className="flex h-screen bg-slate-900">
        <AdminSidebar user={user} />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="relative w-16 h-16 mx-auto mb-5">
              <div className="w-16 h-16 border-4 border-yellow-500/30 rounded-full"></div>
              <div className="absolute inset-0 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin"></div>
              <Cpu className="absolute inset-0 m-auto w-6 h-6 text-yellow-400" />
            </div>
            <p className="text-white font-semibold text-lg">AI Engine Initializing</p>
            <p className="text-slate-400 text-sm mt-1">Loading CCTV feeds…</p>
          </div>
        </div>
      </div>
    );
  }

  const unreadAlerts = alerts.filter(a => !a.is_viewed).length;
  const activeLiveStreams = liveStreams.length;
  const aiStatusColor = aiStatus === 'alert' ? 'text-red-400 border-red-500/50 bg-red-500/10'
    : aiStatus === 'active' ? 'text-yellow-400 border-yellow-500/50 bg-yellow-500/10'
    : 'text-slate-400 border-slate-600 bg-slate-800';

  return (
    <div className="flex h-screen bg-slate-900 text-white overflow-hidden">
      <AdminSidebar user={user} />

      <div className="flex-1 flex flex-col overflow-hidden">

        {/* ── Top Header ─────────────────────────────────────────────── */}
        <header className="h-14 bg-slate-900/95 border-b border-slate-700/60 px-5 flex items-center justify-between flex-shrink-0 backdrop-blur">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center shadow">
              <Camera size={15} className="text-black" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-white leading-none">CCTV Surveillance</h1>
              <p className="text-[10px] text-slate-400 mt-0.5">Live monitoring & AI incident detection</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* AI Engine Status */}
            <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full border text-[11px] font-bold transition-all ${aiStatusColor}`}>
              <Cpu size={11} />
              {aiStatus === 'alert' ? 'AI ALERT' : aiStatus === 'active' ? 'AI ACTIVE' : 'AI IDLE'}
              {aiStatus === 'active' && <span className="w-1.5 h-1.5 bg-yellow-400 rounded-full animate-pulse ml-0.5" />}
              {aiStatus === 'alert' && <span className="w-1.5 h-1.5 bg-red-400 rounded-full animate-ping ml-0.5" />}
            </div>

            {/* AI service health */}
            <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-semibold ${aiServiceOnline ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${aiServiceOnline ? 'bg-emerald-400' : 'bg-red-400'}`} />
              {aiServiceOnline ? 'AI Service' : 'AI Offline'}
            </div>

            {/* AI toggle */}
            <button
              onClick={() => { setAiEnabled(e => !e); setAiStatus(aiEnabled ? 'idle' : 'active'); }}
              className={`px-3 py-1 rounded-full text-[11px] font-bold border transition-all ${aiEnabled ? 'bg-yellow-500/20 border-yellow-500/50 text-yellow-400 hover:bg-yellow-500/30' : 'bg-slate-700 border-slate-600 text-slate-400 hover:bg-slate-600'}`}
            >
              {aiEnabled ? 'Disable AI' : 'Enable AI'}
            </button>

            {!isConnected && (
              <div className="flex items-center gap-1.5 px-2 py-1 bg-amber-500/20 border border-amber-500/40 rounded-full text-[10px] font-semibold text-amber-400">
                <WifiOff size={10} /> Reconnecting
              </div>
            )}
            {activeLiveStreams > 0 && (
              <div className="flex items-center gap-1.5 px-2 py-1 bg-red-500/20 border border-red-500/40 rounded-full text-[10px] font-semibold text-red-400">
                <span className="w-1.5 h-1.5 bg-red-400 rounded-full animate-pulse" />
                {activeLiveStreams} LIVE
              </div>
            )}
            <button onClick={handleRefresh} className="p-2 hover:bg-slate-700 rounded-xl transition-all">
              <RefreshCw size={15} className={`text-slate-400 ${refreshing ? 'animate-spin text-yellow-400' : ''}`} />
            </button>
            <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-sky-400 rounded-xl flex items-center justify-center font-bold text-sm shadow">
              {user?.fullName?.charAt(0)?.toUpperCase() || 'A'}
            </div>
          </div>
        </header>

        {/* ── Stat Bar ───────────────────────────────────────────────── */}
        <div className="flex items-center gap-0 border-b border-slate-700/60 flex-shrink-0 bg-slate-800/60">
          {[
            { label: 'Cameras', value: stats.total, icon: Camera, color: 'text-slate-300' },
            { label: 'Active', value: stats.active, icon: Activity, color: 'text-emerald-400' },
            { label: 'Live', value: stats.liveStreams, icon: Radio, color: 'text-red-400' },
            { label: 'Offline', value: stats.offline, icon: WifiOff, color: 'text-slate-500' },
            { label: 'AI Events', value: aiEventTimeline.length, icon: Zap, color: 'text-yellow-400' },
            { label: 'AI Alerts', value: aiAlerts.length, icon: AlertTriangle, color: 'text-red-400' },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="flex-1 flex items-center gap-2 px-4 py-2.5 border-r border-slate-700/60 last:border-r-0">
              <Icon size={14} className={color} />
              <div>
                <p className={`text-base font-bold leading-none ${color}`}>{value}</p>
                <p className="text-[10px] text-slate-500 font-medium mt-0.5">{label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* ── Main Content ───────────────────────────────────────────── */}
        <div className="flex-1 flex overflow-hidden">

          {/* Left: Camera Grid + Live Streams */}
          <main className="flex-1 overflow-auto p-5 space-y-5">

            {/* Live Broadcasts */}
            {activeLiveStreams > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <Radio size={15} className="text-red-400" />
                  <h2 className="text-sm font-bold text-white">Live Broadcasts</h2>
                  <span className="bg-red-500/20 text-red-400 border border-red-500/30 text-[10px] font-bold px-2 py-0.5 rounded-full">{activeLiveStreams} ACTIVE</span>
                  {aiEnabled && (
                    <span className="bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                      <Cpu size={9} /> AI ANALYZING
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {liveStreams.map((stream) => (
                    <div key={stream.streamId} onClick={() => watchLiveStream(stream)}
                      className="group relative bg-slate-800 rounded-2xl border border-red-500/50 overflow-hidden shadow-lg hover:shadow-red-500/20 hover:shadow-xl transition-all cursor-pointer hover:-translate-y-0.5">
                      <div className="relative aspect-video bg-slate-900 overflow-hidden">
                        <img id={`video-${stream.streamId}`} className="w-full h-full object-cover absolute inset-0"
                          style={{ 
                            display: streamFrames[stream.streamId] ? 'block' : 'none',
                            transition: 'opacity 0.1s ease-in-out',
                            opacity: 1,
                            imageRendering: 'auto',
                            transform: 'translateZ(0)' // Hardware acceleration
                          }} alt="Live" />
                        <div id={`placeholder-${stream.streamId}`} className="absolute inset-0 flex flex-col items-center justify-center"
                          style={{ display: streamFrames[stream.streamId] ? 'none' : 'flex' }}>
                          <Radio className="w-10 h-10 text-red-500 mb-2 animate-pulse" />
                          <p className="text-slate-400 text-xs">Waiting for stream...</p>
                        </div>
                        <div className="absolute top-2 left-2 flex items-center gap-1.5 bg-black/70 px-2 py-0.5 rounded-full">
                          <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
                          <span className="text-white text-[10px] font-bold">LIVE</span>
                        </div>
                        {aiEnabled && (
                          <div className="absolute top-2 right-2 flex items-center gap-1 bg-yellow-500/20 border border-yellow-500/40 px-1.5 py-0.5 rounded-full">
                            <Cpu size={9} className="text-yellow-400" />
                            <span className="text-yellow-400 text-[9px] font-bold">AI</span>
                          </div>
                        )}
                        <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent p-3">
                          <p className="text-white text-xs font-semibold">{stream.cameraName}</p>
                          <p className="text-slate-400 text-[10px] flex items-center gap-1"><MapPin size={8} />{streamPlaceNames[stream.streamId] || stream.location}</p>
                        </div>
                      </div>
                      <div className="px-3 py-2 flex items-center justify-between">
                        <p className="text-slate-400 text-[10px]">Started {formatTime(stream.startTime)}</p>
                        <div className="flex items-center gap-1 text-slate-400 text-[10px]"><Eye size={10} /> {stream.viewerCount || 0}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Camera Grid */}
            <section>
              <div className="flex items-center gap-2 mb-3">
                <Camera size={15} className="text-slate-400" />
                <h2 className="text-sm font-bold text-white">Camera Network</h2>
                <span className="text-[10px] text-slate-500">{cameras.length} cameras</span>
              </div>
              {cameras.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-slate-600">
                  <Camera size={40} className="mb-3 opacity-30" />
                  <p className="font-medium">No cameras configured</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {cameras.map((camera) => (
                    <div key={camera.id} onClick={() => { setSelectedCamera(camera); setShowModal(true); }}
                      className={`group relative bg-slate-800 rounded-2xl overflow-hidden border transition-all cursor-pointer hover:-translate-y-0.5 hover:shadow-lg ${
                        camera.status === 'active' ? 'border-emerald-500/50 hover:shadow-emerald-500/10' : 'border-slate-700/60'}`}>
                      <div className="relative aspect-video bg-slate-950 overflow-hidden">
                        <div className="absolute inset-0 bg-[radial-gradient(#333_0.8px,transparent_1px)] bg-[length:3px_3px] opacity-50" />
                        {camera.status === 'active' ? (
                          <>
                            <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-black/70 text-white text-[10px] px-2 py-0.5 rounded-full font-bold">
                              <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" /> ACTIVE
                            </div>
                            <div className="absolute inset-0 flex flex-col items-center justify-center text-white/40 group-hover:text-white/70 transition-colors">
                              <Play size={36} className="mb-1" />
                              <p className="text-[10px] tracking-widest">FEED</p>
                            </div>
                            {aiEnabled && (
                              <div className="absolute top-3 right-10 flex items-center gap-1 bg-yellow-500/20 border border-yellow-500/30 px-1.5 py-0.5 rounded-full">
                                <Cpu size={9} className="text-yellow-400" />
                              </div>
                            )}
                          </>
                        ) : (
                          <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-600">
                            <Camera size={28} className="mb-2 opacity-40" />
                            <p className="text-xs font-medium">OFFLINE</p>
                          </div>
                        )}
                        <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/90 to-transparent p-3">
                          <p className="text-white text-xs font-semibold">{camera.camera_name}</p>
                          <p className="text-emerald-400 text-[10px] flex items-center gap-1"><MapPin size={8} />{camera.location_name || 'Unknown'}</p>
                        </div>
                        <div className="absolute top-3 right-3 bg-black/70 text-white text-[9px] px-1.5 py-0.5 rounded font-mono">{camera.resolution || '1080p'}</div>
                      </div>
                      <div className="p-3 flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <div className={`w-1.5 h-1.5 rounded-full ${getStatusColor(camera.status)}`} />
                          <p className={`text-[10px] font-semibold ${camera.status === 'active' ? 'text-emerald-400' : camera.status === 'maintenance' ? 'text-amber-400' : 'text-red-400'}`}>
                            {getStatusText(camera.status)}
                          </p>
                        </div>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {camera.status === 'active' && (
                            <button className="p-1.5 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors" onClick={(e) => { e.stopPropagation(); startRecording(camera.id); }}>
                              <Circle size={12} />
                            </button>
                          )}
                          <button className="p-1.5 hover:bg-slate-700 text-slate-400 rounded-lg transition-colors"><Maximize2 size={12} /></button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </main>

          {/* ── Right Panel: AI Monitoring + Timeline ─────────────────── */}
          <aside className="w-80 flex-shrink-0 bg-slate-800/80 border-l border-slate-700/60 flex flex-col overflow-hidden">

            {/* AI Monitoring Panel */}
            <div className="border-b border-slate-700/60 flex-shrink-0">
              <button onClick={() => setShowAiPanel(p => !p)}
                className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-700/40 transition-colors">
                <div className="flex items-center gap-2">
                  <Crosshair size={14} className="text-yellow-400" />
                  <span className="text-xs font-bold text-white">AI Monitoring Panel</span>
                  {aiStatus !== 'idle' && (
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${aiStatus === 'alert' ? 'bg-red-500/30 text-red-300' : 'bg-yellow-500/20 text-yellow-400'}`}>
                      {aiStatus.toUpperCase()}
                    </span>
                  )}
                </div>
                {showAiPanel ? <ChevronUp size={13} className="text-slate-400" /> : <ChevronDown size={13} className="text-slate-400" />}
              </button>

              {showAiPanel && (
                <div className="px-4 pb-4 space-y-3">
                  {!currentDetection ? (
                    <div className="flex flex-col items-center py-6 text-slate-600">
                      <Cpu size={28} className="mb-2 opacity-40" />
                      <p className="text-xs font-medium">Open a live stream to</p>
                      <p className="text-xs">activate AI analysis</p>
                    </div>
                  ) : (
                    <>
                      {/* Decision card */}
                      <div className={`rounded-xl p-3 border ${
                        currentDetection.isAlert
                          ? 'bg-red-500/10 border-red-500/40'
                          : currentDetection.accidentConfidence >= 45
                          ? 'bg-yellow-500/10 border-yellow-500/40'
                          : 'bg-slate-700/60 border-slate-600/40'
                      }`}>
                        <div className="flex items-start justify-between mb-2">
                          <p className={`text-xs font-bold leading-tight ${currentDetection.isAlert ? 'text-red-300' : currentDetection.accidentConfidence >= 45 ? 'text-yellow-300' : 'text-emerald-300'}`}>
                            {currentDetection.decision}
                          </p>
                          <SeverityBadge severity={currentDetection.severity} />
                        </div>
                        <ConfidenceBar value={currentDetection.accidentConfidence} />
                        <p className="text-[10px] text-slate-400 mt-2 leading-tight">{currentDetection.responseAction}</p>
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-[9px] text-slate-500 font-mono">{currentDetection.aiEngine}</span>
                          <span className="text-[9px] text-slate-500">{currentDetection.processingTimeMs}ms</span>
                        </div>
                      </div>

                      {/* Tracked objects */}
                      {currentDetection.trackedObjects?.length > 0 && (
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                            <BarChart2 size={10} /> Tracked Objects ({currentDetection.trackedObjects.length})
                          </p>
                          <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1 scrollbar-thin">
                            {currentDetection.trackedObjects.map((obj) => (
                              <div key={obj.id} className="flex items-center gap-2 bg-slate-700/50 rounded-lg px-2.5 py-1.5 border border-slate-600/40">
                                <span className="text-[9px] font-mono text-yellow-400 w-7 flex-shrink-0">{obj.id}</span>
                                <span className="text-[11px] font-semibold text-white flex-1 capitalize">{obj.label}</span>
                                <span className="text-[10px] text-slate-400">{obj.direction}</span>
                                <span className="text-[10px] font-mono text-slate-300">{obj.confidence}%</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Stats row */}
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { label: 'Frames', value: currentDetection.framesAnalyzed },
                          { label: 'Objects', value: currentDetection.rawDetections },
                          { label: 'Analyzed', value: aiFrameCounter },
                        ].map(({ label, value }) => (
                          <div key={label} className="bg-slate-700/50 rounded-lg px-2 py-1.5 text-center border border-slate-600/40">
                            <p className="text-sm font-bold text-white">{value}</p>
                            <p className="text-[9px] text-slate-500">{label}</p>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Smart Event Timeline */}
            <div className="flex-1 flex flex-col overflow-hidden">
              <button onClick={() => setShowTimeline(p => !p)}
                className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-700/40 transition-colors flex-shrink-0">
                <div className="flex items-center gap-2">
                  <Clock size={14} className="text-indigo-400" />
                  <span className="text-xs font-bold text-white">Event Timeline</span>
                  <span className="bg-slate-700 text-slate-300 text-[9px] font-bold px-1.5 py-0.5 rounded-full">{aiEventTimeline.length}</span>
                </div>
                <div className="flex items-center gap-2">
                  {aiEventTimeline.length > 0 && (
                    <button onClick={(e) => { e.stopPropagation(); exportAIEvents(); }}
                      className="p-1 hover:bg-slate-600 rounded-lg text-slate-400 hover:text-white transition-colors">
                      <Download size={11} />
                    </button>
                  )}
                  {showTimeline ? <ChevronUp size={13} className="text-slate-400" /> : <ChevronDown size={13} className="text-slate-400" />}
                </div>
              </button>

              {showTimeline && (
                <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-2">
                  {aiEventTimeline.length === 0 ? (
                    <div className="flex flex-col items-center py-8 text-slate-600">
                      <TrendingUp size={24} className="mb-2 opacity-30" />
                      <p className="text-xs">No AI events yet</p>
                    </div>
                  ) : (
                    aiEventTimeline.map((event, i) => (
                      <div key={i} className={`rounded-xl p-2.5 border transition-all ${
                        event.isAlert
                          ? 'bg-red-500/10 border-red-500/30'
                          : event.accidentConfidence >= 45
                          ? 'bg-yellow-500/10 border-yellow-500/20'
                          : 'bg-slate-700/40 border-slate-600/30'
                      }`}>
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <p className={`text-[11px] font-semibold leading-tight flex-1 ${event.isAlert ? 'text-red-300' : event.accidentConfidence >= 45 ? 'text-yellow-300' : 'text-slate-300'}`}>
                            {event.decision}
                          </p>
                          {event.isAlert && <AlertCircle size={12} className="text-red-400 flex-shrink-0 mt-0.5" />}
                          {!event.isAlert && event.accidentConfidence >= 45 && <AlertTriangle size={12} className="text-yellow-400 flex-shrink-0 mt-0.5" />}
                          {event.accidentConfidence < 45 && <CheckCircle size={12} className="text-emerald-500 flex-shrink-0 mt-0.5" />}
                        </div>
                        <ConfidenceBar value={event.accidentConfidence} />
                        <div className="flex items-center justify-between mt-1.5">
                          <span className="text-[9px] text-slate-500 font-mono">
                            {new Date(event.timestamp).toLocaleTimeString()}
                          </span>
                          <SeverityBadge severity={event.severity} />
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>

      {/* ── AI-Enhanced Live Stream Modal ─────────────────────────────── */}
      {showStreamModal && selectedStream && (
        <div className="fixed inset-0 bg-black/95 flex z-50" onClick={closeStreamModal}>
          <div
            ref={modalRowRef}
            className="flex flex-row flex-1 m-4 max-h-full overflow-hidden"
            style={{ gap: 0 }}
            onClick={(e) => e.stopPropagation()}
          >

            {/* Video Area — fills remaining space */}
            <div className="flex flex-col bg-slate-900 rounded-l-2xl overflow-hidden border border-slate-700 min-w-0" style={{ flex: 1 }}>
              {/* Modal Header */}
              <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between flex-shrink-0 bg-slate-800/80">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                    <span className="text-white font-bold text-sm">LIVE:</span>
                    <span className="text-red-300 font-semibold text-sm">{selectedStream.cameraName}</span>
                  </div>
                  <span className="text-slate-400 text-xs flex items-center gap-1"><MapPin size={10} />{streamPlaceNames[selectedStream?.streamId] || selectedStream?.location || 'Unknown'}</span>
                </div>
                <div className="flex items-center gap-2">
                  {aiEnabled && (
                    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-bold ${aiStatusColor}`}>
                      <Cpu size={10} />
                      {aiStatus === 'alert' ? '⚠ AI ALERT' : 'AI ACTIVE'}
                    </div>
                  )}
                  <button onClick={closeStreamModal} className="p-1.5 hover:bg-slate-700 rounded-xl text-slate-400 hover:text-white transition-colors">
                    <X size={16} />
                  </button>
                </div>
              </div>

              {/* Video Feed — canvas renders frames + AI bbox overlay smoothly */}
              <div className="relative flex-1 bg-black overflow-hidden" style={{ minHeight: 0 }}>
                {/* Canvas: frames painted here, bboxes drawn on top */}
                <canvas
                  ref={modalCanvasRef}
                  className="w-full h-full object-contain"
                  style={{ 
                    display: streamFrames[selectedStream.streamId] ? 'block' : 'none', 
                    imageRendering: 'auto',
                    imageRendering: '-webkit-optimize-contrast',
                    imageRendering: 'crisp-edges',
                    transform: 'translateZ(0)', // Hardware acceleration
                    willChange: 'transform' // Optimize for animations
                  }}
                />

                {/* Placeholder until first frame arrives */}
                {!streamFrames[selectedStream.streamId] && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center">
                      <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-3 animate-pulse">
                        <Radio size={28} className="text-red-500" />
                      </div>
                      <p className="text-white font-semibold">Connecting to stream...</p>
                      <p className="text-slate-400 text-sm mt-1">Waiting for video feed</p>
                    </div>
                  </div>
                )}

                {/* Detected objects legend (top-left chip row) */}
                {aiEnabled && currentDetection?.detections?.length > 0 && (
                  <div className="absolute top-3 left-3 flex flex-wrap gap-1.5 max-w-[60%]">
                    {[...new Set(currentDetection.detections.map(d => d.label))].slice(0,6).map(label => (
                      <span key={label}
                        className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                        style={{ backgroundColor: getLabelColor(label), color: '#000' }}>
                        {label}
                      </span>
                    ))}
                  </div>
                )}

                {/* AI Alert Overlay Banner */}
                {aiStatus === 'alert' && currentDetection?.isAlert && (
                  <div className="absolute top-3 right-3 left-auto bg-red-600/90 backdrop-blur border border-red-400/60 rounded-xl px-4 py-2 flex items-center gap-2">
                    <AlertCircle size={14} className="text-white flex-shrink-0 animate-pulse" />
                    <div className="min-w-0">
                      <p className="text-white font-bold text-xs truncate">{currentDetection.decision}</p>
                      <p className="text-red-200 text-[10px]">{currentDetection.accidentConfidence}% confidence</p>
                    </div>
                  </div>
                )}

                {/* AI Analyzing pill (non-alert) */}
                {aiEnabled && aiStatus === 'active' && !currentDetection?.isAlert && (
                  <div className="absolute bottom-3 left-3 flex items-center gap-2 bg-yellow-500/20 backdrop-blur border border-yellow-500/40 px-3 py-1.5 rounded-full">
                    <Cpu size={12} className="text-yellow-400" />
                    <span className="text-yellow-300 text-[11px] font-bold">AI Analyzing</span>
                    <span className="w-1.5 h-1.5 bg-yellow-400 rounded-full animate-pulse" />
                  </div>
                )}
              </div>

              {/* Action Bar */}
              <div className="px-4 py-3 border-t border-slate-700 flex gap-2 flex-shrink-0 bg-slate-800/80">
                <button className="flex-1 py-2 bg-red-500/20 border border-red-500/40 text-red-300 rounded-xl text-xs font-bold hover:bg-red-500/30 transition-colors flex items-center justify-center gap-1.5">
                  <AlertTriangle size={13} /> Report Incident
                </button>
                <button onClick={saveVideoClip} className="flex-1 py-2 bg-slate-700 border border-slate-600 text-slate-300 rounded-xl text-xs font-bold hover:bg-slate-600 transition-colors flex items-center justify-center gap-1.5">
                  <Download size={13} /> Save Clip
                </button>
                <button onClick={closeStreamModal} className="flex-1 py-2 bg-slate-700 border border-slate-600 text-slate-300 rounded-xl text-xs font-bold hover:bg-slate-600 transition-colors">
                  Close
                </button>
              </div>
            </div>

            {/* ── Drag Divider ── */}
            {aiEnabled && (
              <div
                onMouseDown={onDividerMouseDown}
                className="flex-shrink-0 flex items-center justify-center bg-slate-800 border-y border-slate-700 hover:bg-indigo-500/20 transition-colors group"
                style={{ width: 6, cursor: 'col-resize', zIndex: 10 }}
                title="Drag to resize panels"
              >
                <div className="w-0.5 h-8 rounded-full bg-slate-600 group-hover:bg-indigo-400 transition-colors" />
              </div>
            )}

            {/* AI Side Panel in Modal */}
            {aiEnabled && (
              <div
                className="flex-shrink-0 bg-slate-900 rounded-r-2xl border border-slate-700 flex flex-col overflow-hidden"
                style={{ width: aiPanelWidth }}
              >
                <div className="px-4 py-3 border-b border-slate-700 bg-slate-800/60 flex-shrink-0">
                  <div className="flex items-center gap-2">
                    <Cpu size={14} className="text-yellow-400" />
                    <span className="text-xs font-bold text-white">AI Intelligence</span>
                    <span className={`ml-auto text-[9px] font-bold px-2 py-0.5 rounded-full border ${aiStatusColor}`}>
                      {aiStatus.toUpperCase()}
                    </span>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-3 space-y-3">
                  {/* GPS Map — always shown when stream is open */}
                  <StreamLocationMap locationStr={selectedStream.location} />

                  {/* Current Decision */}
                  {currentDetection ? (
                    <>
                      <div className={`rounded-xl p-3 border ${currentDetection.isAlert ? 'bg-red-500/15 border-red-500/50' : currentDetection.accidentConfidence >= 45 ? 'bg-yellow-500/10 border-yellow-500/40' : 'bg-slate-800 border-slate-700'}`}>
                        {/* Category badge */}
                        {currentDetection.incidentCategory && currentDetection.incidentCategory !== 'None' && (
                          <div className="mb-2">
                            <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${
                              currentDetection.incidentCategory === 'Unknown'
                                ? 'bg-blue-500/20 border-blue-500/40 text-blue-300'
                                : currentDetection.isAlert
                                ? 'bg-red-500/20 border-red-500/40 text-red-300'
                                : 'bg-yellow-500/20 border-yellow-500/40 text-yellow-300'
                            }`}>
                              {currentDetection.incidentCategory}
                            </span>
                          </div>
                        )}
                        <p className="text-[10px] text-slate-400 uppercase font-bold mb-1">AI Decision</p>
                        <p className={`text-sm font-bold mb-2 ${currentDetection.isAlert ? 'text-red-300' : currentDetection.accidentConfidence >= 45 ? 'text-yellow-300' : 'text-emerald-300'}`}>
                          {currentDetection.decision}
                        </p>
                        <ConfidenceBar value={currentDetection.accidentConfidence} />
                        <div className="mt-2 flex items-center justify-between">
                          <SeverityBadge severity={currentDetection.severity} />
                          <span className="text-[9px] text-slate-500">{currentDetection.framesAnalyzed} frames</span>
                        </div>
                      </div>

                      {/* Response Action */}
                      <div className="bg-slate-800 rounded-xl p-3 border border-slate-700">
                        <p className="text-[10px] text-slate-400 uppercase font-bold mb-1 flex items-center gap-1">
                          <Shield size={9} /> Suggested Action
                        </p>
                        <p className="text-xs text-white font-medium">{currentDetection.responseAction}</p>
                      </div>

                      {/* Tracked Objects */}
                      {currentDetection.trackedObjects?.length > 0 && (
                        <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
                          <div className="px-3 py-2 border-b border-slate-700 flex items-center gap-1.5">
                            <Crosshair size={11} className="text-yellow-400" />
                            <span className="text-[10px] font-bold text-slate-300">Tracked Objects</span>
                            <span className="ml-auto text-[9px] text-slate-500">{currentDetection.trackedObjects.length}</span>
                          </div>
                          <div className="divide-y divide-slate-700/60 max-h-52 overflow-y-auto">
                            {currentDetection.trackedObjects.map((obj) => (
                              <div key={obj.id} className="px-3 py-2 flex items-center gap-2">
                                <span className="text-[9px] font-mono text-yellow-400 w-6">{obj.id}</span>
                                <span className="text-xs font-semibold text-white flex-1 capitalize">{obj.label}</span>
                                <span className="text-[10px] text-slate-400">{obj.direction}</span>
                                <span className="text-[10px] font-mono text-slate-300">{obj.confidence}%</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="flex flex-col items-center py-10 text-slate-600">
                      <div className="w-12 h-12 border-2 border-yellow-500/30 rounded-full flex items-center justify-center mb-3 animate-pulse">
                        <Cpu size={20} className="text-yellow-400/50" />
                      </div>
                      <p className="text-xs font-medium">Waiting for first frame...</p>
                      <p className="text-[10px] mt-1">AI will activate automatically</p>
                    </div>
                  )}

                  {/* Mini Timeline */}
                  {aiEventTimeline.length > 0 && (
                    <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
                      <div className="px-3 py-2 border-b border-slate-700 flex items-center gap-1.5">
                        <Clock size={11} className="text-indigo-400" />
                        <span className="text-[10px] font-bold text-slate-300">Recent Events</span>
                      </div>
                      <div className="divide-y divide-slate-700/40 max-h-40 overflow-y-auto">
                        {aiEventTimeline.slice(0, 6).map((ev, i) => (
                          <div key={i} className="px-3 py-2">
                            <div className="flex items-center gap-2">
                              {ev.isAlert
                                ? <AlertCircle size={10} className="text-red-400 flex-shrink-0" />
                                : <CheckCircle size={10} className="text-emerald-500 flex-shrink-0" />}
                              <p className={`text-[10px] font-medium flex-1 truncate ${ev.isAlert ? 'text-red-300' : 'text-slate-300'}`}>
                                {ev.decision}
                              </p>
                              <span className="text-[9px] text-slate-500 font-mono flex-shrink-0">
                                {new Date(ev.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Camera Detail Modal ────────────────────────────────────────── */}
      {showModal && selectedCamera && (
        <div className="fixed inset-0 bg-black/85 flex items-center justify-center z-50 p-4" onClick={() => setShowModal(false)}>
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-3xl w-full overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-slate-700 flex items-center justify-between bg-slate-800/80">
              <div>
                <h2 className="font-bold text-white">{selectedCamera.camera_name}</h2>
                <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5"><MapPin size={10} />{selectedCamera.location_name || 'Unknown'}</p>
              </div>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-slate-700 rounded-xl text-slate-400 hover:text-white transition-colors"><X size={16} /></button>
            </div>
            <div className="relative bg-black aspect-video">
              {selectedCamera.status === 'active' && selectedCamera.stream_url
                ? <video src={selectedCamera.stream_url} controls autoPlay className="w-full h-full object-contain" />
                : <div className="flex items-center justify-center h-full"><div className="text-center"><Camera className="w-12 h-12 text-slate-600 mx-auto mb-3" /><p className="text-slate-500">Camera is offline</p></div></div>}
              {selectedCamera.status === 'active' && (
                <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-emerald-500 text-white px-2.5 py-1 rounded-full text-xs font-bold">
                  <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" /> ACTIVE
                </div>
              )}
            </div>
            <div className="p-4 grid grid-cols-4 gap-3">
              {[
                { label: 'Status', value: getStatusText(selectedCamera.status) },
                { label: 'Resolution', value: selectedCamera.resolution || '1080p' },
                { label: 'Last Active', value: formatTime(selectedCamera.last_active) },
                { label: 'Recordings', value: `${selectedCamera.recording_count || 0} clips` },
              ].map(({ label, value }) => (
                <div key={label} className="bg-slate-800 p-3 rounded-xl border border-slate-700">
                  <p className="text-[10px] text-slate-500 mb-1">{label}</p>
                  <p className="text-sm font-semibold text-white">{value}</p>
                </div>
              ))}
            </div>
            <div className="px-4 pb-4 flex gap-2">
              {selectedCamera.status === 'active' && (
                <button onClick={() => startRecording(selectedCamera.id)} className="flex-1 py-2.5 bg-red-500/20 border border-red-500/40 text-red-300 rounded-xl text-xs font-bold hover:bg-red-500/30 transition-colors flex items-center justify-center gap-1.5">
                  <Circle size={12} /> Record
                </button>
              )}
              {selectedCamera.status === 'active' && (
                <button onClick={() => updateCameraStatus(selectedCamera.id, 'maintenance')} className="flex-1 py-2.5 bg-amber-500/20 border border-amber-500/40 text-amber-300 rounded-xl text-xs font-bold hover:bg-amber-500/30 transition-colors">
                  Maintenance
                </button>
              )}
              {selectedCamera.status === 'maintenance' && (
                <button onClick={() => updateCameraStatus(selectedCamera.id, 'active')} className="flex-1 py-2.5 bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 rounded-xl text-xs font-bold hover:bg-emerald-500/30 transition-colors">
                  Activate
                </button>
              )}
              <button onClick={() => setShowModal(false)} className="flex-1 py-2.5 bg-slate-700 border border-slate-600 text-slate-300 rounded-xl text-xs font-bold hover:bg-slate-600 transition-colors">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminCCTV;