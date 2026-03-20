import React from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

const customIcon = new L.Icon({
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});

const MapView = ({ incidents }) => {
  return (
    <MapContainer center={[9.03, 38.74]} zoom={12} style={{ height: '100%', width: '100%', borderRadius: '20px' }}>
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      {incidents.map(inc => (
        <Marker key={inc.id} position={[inc.latitude, inc.longitude]} icon={customIcon}>
          <Popup>
            <div className="p-1">
              <p className="font-bold text-red-600">{inc.type}</p>
              <p className="text-xs">{inc.description}</p>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
};

export default MapView;