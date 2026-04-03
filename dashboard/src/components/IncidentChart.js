// src/components/IncidentChart.js
import React, { useMemo } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  PointElement,
  LineElement,
} from "chart.js";
import { Pie, Bar, Line, Doughnut } from "react-chartjs-2";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  PointElement,
  LineElement
);

const IncidentChart = ({ incidents, chartType = "all" }) => {
  // Pie chart: Incident Types Distribution
  const typeData = useMemo(() => {
    const typeCount = {};
    incidents.forEach((inc) => {
      const type = inc.type || inc.ai_type || "Unknown";
      typeCount[type] = (typeCount[type] || 0) + 1;
    });
    
    const labels = Object.keys(typeCount);
    const values = Object.values(typeCount);
    const backgroundColors = [
      "#ef4444", "#f59e0b", "#10b981", "#3b82f6", "#8b5cf6",
      "#ec4899", "#06b6d4", "#84cc16", "#f97316", "#6366f1",
    ];
    
    return {
      labels,
      datasets: [
        {
          data: values,
          backgroundColor: backgroundColors.slice(0, labels.length),
          borderWidth: 2,
          borderColor: "#fff",
          hoverOffset: 10,
        },
      ],
    };
  }, [incidents]);

  // Bar Chart: Priority Distribution
  const priorityData = useMemo(() => {
    const priorityCount = { 
      Critical: 0, 
      High: 0, 
      Medium: 0, 
      Low: 0, 
      Normal: 0 
    };
    
    incidents.forEach((inc) => {
      const priority = inc.priority || inc.ai_priority || "Normal";
      if (priority === "Critical") priorityCount.Critical++;
      else if (priority === "High") priorityCount.High++;
      else if (priority === "Medium") priorityCount.Medium++;
      else if (priority === "Low") priorityCount.Low++;
      else priorityCount.Normal++;
    });
    
    return {
      labels: Object.keys(priorityCount),
      datasets: [
        {
          label: "Number of Incidents",
          data: Object.values(priorityCount),
          backgroundColor: ["#dc2626", "#ef4444", "#f59e0b", "#10b981", "#6b7280"],
          borderRadius: 8,
          barPercentage: 0.7,
          categoryPercentage: 0.8,
        },
      ],
    };
  }, [incidents]);

  // Line Chart: Incidents Over Time (Last 7 Days)
  const trendData = useMemo(() => {
    const last7Days = [];
    const dayCounts = [];
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toLocaleDateString();
      last7Days.push(dateStr);
      
      const count = incidents.filter(inc => {
        const incDate = new Date(inc.created_at);
        return incDate.toLocaleDateString() === dateStr;
      }).length;
      dayCounts.push(count);
    }
    
    return {
      labels: last7Days,
      datasets: [
        {
          label: "Incidents",
          data: dayCounts,
          borderColor: "#10b981",
          backgroundColor: "rgba(16, 185, 129, 0.1)",
          borderWidth: 3,
          pointRadius: 5,
          pointHoverRadius: 8,
          pointBackgroundColor: "#10b981",
          pointBorderColor: "#fff",
          fill: true,
          tension: 0.4,
        },
      ],
    };
  }, [incidents]);

  // Doughnut Chart: Status Distribution
  const statusData = useMemo(() => {
    const statusCount = { 
      "Pending": 0, 
      "In Progress": 0, 
      "Resolved": 0 
    };
    
    incidents.forEach((inc) => {
      const status = inc.status || "Pending";
      if (status === "Pending") statusCount.Pending++;
      else if (status === "In Progress") statusCount["In Progress"]++;
      else if (status === "Resolved") statusCount.Resolved++;
    });
    
    return {
      labels: Object.keys(statusCount),
      datasets: [
        {
          data: Object.values(statusCount),
          backgroundColor: ["#f59e0b", "#3b82f6", "#10b981"],
          borderWidth: 2,
          borderColor: "#fff",
          hoverOffset: 10,
        },
      ],
    };
  }, [incidents]);

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "bottom",
        labels: {
          font: { size: 11 },
          boxWidth: 12,
          padding: 10,
        },
      },
      tooltip: {
        backgroundColor: "rgba(0,0,0,0.8)",
        titleColor: "#fff",
        bodyColor: "#e5e7eb",
        padding: 10,
        cornerRadius: 8,
      },
    },
  };

  const barOptions = {
    ...chartOptions,
    scales: {
      y: {
        beginAtZero: true,
        grid: { color: "#e5e7eb" },
        title: { display: true, text: "Number of Incidents", font: { size: 11 } },
      },
      x: {
        grid: { display: false },
        title: { display: true, text: "Priority Level", font: { size: 11 } },
      },
    },
  };

  const lineOptions = {
    ...chartOptions,
    scales: {
      y: {
        beginAtZero: true,
        grid: { color: "#e5e7eb" },
        title: { display: true, text: "Number of Incidents", font: { size: 11 } },
      },
      x: {
        grid: { display: false },
        title: { display: true, text: "Date", font: { size: 11 } },
      },
    },
  };

  if (incidents.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-zinc-500">
        <div className="text-center">
          <div className="w-16 h-16 bg-zinc-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <svg className="w-8 h-8 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <p className="font-medium">No data available</p>
          <p className="text-sm">No incidents to display in charts</p>
        </div>
      </div>
    );
  }

  if (chartType === "pie") {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 p-6">
        <h3 className="text-base font-semibold text-zinc-900 mb-4">Incident Types Distribution</h3>
        <div className="h-[320px]">
          <Pie data={typeData} options={chartOptions} />
        </div>
      </div>
    );
  }

  if (chartType === "bar") {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 p-6">
        <h3 className="text-base font-semibold text-zinc-900 mb-4">Priority Distribution</h3>
        <div className="h-[320px]">
          <Bar data={priorityData} options={barOptions} />
        </div>
      </div>
    );
  }

  if (chartType === "line") {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 p-6">
        <h3 className="text-base font-semibold text-zinc-900 mb-4">Incident Trend (Last 7 Days)</h3>
        <div className="h-[320px]">
          <Line data={trendData} options={lineOptions} />
        </div>
      </div>
    );
  }

  if (chartType === "doughnut") {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 p-6">
        <h3 className="text-base font-semibold text-zinc-900 mb-4">Status Distribution</h3>
        <div className="h-[320px]">
          <Doughnut data={statusData} options={chartOptions} />
        </div>
      </div>
    );
  }

  // Default: Show all charts in grid
  return (
    <div className="space-y-6">
      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pie Chart - Incident Types */}
        <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-zinc-900">Incident Types</h3>
            <span className="text-xs text-zinc-400">Distribution by category</span>
          </div>
          <div className="h-[280px]">
            <Pie data={typeData} options={chartOptions} />
          </div>
        </div>

        {/* Bar Chart - Priority */}
        <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-zinc-900">Priority Levels</h3>
            <span className="text-xs text-zinc-400">Distribution by urgency</span>
          </div>
          <div className="h-[280px]">
            <Bar data={priorityData} options={barOptions} />
          </div>
        </div>
      </div>

      {/* Second Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Line Chart - Trend */}
        <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-zinc-900">Incident Trend</h3>
            <span className="text-xs text-zinc-400">Last 7 days</span>
          </div>
          <div className="h-[280px]">
            <Line data={trendData} options={lineOptions} />
          </div>
        </div>

        {/* Doughnut Chart - Status */}
        <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-zinc-900">Status Distribution</h3>
            <span className="text-xs text-zinc-400">Current incident status</span>
          </div>
          <div className="h-[280px]">
            <Doughnut data={statusData} options={chartOptions} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default IncidentChart;