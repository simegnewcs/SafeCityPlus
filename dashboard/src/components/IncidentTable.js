// src/components/IncidentTable.js
import React, { useState, useMemo } from 'react';
import { 
  Eye, UserPlus, MapPin, ArrowUp, ArrowDown, 
  Clock, AlertTriangle, CheckCircle, TrendingUp,
  Download, Filter, X, ChevronLeft, ChevronRight, Building
} from 'lucide-react';

// Location name mapping for common areas in Ethiopia
const locationNames = {
  // Bahir Dar locations
  '11.5967,37.3949': 'Bahir Dar University, Poly Campus',
  '11.5968,37.3950': 'Bahir Dar University, Main Campus',
  '11.5966,37.3949': 'Polytechnic College, Bahir Dar',
  '11.5982,37.3977': 'Bahir Dar Stadium Area',
  '11.5969,37.3970': 'Bahir Dar City Center',
  '11.6019,37.3989': 'Bahir Dar Airport Road',
  '11.5983,37.3975': 'Bahir Dar Market Area',
  '11.5967,37.3948': 'Tana Hayik, Bahir Dar',
  '11.5968,37.3951': 'Bahir Dar - Gondar Road',
  '11.5967,37.3950': 'Abay River Bridge',
  '11.5850,37.3900': 'Bahir Dar Railway Station',
  '11.6000,37.4000': 'Bahir Dar Industrial Park',
  
  // Addis Ababa locations
  '9.0117,38.7468': 'Bole, Addis Ababa',
  '9.0300,38.7400': 'Mexico Road, Addis Ababa',
  '9.0305,38.7500': 'Piassa, Addis Ababa',
  '8.9777,38.7993': 'Bole International Airport',
  '9.0000,38.7500': 'Meskel Square',
  '9.0200,38.7600': 'Bole Medhanialem',
  '9.0400,38.7300': 'Urael Church',
  '9.0500,38.7200': 'Kazanchis',
  '9.0600,38.7100': 'Lideta',
  '9.0700,38.7000': 'Merkato',
  
  // Default fallback
  'default': 'Unknown Location'
};

// Get readable location name from coordinates
const getReadableLocation = (lat, lng) => {
  if (!lat || !lng) return 'Unknown Location';
  
  const latitude = parseFloat(lat);
  const longitude = parseFloat(lng);
  
  if (isNaN(latitude) || isNaN(longitude)) return 'Unknown Location';
  
  // Round to 4 decimals for matching
  const key = `${latitude.toFixed(4)},${longitude.toFixed(4)}`;
  
  // Check exact match
  if (locationNames[key]) {
    return locationNames[key];
  }
  
  // Check nearby matches (within 0.01 degrees)
  for (const [coord, name] of Object.entries(locationNames)) {
    const [cLat, cLng] = coord.split(',').map(Number);
    if (Math.abs(latitude - cLat) < 0.01 && Math.abs(longitude - cLng) < 0.01) {
      return name;
    }
  }
  
  // Return coordinates if no match found
  return `${latitude.toFixed(4)}°, ${longitude.toFixed(4)}°`;
};

const IncidentTable = ({ data, isAdmin = true, onViewDetails, onAssignResponder, onUpdateStatus }) => {
  const [sortConfig, setSortConfig] = useState({ key: 'created_at', direction: 'desc' });
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Sorting logic
  const sortedData = useMemo(() => {
    if (!data || data.length === 0) return [];

    return [...data].sort((a, b) => {
      let valA = a[sortConfig.key];
      let valB = b[sortConfig.key];

      if (sortConfig.key === 'created_at' || sortConfig.key === 'timestamp') {
        valA = a.created_at || a.timestamp ? new Date(a.created_at || a.timestamp) : new Date(0);
        valB = b.created_at || b.timestamp ? new Date(b.created_at || b.timestamp) : new Date(0);
      } 
      else if (sortConfig.key === 'type') {
        valA = (a.type || a.ai_type || '').toString().toLowerCase();
        valB = (b.type || b.ai_type || '').toString().toLowerCase();
      } 
      else if (sortConfig.key === 'priority') {
        const priorityOrder = { 'critical': 4, 'high': 3, 'medium': 2, 'low': 1, 'normal': 0 };
        valA = priorityOrder[(a.priority || 'normal').toLowerCase()] || 0;
        valB = priorityOrder[(b.priority || 'normal').toLowerCase()] || 0;
      }
      else if (sortConfig.key === 'status') {
        const statusOrder = { 'pending': 0, 'in progress': 1, 'resolved': 2 };
        valA = statusOrder[(a.status || 'pending').toLowerCase()] || 0;
        valB = statusOrder[(b.status || 'pending').toLowerCase()] || 0;
      }
      else if (sortConfig.key === 'location') {
        valA = getReadableLocation(a.latitude, a.longitude).toLowerCase();
        valB = getReadableLocation(b.latitude, b.longitude).toLowerCase();
      }

      if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
      if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [data, sortConfig]);

  // Filter data
  const filteredData = useMemo(() => {
    let filtered = sortedData;
    
    if (statusFilter !== 'all') {
      filtered = filtered.filter(inc => 
        (inc.status || 'pending').toLowerCase() === statusFilter.toLowerCase()
      );
    }
    
    if (priorityFilter !== 'all') {
      filtered = filtered.filter(inc => 
        (inc.priority || 'normal').toLowerCase() === priorityFilter.toLowerCase()
      );
    }
    
    if (searchTerm) {
      filtered = filtered.filter(inc => 
        (inc.type || inc.ai_type || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (inc.description || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        getReadableLocation(inc.latitude, inc.longitude).toLowerCase().includes(searchTerm.toLowerCase()) ||
        inc.id?.toString().includes(searchTerm)
      );
    }
    
    return filtered;
  }, [sortedData, statusFilter, priorityFilter, searchTerm]);

  // Pagination
  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const paginatedData = filteredData.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleSort = (key) => {
    if (sortConfig.key === key) {
      setSortConfig({
        key,
        direction: sortConfig.direction === 'asc' ? 'desc' : 'asc'
      });
    } else {
      setSortConfig({
        key,
        direction: key === 'created_at' || key === 'timestamp' ? 'desc' : 'asc'
      });
    }
  };

  const getSortIcon = (key) => {
    if (sortConfig.key !== key) return null;
    return sortConfig.direction === 'asc' 
      ? <ArrowUp size={14} className="text-emerald-600" /> 
      : <ArrowDown size={14} className="text-emerald-600" />;
  };

  const getPriorityClass = (priority) => {
    switch (priority?.toLowerCase()) {
      case 'critical': return 'bg-red-100 text-red-700 border-red-200';
      case 'high': return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'medium': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      default: return 'bg-green-100 text-green-700 border-green-200';
    }
  };

  const getStatusClass = (status) => {
    switch (status?.toLowerCase()) {
      case 'resolved': return 'bg-emerald-100 text-emerald-700';
      case 'in progress': return 'bg-blue-100 text-blue-700';
      default: return 'bg-yellow-100 text-yellow-700';
    }
  };

  const getStatusIcon = (status) => {
    switch (status?.toLowerCase()) {
      case 'resolved': return <CheckCircle size={12} />;
      case 'in progress': return <TrendingUp size={12} />;
      default: return <Clock size={12} />;
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Just now';
    const date = new Date(dateString);
    const now = new Date();
    const diff = Math.floor((now - date) / 1000 / 60);
    
    if (diff < 60) return `${diff} min ago`;
    if (diff < 1440) return `${Math.floor(diff / 60)} hours ago`;
    return `${Math.floor(diff / 1440)} days ago`;
  };

  const clearFilters = () => {
    setStatusFilter('all');
    setPriorityFilter('all');
    setSearchTerm('');
    setCurrentPage(1);
  };

  if (!data || data.length === 0) {
    return (
      <div className="py-16 text-center bg-white">
        <div className="mx-auto w-20 h-20 bg-zinc-100 rounded-3xl flex items-center justify-center mb-5 text-4xl">
          📋
        </div>
        <h3 className="text-zinc-700 font-semibold text-lg">No incidents found</h3>
        <p className="text-zinc-500 mt-1">No incidents to display</p>
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Filters Bar */}
      <div className="p-4 border-b border-zinc-100 bg-zinc-50/50">
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <div className="flex flex-wrap gap-2">
            {/* Search Input */}
            <div className="relative">
              <input
                type="text"
                placeholder="Search incidents..."
                className="pl-9 pr-4 py-1.5 text-sm bg-white border border-zinc-200 rounded-lg focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 outline-none w-48"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            
            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-1.5 text-sm bg-white border border-zinc-200 rounded-lg focus:border-emerald-400 outline-none"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="in progress">In Progress</option>
              <option value="resolved">Resolved</option>
            </select>
            
            {/* Priority Filter */}
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="px-3 py-1.5 text-sm bg-white border border-zinc-200 rounded-lg focus:border-emerald-400 outline-none"
            >
              <option value="all">All Priorities</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
            
            {(statusFilter !== 'all' || priorityFilter !== 'all' || searchTerm) && (
              <button
                onClick={clearFilters}
                className="px-3 py-1.5 text-sm text-zinc-500 hover:text-zinc-700 flex items-center gap-1"
              >
                <X size={14} /> Clear
              </button>
            )}
          </div>
          
          <div className="text-xs text-zinc-400">
            {filteredData.length} incident{filteredData.length !== 1 ? 's' : ''} found
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-sm bg-white">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50">
              <th className="px-6 py-4 text-left font-medium text-zinc-500 uppercase tracking-wider text-xs cursor-pointer hover:text-zinc-700 transition-colors" onClick={() => handleSort('id')}>
                <div className="flex items-center gap-2">ID {getSortIcon('id')}</div>
              </th>
              <th className="px-6 py-4 text-left font-medium text-zinc-500 uppercase tracking-wider text-xs cursor-pointer hover:text-zinc-700 transition-colors" onClick={() => handleSort('type')}>
                <div className="flex items-center gap-2">Type {getSortIcon('type')}</div>
              </th>
              <th className="px-6 py-4 text-left font-medium text-zinc-500 uppercase tracking-wider text-xs cursor-pointer hover:text-zinc-700 transition-colors" onClick={() => handleSort('priority')}>
                <div className="flex items-center gap-2">Priority {getSortIcon('priority')}</div>
              </th>
              <th className="px-6 py-4 text-left font-medium text-zinc-500 uppercase tracking-wider text-xs cursor-pointer hover:text-zinc-700 transition-colors" onClick={() => handleSort('status')}>
                <div className="flex items-center gap-2">Status {getSortIcon('status')}</div>
              </th>
              <th className="px-6 py-4 text-left font-medium text-zinc-500 uppercase tracking-wider text-xs cursor-pointer hover:text-zinc-700 transition-colors" onClick={() => handleSort('created_at')}>
                <div className="flex items-center gap-2">Reported {getSortIcon('created_at')}</div>
              </th>
              <th className="px-6 py-4 text-left font-medium text-zinc-500 uppercase tracking-wider text-xs cursor-pointer hover:text-zinc-700 transition-colors" onClick={() => handleSort('location')}>
                <div className="flex items-center gap-2">
                  <Building size={12} />
                  Location {getSortIcon('location')}
                </div>
              </th>
              {isAdmin && (
                <th className="px-6 py-4 text-right font-medium text-zinc-500 uppercase tracking-wider text-xs">Actions</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {paginatedData.map((inc, index) => {
              const readableLocation = getReadableLocation(inc.latitude, inc.longitude);
              const isCoordinates = readableLocation.includes('°');
              
              return (
                <tr key={inc.id || index} className="hover:bg-zinc-50/80 transition-all duration-200 group">
                  <td className="px-6 py-4 font-mono text-xs text-zinc-500">#{inc.id}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <AlertTriangle size={14} className="text-zinc-400" />
                      <span className="font-medium text-zinc-900">{inc.type || inc.ai_type || "Unknown"}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex px-3 py-1 text-xs font-semibold rounded-full ${getPriorityClass(inc.priority)}`}>
                      {inc.priority || "Normal"}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-full ${getStatusClass(inc.status)}`}>
                      {getStatusIcon(inc.status)}
                      {inc.status || "Pending"}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-zinc-500 text-xs">
                    {formatDate(inc.created_at || inc.timestamp)}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1.5">
                      <MapPin size={12} className={isCoordinates ? "text-zinc-400" : "text-emerald-500"} />
                      <span className={isCoordinates ? "text-zinc-400 text-xs font-mono" : "text-zinc-700 text-sm font-medium"}>
                        {readableLocation}
                      </span>
                    </div>
                    {isCoordinates && inc.latitude && inc.longitude && (
                      <div className="text-[10px] text-zinc-400 font-mono mt-1">
                        {parseFloat(inc.latitude).toFixed(4)}°, {parseFloat(inc.longitude).toFixed(4)}°
                      </div>
                    )}
                  </td>
                  {isAdmin && (
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all">
                        <button 
                          onClick={() => onViewDetails?.(inc)}
                          className="p-2 hover:bg-sky-50 text-sky-600 rounded-lg transition-colors"
                          title="View Details"
                        >
                          <Eye size={16} />
                        </button>
                        <button 
                          onClick={() => onAssignResponder?.(inc)}
                          className="p-2 hover:bg-emerald-50 text-emerald-600 rounded-lg transition-colors"
                          title="Assign Responder"
                        >
                          <UserPlus size={16} />
                        </button>
                        {inc.status !== "Resolved" && (
                          <button 
                            onClick={() => onUpdateStatus?.(inc.id, "Resolved")}
                            className="p-2 hover:bg-emerald-50 text-emerald-600 rounded-lg transition-colors"
                            title="Mark Resolved"
                          >
                            <CheckCircle size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="px-6 py-4 border-t border-zinc-100 flex items-center justify-between">
          <p className="text-sm text-zinc-500">
            Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredData.length)} of {filteredData.length} incidents
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="p-2 border border-zinc-200 rounded-lg hover:bg-zinc-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft size={18} />
            </button>
            <div className="flex gap-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum;
                if (totalPages <= 5) pageNum = i + 1;
                else if (currentPage <= 3) pageNum = i + 1;
                else if (currentPage >= totalPages - 2) pageNum = totalPages - 4 + i;
                else pageNum = currentPage - 2 + i;
                
                return (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
                      currentPage === pageNum
                        ? 'bg-emerald-600 text-white'
                        : 'hover:bg-zinc-100 text-zinc-600'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>
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
    </div>
  );
};

export default IncidentTable;