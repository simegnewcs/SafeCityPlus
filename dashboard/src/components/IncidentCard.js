import React from 'react';
import { MapPin, Clock, AlertCircle } from 'lucide-react';

const IncidentCard = ({ incident }) => {
  const imageUrl = `http://localhost:5000/uploads/${incident.image_name}`;

  return (
    <div className="group bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
      <div className="relative">
        <img 
          src={imageUrl} 
          alt="Evidence" 
          className="w-full h-40 object-cover"
          onError={(e) => { e.target.src = 'https://via.placeholder.com/400x200?text=No+Photo'; }}
        />
        <div className={`absolute top-3 right-3 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider shadow-sm ${
          incident.priority === 'High' ? 'bg-red-500 text-white' : 'bg-amber-500 text-white'
        }`}>
          {incident.priority}
        </div>
      </div>
      
      <div className="p-5">
        <div className="flex items-center gap-2 mb-2 text-blue-600">
          <AlertCircle size={14} />
          <h4 className="font-bold text-slate-800 text-sm uppercase">{incident.type}</h4>
        </div>
        
        <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed mb-4">
          {incident.description || "No detailed description provided for this emergency."}
        </p>
        
        <div className="flex flex-col gap-2 pt-3 border-t border-slate-50">
          <div className="flex items-center gap-2 text-slate-400">
            <Clock size={12} />
            <span className="text-[10px] font-medium">{new Date(incident.timestamp).toLocaleString()}</span>
          </div>
          <div className="flex items-center gap-2 text-slate-400">
            <MapPin size={12} />
            <span className="text-[10px] font-mono">{incident.latitude.slice(0, 7)}, {incident.longitude.slice(0, 7)}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default IncidentCard;