// src/pages/ResponderAnalytics.js
import React, { useState, useEffect, useRef, useMemo } from "react";
import ResponderSidebar from "../layout/ResponderSidebar";
import SuperResponderSidebar from "../layout/SuperResponderSidebar";
import PageHeader from "../layout/PageHeader";
import { 
  TrendingUp, AlertTriangle, Clock, Users, 
  Calendar, MapPin, Activity, RefreshCw, Download,
  BarChart3, PieChart as PieChartIcon,
  FileText, CheckCircle, XCircle, Clock3
} from "lucide-react";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend,
  LineChart, Line, AreaChart, Area
} from "recharts";
import axios from "axios";
import jsPDF from "jspdf";

const API_URL = "http://localhost:5000/api";

const ResponderAnalytics = () => {
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [timeRange, setTimeRange] = useState("week"); // week, month, year
  const [exportingPDF, setExportingPDF] = useState(false);
  const analyticsRef = useRef(null);

  // Fetch incidents from API
  const fetchIncidents = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/incidents`);
      setIncidents(response.data);
      setLastUpdated(new Date());
    } catch (error) {
      console.error("Error fetching incidents:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIncidents();
    // Refresh every 30 seconds
    const interval = setInterval(fetchIncidents, 30000);
    return () => clearInterval(interval);
  }, []);

  // Calculate statistics
  const stats = useMemo(() => {
    const total = incidents.length;
    const high = incidents.filter((i) => i.priority === "High" || i.priority === "Critical").length;
    const medium = incidents.filter((i) => i.priority === "Medium").length;
    const low = incidents.filter((i) => i.priority === "Low" || i.priority === "Normal").length;
    const pending = incidents.filter((i) => i.status === "Pending").length;
    const resolved = incidents.filter((i) => i.status === "Resolved").length;
    const inProgress = incidents.filter((i) => i.status === "In Progress").length;
    
    // Calculate average confidence
    const avgConfidence = incidents.reduce((sum, inc) => sum + (inc.confidence || 0), 0) / (total || 1);
    
    return { total, high, medium, low, pending, resolved, inProgress, avgConfidence };
  }, [incidents]);

  // Data for Pie Chart (Priority Distribution)
  const priorityData = useMemo(() => [
    { name: "High", value: stats.high, fill: "#ef4444" },
    { name: "Medium", value: stats.medium, fill: "#f59e0b" },
    { name: "Low", value: stats.low, fill: "#10b981" },
  ], [stats]);

  // Data for Status Chart
  const statusData = useMemo(() => [
    { name: "Pending", value: stats.pending, fill: "#f59e0b" },
    { name: "In Progress", value: stats.inProgress, fill: "#3b82f6" },
    { name: "Resolved", value: stats.resolved, fill: "#10b981" },
  ], [stats]);

  // Data for Bar Chart - Incidents by Type
  const typeData = useMemo(() => {
    const typeCount = incidents.reduce((acc, inc) => {
      const type = inc.type || "Unknown";
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {});

    return Object.entries(typeCount)
      .map(([name, value]) => ({ name: name.length > 15 ? name.substring(0, 12) + "..." : name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [incidents]);

  // Data for Line Chart - Incidents by Date
  const getDateRange = () => {
    const today = new Date();
    const dates = [];
    let days = 7;
    if (timeRange === "month") days = 30;
    if (timeRange === "year") days = 365;
    
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      dates.push(date.toISOString().split('T')[0]);
    }
    return dates;
  };

  const trendData = useMemo(() => {
    const dateRange = getDateRange();
    const dateCount = incidents.reduce((acc, inc) => {
      const date = inc.created_at ? inc.created_at.split('T')[0] : null;
      if (date && dateRange.includes(date)) {
        acc[date] = (acc[date] || 0) + 1;
      }
      return acc;
    }, {});

    return dateRange.map(date => ({
      date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      fullDate: date,
      count: dateCount[date] || 0
    }));
  }, [incidents, timeRange]);

  // Group by location
  const locationData = useMemo(() => {
    const locCount = incidents.reduce((acc, inc) => {
      const loc = inc.location || "Unknown";
      acc[loc] = (acc[loc] || 0) + 1;
      return acc;
    }, {});

    return Object.entries(locCount)
      .map(([name, value]) => ({ name: name.length > 20 ? name.substring(0, 17) + "..." : name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [incidents]);

  // PDF Export function
  const handlePDFExport = async () => {
    if (exportingPDF) return;
    
    setExportingPDF(true);
    try {
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      
      // Header
      pdf.setFillColor(220, 38, 38);
      pdf.rect(0, 0, pageWidth, 30, 'F');
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(20);
      pdf.text('Incident Analytics Report', 14, 20);
      
      // Date and user info
      pdf.setTextColor(100, 100, 100);
      pdf.setFontSize(10);
      pdf.text(`Generated: ${new Date().toLocaleString()}`, 14, 38);
      pdf.text(`Generated by: ${user.name || 'Responder'}`, 14, 44);
      pdf.text(`Time Range: ${timeRange}`, pageWidth - 50, 38);
      
      // Summary Statistics Section
      pdf.setTextColor(50, 50, 50);
      pdf.setFontSize(16);
      pdf.text('Summary Statistics', 14, 60);
      
      // Stats boxes
      pdf.setDrawColor(220, 38, 38);
      pdf.setLineWidth(0.5);
      
      const statsY = 70;
      const boxWidth = 45;
      const boxHeight = 25;
      
      // Total
      pdf.setFillColor(254, 226, 226);
      pdf.rect(14, statsY, boxWidth, boxHeight, 'F');
      pdf.setTextColor(185, 28, 28);
      pdf.setFontSize(8);
      pdf.text('TOTAL', 18, statsY + 8);
      pdf.setFontSize(14);
      pdf.text(String(stats.total), 18, statsY + 20);
      
      // High Priority
      pdf.setFillColor(254, 243, 199);
      pdf.rect(14 + boxWidth + 5, statsY, boxWidth, boxHeight, 'F');
      pdf.setTextColor(180, 83, 9);
      pdf.setFontSize(8);
      pdf.text('HIGH', 18 + boxWidth + 5, statsY + 8);
      pdf.setFontSize(14);
      pdf.text(String(stats.high), 18 + boxWidth + 5, statsY + 20);
      
      // Pending
      pdf.setFillColor(219, 234, 254);
      pdf.rect(14 + (boxWidth + 5) * 2, statsY, boxWidth, boxHeight, 'F');
      pdf.setTextColor(30, 64, 175);
      pdf.setFontSize(8);
      pdf.text('PENDING', 18 + (boxWidth + 5) * 2, statsY + 8);
      pdf.setFontSize(14);
      pdf.text(String(stats.pending), 18 + (boxWidth + 5) * 2, statsY + 20);
      
      // Resolved
      pdf.setFillColor(209, 250, 229);
      pdf.rect(14 + (boxWidth + 5) * 3, statsY, boxWidth, boxHeight, 'F');
      pdf.setTextColor(6, 95, 70);
      pdf.setFontSize(8);
      pdf.text('RESOLVED', 18 + (boxWidth + 5) * 3, statsY + 8);
      pdf.setFontSize(14);
      pdf.text(String(stats.resolved), 18 + (boxWidth + 5) * 3, statsY + 20);
      
      // Detailed Statistics
      pdf.setTextColor(50, 50, 50);
      pdf.setFontSize(14);
      pdf.text('Detailed Statistics', 14, statsY + 40);
      
      pdf.setFontSize(10);
      pdf.setTextColor(80, 80, 80);
      let yPos = statsY + 50;
      pdf.text(`Medium Priority: ${stats.medium}`, 14, yPos);
      pdf.text(`Low Priority: ${stats.low}`, 80, yPos);
      yPos += 7;
      pdf.text(`In Progress: ${stats.inProgress}`, 14, yPos);
      pdf.text(`Avg Confidence: ${stats.avgConfidence.toFixed(1)}%`, 80, yPos);
      
      // Top Incident Types
      yPos += 20;
      pdf.setTextColor(50, 50, 50);
      pdf.setFontSize(14);
      pdf.text('Top Incident Types', 14, yPos);
      
      yPos += 10;
      pdf.setFontSize(10);
      pdf.setTextColor(80, 80, 80);
      typeData.slice(0, 5).forEach((item) => {
        if (yPos > 270) {
          pdf.addPage();
          yPos = 20;
        }
        pdf.text(`${item.name}: ${item.value}`, 14, yPos);
        yPos += 7;
      });
      
      // Top Locations
      if (yPos > 220) {
        pdf.addPage();
        yPos = 20;
      }
      
      yPos += 15;
      pdf.setTextColor(50, 50, 50);
      pdf.setFontSize(14);
      pdf.text('Top Locations', 14, yPos);
      
      yPos += 10;
      pdf.setFontSize(10);
      pdf.setTextColor(80, 80, 80);
      locationData.slice(0, 5).forEach((item) => {
        if (yPos > 270) {
          pdf.addPage();
          yPos = 20;
        }
        pdf.text(`${item.name}: ${item.value}`, 14, yPos);
        yPos += 7;
      });
      
      // Footer
      pdf.setFontSize(8);
      pdf.setTextColor(150, 150, 150);
      pdf.text('Generated by SafeCityPlus Analytics System', pageWidth / 2, pageHeight - 10, { align: 'center' });
      
      // Save PDF
      pdf.save(`responder-analytics-${Date.now()}.pdf`);
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Failed to generate PDF. Please try again.');
    } finally {
      setExportingPDF(false);
    }
  };

  const SidebarComponent = user.role === 'SuperResponder' 
    ? <SuperResponderSidebar activeTab="analytics" user={user} />
    : <ResponderSidebar activeTab="analytics" user={user} />;

  if (loading) {
    return (
      <div className="flex h-screen bg-zinc-50">
        {SidebarComponent}
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-zinc-600">Loading analytics...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-zinc-50 overflow-hidden">
      {SidebarComponent}
      
      <div className="flex-1 flex flex-col overflow-hidden" ref={analyticsRef}>
        <PageHeader 
          title="Analytics Dashboard"
          subtitle="Incident insights and performance metrics"
          icon={<TrendingUp className="w-6 h-6 text-emerald-600" />}
        />
        
        <main className="flex-1 overflow-y-auto p-6">
          {/* Controls */}
          <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-2">
              <span className="text-sm text-zinc-500">Time Range:</span>
              <div className="flex bg-white rounded-lg border border-zinc-200 p-1">
                {["week", "month", "year"].map((range) => (
                  <button
                    key={range}
                    onClick={() => setTimeRange(range)}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                      timeRange === range
                        ? "bg-emerald-500 text-white"
                        : "text-zinc-600 hover:bg-zinc-100"
                    }`}
                  >
                    {range.charAt(0).toUpperCase() + range.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <button
                onClick={fetchIncidents}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-zinc-200 text-zinc-600 rounded-lg hover:bg-zinc-50 transition-all"
              >
                <RefreshCw size={16} />
                Refresh
              </button>
              
              <button
                onClick={handlePDFExport}
                disabled={exportingPDF}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white rounded-lg transition-all"
              >
                <FileText size={16} />
                {exportingPDF ? 'Generating PDF...' : 'Export PDF'}
              </button>
            </div>
          </div>
          
          {/* Last Updated */}
          <p className="text-xs text-zinc-400 mb-4">
            Last updated: {lastUpdated.toLocaleString()}
          </p>
          
          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 mb-6">
            {[
              { label: "Total", value: stats.total, icon: BarChart3, color: "bg-zinc-100 text-zinc-600" },
              { label: "High Priority", value: stats.high, icon: AlertTriangle, color: "bg-red-100 text-red-600" },
              { label: "Medium", value: stats.medium, icon: Clock, color: "bg-amber-100 text-amber-600" },
              { label: "Low", value: stats.low, icon: CheckCircle, color: "bg-emerald-100 text-emerald-600" },
              { label: "Pending", value: stats.pending, icon: Clock3, color: "bg-amber-100 text-amber-600" },
              { label: "In Progress", value: stats.inProgress, icon: Activity, color: "bg-blue-100 text-blue-600" },
              { label: "Resolved", value: stats.resolved, icon: CheckCircle, color: "bg-emerald-100 text-emerald-600" },
            ].map((stat) => (
              <div key={stat.label} className="bg-white p-4 rounded-xl border border-zinc-200 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <div className={`p-2 rounded-lg ${stat.color}`}>
                    <stat.icon size={16} />
                  </div>
                </div>
                <p className="text-2xl font-bold text-zinc-900">{stat.value}</p>
                <p className="text-xs text-zinc-500">{stat.label}</p>
              </div>
            ))}
          </div>
          
          {/* Charts Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Priority Distribution */}
            <div className="bg-white p-6 rounded-xl border border-zinc-200 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <PieChartIcon className="w-5 h-5 text-zinc-500" />
                <h3 className="text-lg font-semibold text-zinc-900">Priority Distribution</h3>
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={priorityData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {priorityData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
            
            {/* Status Overview */}
            <div className="bg-white p-6 rounded-xl border border-zinc-200 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <Activity className="w-5 h-5 text-zinc-500" />
                <h3 className="text-lg font-semibold text-zinc-900">Status Overview</h3>
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={statusData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="name" stroke="#9ca3af" />
                    <YAxis stroke="#9ca3af" />
                    <Tooltip />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                      {statusData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            
            {/* Incidents by Type */}
            <div className="bg-white p-6 rounded-xl border border-zinc-200 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <BarChart3 className="w-5 h-5 text-zinc-500" />
                <h3 className="text-lg font-semibold text-zinc-900">Incidents by Type</h3>
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={typeData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis type="number" stroke="#9ca3af" />
                    <YAxis dataKey="name" type="category" width={100} stroke="#9ca3af" />
                    <Tooltip />
                    <Bar dataKey="value" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            
            {/* Trend Over Time */}
            <div className="bg-white p-6 rounded-xl border border-zinc-200 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="w-5 h-5 text-zinc-500" />
                <h3 className="text-lg font-semibold text-zinc-900">Trend Over Time</h3>
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="date" stroke="#9ca3af" />
                    <YAxis stroke="#9ca3af" />
                    <Tooltip />
                    <Area type="monotone" dataKey="count" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.3} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
          
          {/* Bottom Section - Locations */}
          <div className="bg-white p-6 rounded-xl border border-zinc-200 shadow-sm mb-6">
            <div className="flex items-center gap-2 mb-4">
              <MapPin className="w-5 h-5 text-zinc-500" />
              <h3 className="text-lg font-semibold text-zinc-900">Top Locations</h3>
            </div>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={locationData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="name" stroke="#9ca3af" />
                  <YAxis stroke="#9ca3af" />
                  <Tooltip />
                  <Bar dataKey="value" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default ResponderAnalytics;
