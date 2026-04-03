// src/components/IncidentCard.js
import React, { useState } from 'react';
import { MapPin, Clock, AlertCircle, Eye, Video, Image, CheckCircle, XCircle, TrendingUp } from 'lucide-react';

const IncidentCard = ({ incident, onClick }) => {
  const [imageError, setImageError] = useState(false);
  
  const imageUrl = incident.media_name 
    ? `http://localhost:5000/uploads/${incident.media_name}`
    : (incident.image_name ? `http://localhost:5000/uploads/${incident.image_name}` : null);
  
  const isVideo = incident.media_type === 'video';
  
  const getPriorityColor = (priority) => {
    switch (priority?.toLowerCase()) {
      case 'critical': return 'bg-red-600 text-white';
      case 'high': return 'bg-orange-500 text-white';
      case 'medium': return 'bg-yellow-500 text-white';
      default: return 'bg-green-500 text-white';
    }
  };
  
  const getPriorityIcon = (priority) => {
    switch (priority?.toLowerCase()) {
      case 'critical': return <AlertCircle size={12} />;
      case 'high': return <AlertCircle size={12} />;
      case 'medium': return <TrendingUp size={12} />;
      default: return <CheckCircle size={12} />;
    }
  };
  
  const getStatusBadge = (status) => {
    switch (status?.toLowerCase()) {
      case 'resolved':
        return { color: 'bg-emerald-100 text-emerald-700', icon: <CheckCircle size={10} />, text: 'Resolved' };
      case 'in progress':
        return { color: 'bg-blue-100 text-blue-700', icon: <TrendingUp size={10} />, text: 'In Progress' };
      default:
        return { color: 'bg-yellow-100 text-yellow-700', icon: <Clock size={10} />, text: 'Pending' };
    }
  };
  
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    const now = new Date();
    const diff = Math.floor((now - date) / 1000 / 60);
    
    if (diff < 60) return `${diff} minutes ago`;
    if (diff < 1440) return `${Math.floor(diff / 60)} hours ago`;
    return `${Math.floor(diff / 1440)} days ago`;
  };
  
  const formatLocation = (lat, lng) => {
    if (!lat || !lng) return 'Unknown';
    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);
    if (isNaN(latitude) || isNaN(longitude)) return 'Unknown';
    return `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
  };
  
  const statusBadge = getStatusBadge(incident.status);
  
  return (
    <div 
      onClick={() => onClick && onClick(incident)}
      className="group bg-white rounded-2xl shadow-sm border border-zinc-200 overflow-hidden hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer"
    >
      {/* Media Section */}
      <div className="relative">
        {imageUrl && !imageError ? (
          isVideo ? (
            <div className="relative w-full h-44 bg-zinc-900 flex items-center justify-center">
              <video 
                src={imageUrl}
                className="w-full h-full object-cover"
                poster="https://via.placeholder.com/400x200?text=Video+Preview"
              />
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="bg-white/20 backdrop-blur rounded-full p-3">
                  <Video className="w-8 h-8 text-white" />
                </div>
              </div>
              <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
                <Video size={10} />
                <span>Video</span>
              </div>
            </div>
          ) : (
            <div className="relative w-full h-44 overflow-hidden">
              <img 
                src={imageUrl} 
                alt="Incident evidence" 
                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                onError={() => setImageError(true)}
              />
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="bg-white/20 backdrop-blur rounded-full p-3">
                  <Eye className="w-8 h-8 text-white" />
                </div>
              </div>
              <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
                <Image size={10} />
                <span>Photo</span>
              </div>
            </div>
          )
        ) : (
          <div className="w-full h-44 bg-gradient-to-br from-zinc-100 to-zinc-200 flex items-center justify-center">
            <AlertCircle className="w-12 h-12 text-zinc-400" />
          </div>
        )}
        
        {/* Priority Badge */}
        <div className={`absolute top-3 left-3 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider shadow-sm flex items-center gap-1 ${getPriorityColor(incident.priority)}`}>
          {getPriorityIcon(incident.priority)}
          {incident.priority || 'Normal'}
        </div>
        
        {/* Status Badge */}
        <div className={`absolute top-3 right-3 px-2.5 py-1 rounded-full text-[10px] font-medium flex items-center gap-1 shadow-sm ${statusBadge.color}`}>
          {statusBadge.icon}
          {statusBadge.text}
        </div>
      </div>
      
      {/* Content Section */}
      <div className="p-4">
        {/* Incident Type */}
        <div className="flex items-center gap-2 mb-2">
          <AlertCircle size={14} className="text-emerald-600" />
          <h4 className="font-bold text-zinc-800 text-sm uppercase tracking-wide line-clamp-1">
            {incident.type || "Unknown Incident"}
          </h4>
        </div>
        
        {/* Description */}
        <p className="text-xs text-zinc-500 line-clamp-2 leading-relaxed mb-3">
          {incident.description || "No description provided for this incident."}
        </p>
        
        {/* Meta Information */}
        <div className="flex flex-col gap-1.5 pt-2 border-t border-zinc-100">
          <div className="flex items-center gap-2 text-zinc-400">
            <Clock size={11} />
            <span className="text-[10px] font-medium">
              {formatDate(incident.created_at || incident.timestamp)}
            </span>
          </div>
          <div className="flex items-center gap-2 text-zinc-400">
            <MapPin size={11} />
            <span className="text-[10px] font-mono">
              {formatLocation(incident.latitude, incident.longitude)}
            </span>
          </div>
          {incident.reporter_name && (
            <div className="flex items-center gap-2 text-zinc-400">
              <AlertCircle size={11} />
              <span className="text-[10px]">
                Reported by: {incident.reporter_name}
              </span>
            </div>
          )}
        </div>
        
        {/* AI Detection Tags (if available) */}
        {incident.all_detections && incident.all_detections.length > 0 && (
          <div className="mt-3 pt-2 border-t border-zinc-100">
            <div className="flex flex-wrap gap-1">
              {incident.all_detections.slice(0, 3).map((detection, idx) => (
                <span key={idx} className="text-[8px] px-2 py-0.5 bg-emerald-50 text-emerald-600 rounded-full">
                  {detection.ai_type}
                </span>
              ))}
              {incident.all_detections.length > 3 && (
                <span className="text-[8px] px-2 py-0.5 bg-zinc-100 text-zinc-500 rounded-full">
                  +{incident.all_detections.length - 3} more
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default IncidentCard;