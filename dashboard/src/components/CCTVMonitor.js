import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_URL = 'http://192.168.137.1:5000/api';

const CCTVMonitor = () => {
  const [cameras, setCameras] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [selectedCamera, setSelectedCamera] = useState(null);

  useEffect(() => {
    fetchCameras();
    fetchAlerts();
    
    // Auto-refresh every 10 seconds
    const interval = setInterval(() => {
      fetchCameras();
      fetchAlerts();
    }, 10000);
    
    return () => clearInterval(interval);
  }, []);

  const fetchCameras = async () => {
    try {
      const response = await axios.get(`${API_URL}/cctv/cameras`);
      setCameras(response.data);
    } catch (error) {
      console.error('Error fetching cameras:', error);
    }
  };

  const fetchAlerts = async () => {
    try {
      const response = await axios.get(`${API_URL}/cctv/alerts`);
      setAlerts(response.data);
    } catch (error) {
      console.error('Error fetching alerts:', error);
    }
  };

  const updateCameraStatus = async (id, status) => {
    try {
      await axios.put(`${API_URL}/cctv/cameras/${id}/status`, { status });
      fetchCameras();
    } catch (error) {
      console.error('Error updating camera:', error);
    }
  };

  return (
    <div className="cctv-monitor">
      <div className="dashboard-header">
        <h2>CCTV Monitoring Dashboard</h2>
        <div className="stats">
          <div className="stat">
            <span className="stat-value">{cameras.length}</span>
            <span className="stat-label">Total Cameras</span>
          </div>
          <div className="stat">
            <span className="stat-value">{cameras.filter(c => c.status === 'active').length}</span>
            <span className="stat-label">Active</span>
          </div>
          <div className="stat">
            <span className="stat-value">{alerts.filter(a => !a.is_viewed).length}</span>
            <span className="stat-label">New Alerts</span>
          </div>
        </div>
      </div>

      <div className="alerts-panel">
        <h3>Recent Alerts</h3>
        <div className="alerts-list">
          {alerts.slice(0, 10).map(alert => (
            <div key={alert.id} className={`alert-item ${!alert.is_viewed ? 'unread' : ''}`}>
              <div className="alert-icon">⚠️</div>
              <div className="alert-content">
                <div className="alert-title">{alert.incident_type || 'Motion Detected'}</div>
                <div className="alert-details">
                  {alert.camera_name} • {new Date(alert.created_at).toLocaleString()}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="cameras-grid">
        {cameras.map(camera => (
          <div key={camera.id} className={`camera-card ${camera.status}`}>
            <div className="camera-header">
              <h4>{camera.camera_name}</h4>
              <span className={`status-badge ${camera.status}`}>
                {camera.status}
              </span>
            </div>
            <div className="camera-preview">
              {camera.status === 'active' ? (
                <video
                  src={camera.stream_url}
                  autoPlay
                  muted
                  loop
                  style={{ width: '100%', height: 'auto' }}
                />
              ) : (
                <div className="offline-placeholder">
                  <span>📹 Camera Offline</span>
                </div>
              )}
            </div>
            <div className="camera-info">
              <div>📍 {camera.camera_location}</div>
              <div>📊 {camera.resolution}</div>
              <div>🎥 {camera.recording_count || 0} recordings</div>
            </div>
            <div className="camera-controls">
              <select
                value={camera.status}
                onChange={(e) => updateCameraStatus(camera.id, e.target.value)}
              >
                <option value="active">Active</option>
                <option value="maintenance">Maintenance</option>
                <option value="inactive">Inactive</option>
              </select>
              <button onClick={() => setSelectedCamera(camera)}>View Details</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CCTVMonitor;