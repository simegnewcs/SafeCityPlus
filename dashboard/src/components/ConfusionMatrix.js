// src/components/ConfusionMatrix.js
// Visual confusion matrix for AI performance evaluation

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  BarChart2, RefreshCw, AlertCircle, CheckCircle, 
  XCircle, Target, Activity, Download, RotateCcw,
  Brain, Zap, Shield
} from 'lucide-react';

const API_URL = "http://localhost:5000/api";

const ConfusionMatrix = () => {
  const [matrixData, setMatrixData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('overview'); // overview, matrix, per-class

  // Fetch confusion matrix data
  const fetchMatrix = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await axios.get(`${API_URL}/super-responder/confusion-matrix`, {
        timeout: 10000
      });
      setMatrixData(response.data);
    } catch (err) {
      console.error('Failed to fetch confusion matrix:', err);
      setError('AI service not available or confusion matrix endpoint failed');
    } finally {
      setLoading(false);
    }
  };

  // Reset confusion matrix
  const resetMatrix = async () => {
    if (!window.confirm('Reset all confusion matrix statistics? This cannot be undone.')) {
      return;
    }
    try {
      setLoading(true);
      await axios.post(`${API_URL}/super-responder/confusion-matrix/reset`, {}, {
        timeout: 5000
      });
      await fetchMatrix();
    } catch (err) {
      console.error('Reset failed:', err);
      setError('Failed to reset confusion matrix');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMatrix();
    const interval = setInterval(fetchMatrix, 30000); // Auto-refresh every 30s
    return () => clearInterval(interval);
  }, []);

  // Loading state
  if (loading && !matrixData) {
    return (
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
        <div className="flex items-center justify-center h-48">
          <RefreshCw size={32} className="animate-spin text-indigo-500" />
          <span className="ml-3 text-slate-500">Loading confusion matrix...</span>
        </div>
      </div>
    );
  }

  // Error state
  if (error && !matrixData) {
    return (
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
        <div className="flex items-center text-amber-600 mb-4">
          <AlertCircle size={24} className="mr-2" />
          <h3 className="font-semibold">AI Performance Metrics Unavailable</h3>
        </div>
        <p className="text-slate-500 text-sm mb-4">{error}</p>
        <button 
          onClick={fetchMatrix}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
        >
          <RefreshCw size={16} /> Retry
        </button>
      </div>
    );
  }

  if (!matrixData) return null;

  const { object_detection, alert_classification, recent_alert_accuracy } = matrixData;

  // Binary Alert Confusion Matrix
  const binaryMatrix = [
    { label: 'True Negatives (TN)', value: alert_classification.true_negatives, color: 'bg-emerald-100 text-emerald-700' },
    { label: 'True Positives (TP)', value: alert_classification.true_positives, color: 'bg-emerald-100 text-emerald-700' },
    { label: 'False Positives (FP)', value: alert_classification.false_positives, color: 'bg-rose-100 text-rose-700' },
    { label: 'False Negatives (FN)', value: alert_classification.false_negatives, color: 'bg-rose-100 text-rose-700' }
  ];

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center">
            <Brain size={20} className="text-indigo-600" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900">AI Performance Metrics</h3>
            <p className="text-xs text-slate-500">Confusion Matrix & Detection Accuracy</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={fetchMatrix}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
            title="Refresh"
          >
            <RefreshCw size={18} className={`text-slate-500 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button 
            onClick={resetMatrix}
            className="p-2 hover:bg-rose-50 text-rose-600 rounded-lg transition-colors"
            title="Reset Statistics"
          >
            <RotateCcw size={18} />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-100">
        {[
          { id: 'overview', label: 'Overview', icon: Activity },
          { id: 'matrix', label: 'Alert Matrix', icon: Target },
          { id: 'per-class', label: 'Per-Class Metrics', icon: BarChart2 }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === tab.id 
                ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/50' 
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
            }`}
          >
            <tab.icon size={16} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="p-6">
        {/* OVERVIEW TAB */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Key Metrics Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <MetricCard 
                title="Alert Accuracy" 
                value={`${(alert_classification.accuracy * 100).toFixed(1)}%`}
                subtitle={`${alert_classification.total} samples`}
                icon={CheckCircle}
                color="indigo"
                trend={recent_alert_accuracy ? `Last 50: ${(recent_alert_accuracy * 100).toFixed(1)}%` : null}
              />
              <MetricCard 
                title="Precision" 
                value={`${(alert_classification.precision * 100).toFixed(1)}%`}
                subtitle="Correct alerts / All alerts"
                icon={Target}
                color="emerald"
              />
              <MetricCard 
                title="Recall (Sensitivity)" 
                value={`${(alert_classification.recall * 100).toFixed(1)}%`}
                subtitle="Detected emergencies / All emergencies"
                icon={Zap}
                color="amber"
              />
              <MetricCard 
                title="F1 Score" 
                value={`${(alert_classification.f1_score * 100).toFixed(1)}%`}
                subtitle="Precision & Recall balance"
                icon={Shield}
                color="purple"
              />
            </div>

            {/* False Alarm Rate */}
            <div className="bg-slate-50 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-slate-700">False Alarm Rate</span>
                <span className="text-sm font-bold text-rose-600">
                  {(alert_classification.false_alarm_rate * 100).toFixed(1)}%
                </span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-2">
                <div 
                  className="bg-rose-500 h-2 rounded-full transition-all"
                  style={{ width: `${alert_classification.false_alarm_rate * 100}%` }}
                />
              </div>
              <p className="text-xs text-slate-500 mt-2">
                Percentage of normal scenes incorrectly flagged as emergencies
              </p>
            </div>

            {/* Detection Rate */}
            <div className="bg-slate-50 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-slate-700">Emergency Detection Rate</span>
                <span className="text-sm font-bold text-emerald-600">
                  {(alert_classification.detection_rate * 100).toFixed(1)}%
                </span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-2">
                <div 
                  className="bg-emerald-500 h-2 rounded-full transition-all"
                  style={{ width: `${alert_classification.detection_rate * 100}%` }}
                />
              </div>
              <p className="text-xs text-slate-500 mt-2">
                Percentage of actual emergencies correctly detected by AI
              </p>
            </div>
          </div>
        )}

        {/* ALERT MATRIX TAB */}
        {activeTab === 'matrix' && (
          <div className="space-y-6">
            <h4 className="font-medium text-slate-800">Binary Alert Classification Matrix</h4>
            
            {/* 2x2 Confusion Matrix Visualization */}
            <div className="grid grid-cols-2 gap-3 max-w-md mx-auto">
              {/* Header row */}
              <div className="col-span-2 grid grid-cols-2 text-center text-xs font-semibold text-slate-500">
                <div className="p-2">PREDICTED: NORMAL</div>
                <div className="p-2">PREDICTED: ALERT</div>
              </div>
              
              {/* ACTUAL: Normal row */}
              <div className="relative">
                <div className="absolute -left-8 top-1/2 -translate-y-1/2 -rotate-90 text-xs font-semibold text-slate-500 whitespace-nowrap">
                  ACTUAL: NORMAL
                </div>
                <div className="bg-emerald-50 border-2 border-emerald-200 rounded-xl p-4 text-center">
                  <div className="text-3xl font-bold text-emerald-700">{alert_classification.true_negatives}</div>
                  <div className="text-xs text-emerald-600 mt-1">True Negatives (TN)</div>
                  <div className="text-xs text-slate-500 mt-1">Correctly ignored</div>
                </div>
              </div>
              <div className="relative">
                <div className="bg-rose-50 border-2 border-rose-200 rounded-xl p-4 text-center">
                  <div className="text-3xl font-bold text-rose-700">{alert_classification.false_positives}</div>
                  <div className="text-xs text-rose-600 mt-1">False Positives (FP)</div>
                  <div className="text-xs text-slate-500 mt-1">False alarms</div>
                </div>
              </div>
              
              {/* ACTUAL: Alert row */}
              <div className="relative">
                <div className="absolute -left-8 top-1/2 -translate-y-1/2 -rotate-90 text-xs font-semibold text-slate-500 whitespace-nowrap">
                  ACTUAL: ALERT
                </div>
                <div className="bg-rose-50 border-2 border-rose-200 rounded-xl p-4 text-center">
                  <div className="text-3xl font-bold text-rose-700">{alert_classification.false_negatives}</div>
                  <div className="text-xs text-rose-600 mt-1">False Negatives (FN)</div>
                  <div className="text-xs text-slate-500 mt-1">Missed emergencies</div>
                </div>
              </div>
              <div className="bg-emerald-50 border-2 border-emerald-200 rounded-xl p-4 text-center">
                <div className="text-3xl font-bold text-emerald-700">{alert_classification.true_positives}</div>
                <div className="text-xs text-emerald-600 mt-1">True Positives (TP)</div>
                <div className="text-xs text-slate-500 mt-1">Correctly detected</div>
              </div>
            </div>

            {/* Matrix Legend */}
            <div className="bg-slate-50 rounded-xl p-4 text-sm">
              <h5 className="font-medium text-slate-700 mb-2">Understanding the Matrix</h5>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex items-start gap-2">
                  <CheckCircle size={14} className="text-emerald-500 mt-0.5" />
                  <span className="text-slate-600"><strong>TP:</strong> AI correctly detected an emergency</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle size={14} className="text-emerald-500 mt-0.5" />
                  <span className="text-slate-600"><strong>TN:</strong> AI correctly ignored normal scene</span>
                </div>
                <div className="flex items-start gap-2">
                  <XCircle size={14} className="text-rose-500 mt-0.5" />
                  <span className="text-slate-600"><strong>FP:</strong> AI false alarm (said emergency, wasn't)</span>
                </div>
                <div className="flex items-start gap-2">
                  <XCircle size={14} className="text-rose-500 mt-0.5" />
                  <span className="text-slate-600"><strong>FN:</strong> AI missed emergency (said normal, was emergency)</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* PER-CLASS TAB */}
        {activeTab === 'per-class' && object_detection?.per_class_metrics && (
          <div className="space-y-4">
            <h4 className="font-medium text-slate-800">Object Detection Performance by Class</h4>
            <p className="text-sm text-slate-500">
              Based on IoU threshold of 0.5. Metrics for {object_detection.class_names?.length || 0} classes.
            </p>
            
            {/* Class metrics table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="px-4 py-3 text-left font-medium text-slate-600">Class</th>
                    <th className="px-4 py-3 text-center font-medium text-slate-600">Precision</th>
                    <th className="px-4 py-3 text-center font-medium text-slate-600">Recall</th>
                    <th className="px-4 py-3 text-center font-medium text-slate-600">F1 Score</th>
                    <th className="px-4 py-3 text-center font-medium text-slate-600">Samples</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {object_detection.per_class_metrics.map((cls, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-800 capitalize">
                        {cls.class}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-block px-2 py-1 rounded-full text-xs font-semibold ${
                          cls.precision >= 0.8 ? 'bg-emerald-100 text-emerald-700' :
                          cls.precision >= 0.6 ? 'bg-amber-100 text-amber-700' :
                          'bg-rose-100 text-rose-700'
                        }`}>
                          {(cls.precision * 100).toFixed(1)}%
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-block px-2 py-1 rounded-full text-xs font-semibold ${
                          cls.recall >= 0.8 ? 'bg-emerald-100 text-emerald-700' :
                          cls.recall >= 0.6 ? 'bg-amber-100 text-amber-700' :
                          'bg-rose-100 text-rose-700'
                        }`}>
                          {(cls.recall * 100).toFixed(1)}%
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-block px-2 py-1 rounded-full text-xs font-semibold ${
                          cls.f1_score >= 0.8 ? 'bg-emerald-100 text-emerald-700' :
                          cls.f1_score >= 0.6 ? 'bg-amber-100 text-amber-700' :
                          'bg-rose-100 text-rose-700'
                        }`}>
                          {(cls.f1_score * 100).toFixed(1)}%
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center text-slate-500">
                        {cls.total_ground_truths || 0}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Overall object detection metrics */}
            {object_detection?.overall && (
              <div className="bg-slate-50 rounded-xl p-4 mt-4">
                <h5 className="font-medium text-slate-700 mb-2">Overall Object Detection</h5>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <div className="text-2xl font-bold text-indigo-600">
                      {(object_detection.overall.micro_precision * 100).toFixed(1)}%
                    </div>
                    <div className="text-xs text-slate-500">Micro Precision</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-indigo-600">
                      {(object_detection.overall.micro_recall * 100).toFixed(1)}%
                    </div>
                    <div className="text-xs text-slate-500">Micro Recall</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-indigo-600">
                      {(object_detection.overall.micro_f1 * 100).toFixed(1)}%
                    </div>
                    <div className="text-xs text-slate-500">Micro F1</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer timestamp */}
      <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 text-xs text-slate-400 flex items-center justify-between">
        <span>Last updated: {new Date(matrixData.timestamp).toLocaleString()}</span>
        <span className="flex items-center gap-1">
          <Activity size={12} />
          Auto-refresh every 30s
        </span>
      </div>
    </div>
  );
};

// Metric Card Component
const MetricCard = ({ title, value, subtitle, icon: Icon, color, trend }) => {
  const colorClasses = {
    indigo: 'bg-indigo-50 text-indigo-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    amber: 'bg-amber-50 text-amber-600',
    purple: 'bg-purple-50 text-purple-600',
    rose: 'bg-rose-50 text-rose-600'
  };

  return (
    <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
      <div className="flex items-center gap-2 mb-2">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${colorClasses[color]}`}>
          <Icon size={16} />
        </div>
        <span className="text-xs font-medium text-slate-500">{title}</span>
      </div>
      <div className="text-2xl font-bold text-slate-800">{value}</div>
      <div className="text-xs text-slate-400 mt-1">{subtitle}</div>
      {trend && (
        <div className="text-xs text-slate-500 mt-2 bg-white px-2 py-1 rounded border border-slate-100 inline-block">
          {trend}
        </div>
      )}
    </div>
  );
};

export default ConfusionMatrix;
