import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './auth/Login';
import Register from './auth/Register';
import AdminDashboard from './pages/AdminDashboard';
import ResponderDashboard from './pages/ResponderDashboard';

function App() {
  const user = JSON.parse(localStorage.getItem('user'));

  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* Admin Route */}
        <Route 
          path="/admin-dashboard" 
          element={user?.role === 'Admin' ? <AdminDashboard /> : <Navigate to="/login" />} 
        />

        {/* Responder Route */}
        <Route 
          path="/responder-dashboard" 
          element={user?.role === 'Responder' ? <ResponderDashboard /> : <Navigate to="/login" />} 
        />

        {/* Default Route */}
        <Route path="/" element={<Navigate to="/login" />} />
      </Routes>
    </Router>
  );
}

export default App;