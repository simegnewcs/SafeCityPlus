import React from 'react';
import { Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';

ChartJS.register(ArcElement, Tooltip, Legend);

const IncidentChart = ({ data }) => {
  const chartData = {
    labels: ['Fire', 'Accident', 'Crime', 'Medical'],
    datasets: [{
      data: [
        data.filter(i => i.type === 'Fire').length,
        data.filter(i => i.type === 'Accident').length,
        data.filter(i => i.type === 'Crime').length,
        data.filter(i => i.type === 'Medical').length,
      ],
      backgroundColor: [
        '#ef4444', // Red for Fire
        '#f59e0b', // Amber for Accident
        '#3b82f6', // Blue for Crime
        '#10b981'  // Emerald for Medical
      ],
      hoverOffset: 20,
      borderWidth: 0,
    }]
  };

  const options = {
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          padding: 20,
          usePointStyle: true,
          font: { size: 12, weight: 'bold' }
        }
      }
    },
    cutout: '70%', // መሃሉ ክፍት እንዲሆን (Modern Look)
    maintainAspectRatio: false,
  };

  return (
    <div className="h-64 relative">
      <Doughnut data={chartData} options={options} />
      {/* መሃል ላይ ጠቅላላ ቁጥሩን ለማሳየት */}
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <span className="text-3xl font-black text-slate-800">{data.length}</span>
        <span className="text-[10px] text-slate-400 uppercase font-bold tracking-widest">Total</span>
      </div>
    </div>
  );
};

export default IncidentChart;