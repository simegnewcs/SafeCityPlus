// src/components/IncidentTable.js
import React, { useState, useMemo } from 'react';
import { Eye, UserPlus, MapPin, ArrowUp, ArrowDown } from 'lucide-react';

const IncidentTable = ({ data, isAdmin = true }) => {
  const [sortConfig, setSortConfig] = useState({ key: 'timestamp', direction: 'desc' });

  // Sorting logic
  const sortedData = useMemo(() => {
    if (!data || data.length === 0) return [];

    return [...data].sort((a, b) => {
      let valA = a[sortConfig.key];
      let valB = b[sortConfig.key];

      // Special handling for different fields
      if (sortConfig.key === 'timestamp') {
        valA = a.timestamp ? new Date(a.timestamp) : new Date(0);
        valB = b.timestamp ? new Date(b.timestamp) : new Date(0);
      } 
      else if (sortConfig.key === 'type' || sortConfig.key === 'priority') {
        valA = (a.type || a.ai_type || '').toString().toLowerCase();
        valB = (b.type || b.ai_type || '').toString().toLowerCase();
      } 
      else if (sortConfig.key === 'coordinates') {
        // Sort by latitude if available
        valA = Number(a.latitude) || 0;
        valB = Number(b.latitude) || 0;
      }

      if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
      if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [data, sortConfig]);

  const handleSort = (key) => {
    if (sortConfig.key === key) {
      // Toggle direction
      setSortConfig({
        key,
        direction: sortConfig.direction === 'asc' ? 'desc' : 'asc'
      });
    } else {
      // Default to descending for time, ascending for others
      setSortConfig({
        key,
        direction: key === 'timestamp' ? 'desc' : 'asc'
      });
    }
  };

  const getSortIcon = (key) => {
    if (sortConfig.key !== key) return null;
    return sortConfig.direction === 'asc' 
      ? <ArrowUp size={14} className="text-emerald-600" /> 
      : <ArrowDown size={14} className="text-emerald-600" />;
  };

  if (!data || data.length === 0) {
    return (
      <div className="py-16 text-center bg-white">
        <div className="mx-auto w-20 h-20 bg-zinc-100 rounded-3xl flex items-center justify-center mb-5 text-4xl">
          📋
        </div>
        <h3 className="text-zinc-700 font-semibold text-lg">No incidents found</h3>
        <p className="text-zinc-500 mt-1">Try adjusting your filters</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[900px] text-sm bg-white">
        <thead>
          <tr className="border-b border-zinc-200 bg-zinc-50">
            <th 
              className="px-6 py-5 text-left font-medium text-zinc-500 uppercase tracking-wider text-xs cursor-pointer hover:text-zinc-700 transition-colors"
              onClick={() => handleSort('type')}
            >
              <div className="flex items-center gap-2">
                Type
                {getSortIcon('type')}
              </div>
            </th>

            <th 
              className="px-6 py-5 text-left font-medium text-zinc-500 uppercase tracking-wider text-xs cursor-pointer hover:text-zinc-700 transition-colors"
              onClick={() => handleSort('priority')}
            >
              <div className="flex items-center gap-2">
                Priority
                {getSortIcon('priority')}
              </div>
            </th>

            <th 
              className="px-6 py-5 text-left font-medium text-zinc-500 uppercase tracking-wider text-xs cursor-pointer hover:text-zinc-700 transition-colors"
              onClick={() => handleSort('timestamp')}
            >
              <div className="flex items-center gap-2">
                Reported Time
                {getSortIcon('timestamp')}
              </div>
            </th>

            <th 
              className="px-6 py-5 text-left font-medium text-zinc-500 uppercase tracking-wider text-xs cursor-pointer hover:text-zinc-700 transition-colors"
              onClick={() => handleSort('coordinates')}
            >
              <div className="flex items-center gap-2">
                Coordinates
                {getSortIcon('coordinates')}
              </div>
            </th>

            {isAdmin && (
              <th className="px-6 py-5 text-right font-medium text-zinc-500 uppercase tracking-wider text-xs w-32">
                Actions
              </th>
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100">
          {sortedData.map((inc, index) => {
            let priorityClass = "bg-emerald-100 text-emerald-700 border border-emerald-200";
            
            if (inc.priority === "High" || inc.priority === "Critical") {
              priorityClass = "bg-rose-100 text-rose-700 border border-rose-200";
            } else if (inc.priority === "Medium") {
              priorityClass = "bg-amber-100 text-amber-700 border border-amber-200";
            }

            // Safe coordinates display
            let coordinates = "—";
            if (inc.latitude != null && inc.longitude != null) {
              const lat = Number(inc.latitude);
              const lng = Number(inc.longitude);
              if (!isNaN(lat) && !isNaN(lng)) {
                coordinates = (
                  <div className="flex items-center gap-2 font-mono text-xs text-zinc-500">
                    <span>{lat.toFixed(4)}, {lng.toFixed(4)}</span>
                    <MapPin className="w-4 h-4 text-emerald-500" />
                  </div>
                );
              }
            }

            return (
              <tr 
                key={inc.id || index} 
                className="hover:bg-zinc-50/80 transition-all duration-200 group"
              >
                <td className="px-6 py-6 font-semibold text-zinc-900">
                  {inc.type || inc.ai_type || "Unknown Incident"}
                </td>

                <td className="px-6 py-6">
                  <span className={`inline-flex px-5 py-1.5 text-xs font-bold rounded-2xl border ${priorityClass}`}>
                    {inc.priority || "Normal"}
                  </span>
                </td>

                <td className="px-6 py-6 text-zinc-600">
                  {inc.timestamp 
                    ? new Date(inc.timestamp).toLocaleString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })
                    : "Just now"}
                </td>

                <td className="px-6 py-6">
                  {coordinates}
                </td>

                {isAdmin && (
                  <td className="px-6 py-6 text-right">
                    <div className="flex items-center justify-end gap-3 opacity-70 group-hover:opacity-100 transition-all">
                      <button 
                        className="p-3 hover:bg-sky-50 text-sky-600 rounded-2xl transition-colors hover:scale-105"
                        title="View Details"
                      >
                        <Eye size={19} />
                      </button>
                      <button 
                        className="p-3 hover:bg-emerald-50 text-emerald-600 rounded-2xl transition-colors hover:scale-105"
                        title="Assign Responder"
                      >
                        <UserPlus size={19} />
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default IncidentTable;