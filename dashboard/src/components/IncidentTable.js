import React from 'react';

const IncidentTable = ({ data }) => {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold">
          <tr>
            <th className="p-4">Type</th>
            <th className="p-4">Priority</th>
            <th className="p-4">Time</th>
            <th className="p-4">Coordinates</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {data.map(inc => (
            <tr key={inc.id} className="hover:bg-slate-50 transition-colors">
              <td className="p-4 font-bold text-slate-700">{inc.type}</td>
              <td className="p-4">
                <span className={`px-3 py-1 rounded-full text-[10px] font-bold ${inc.priority === 'High' ? 'bg-red-100 text-red-600' : 'bg-orange-100 text-orange-600'}`}>
                  {inc.priority}
                </span>
              </td>
              <td className="p-4 text-slate-500">{new Date(inc.timestamp).toLocaleString()}</td>
              <td className="p-4 text-slate-400 font-mono text-xs">{inc.latitude}, {inc.longitude}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default IncidentTable;