// src/components/IncidentChart.js
import React, { useMemo } from "react";
import { Pie, Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
);

const IncidentChart = ({ incidents }) => {
  // Pie chart: types
  const pieData = useMemo(() => {
    const typeCount = {};
    incidents.forEach((inc) => {
      const type = inc.ai_type || "Unknown";
      typeCount[type] = (typeCount[type] || 0) + 1;
    });
    return {
      labels: Object.keys(typeCount),
      datasets: [
        {
          data: Object.values(typeCount),
          backgroundColor: [
            "#FF6384",
            "#36A2EB",
            "#FFCE56",
            "#8AFF33",
            "#FF8A33",
          ],
        },
      ],
    };
  }, [incidents]);

  // Bar chart: priority
  const priorityData = useMemo(() => {
    const priorityCount = { High: 0, Medium: 0, Low: 0, Unknown: 0 };
    incidents.forEach((inc) => {
      const priority = inc.ai_priority || "Unknown";
      priorityCount[priority] = (priorityCount[priority] || 0) + 1;
    });
    return {
      labels: Object.keys(priorityCount),
      datasets: [
        {
          data: Object.values(priorityCount),
          backgroundColor: ["#FF4C4C", "#FFCE56", "#36A2EB", "#999"],
        },
      ],
    };
  }, [incidents]);

  return (
    <div className="grid grid-cols-2 gap-6">
      {/* Pie chart: incident types */}
      <div className="bg-white p-4 rounded-xl shadow">
        <Pie data={pieData} />
      </div>

      {/* Bar chart: priority */}
      <div className="bg-white p-4 rounded-xl shadow">
        <Bar data={priorityData} />
      </div>
    </div>
  );
};

export default IncidentChart;
