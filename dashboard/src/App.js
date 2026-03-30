// src/App.js
import React from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";

// Auth Pages
import Login from "./auth/Login";
import Register from "./auth/Register";

// Admin Pages
import AdminDashboard from "./pages/AdminDashboard";
import AdminAnalytics from "./pages/AdminAnalytics";
import AdminIncidentLogs from "./pages/AdminIncidentLogs";
import AdminUsers from "./pages/AdminUsers";
import AdminResponders from "./pages/AdminResponders";
import AdminHeatmap from "./pages/AdminHeatmap";
import AdminSettings from "./pages/AdminSettings";
import AdminCCTV from "./pages/AdminCCTV";

// Responder Pages
import ResponderDashboard from "./pages/ResponderDashboard";
import ResponderIncidents from "./pages/ResponderIncidents";
import ResponderCCTV from "./pages/ResponderCCTV";
import ResponderSettings from "./pages/ResponderSettings";

function App() {
  const user = JSON.parse(localStorage.getItem("user"));

  return (
    <Router>
      <Routes>
        {/* ================= AUTH ================= */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* 🔥 Redirect old admin route */}
        <Route
          path="/admin-dashboard"
          element={<Navigate to="/admin/dashboard" />}
        />

        {/* ================= ADMIN ROUTES ================= */}
        <Route
          path="/admin/dashboard"
          element={
            user?.role === "Admin" ? (
              <AdminDashboard />
            ) : (
              <Navigate to="/login" />
            )
          }
        />
        <Route
          path="/admin/analytics"
          element={
            user?.role === "Admin" ? (
              <AdminAnalytics />
            ) : (
              <Navigate to="/login" />
            )
          }
        />
        <Route
          path="/admin/incidents"
          element={
            user?.role === "Admin" ? (
              <AdminIncidentLogs />
            ) : (
              <Navigate to="/login" />
            )
          }
        />
        <Route
          path="/admin/users"
          element={
            user?.role === "Admin" ? <AdminUsers /> : <Navigate to="/login" />
          }
        />
        <Route
          path="/admin/responders"
          element={
            user?.role === "Admin" ? (
              <AdminResponders />
            ) : (
              <Navigate to="/login" />
            )
          }
        />
        <Route
          path="/admin/heatmap"
          element={
            user?.role === "Admin" ? <AdminHeatmap /> : <Navigate to="/login" />
          }
        />
        <Route
          path="/admin/cctv"
          element={
            user?.role === "Admin" ? <AdminCCTV /> : <Navigate to="/login" />
          }
        />
        <Route
          path="/admin/settings"
          element={
            user?.role === "Admin" ? (
              <AdminSettings />
            ) : (
              <Navigate to="/login" />
            )
          }
        />

        {/* ================= RESPONDER ROUTES ================= */}
        <Route
          path="/responder/dashboard"
          element={
            user?.role === "Responder" ? (
              <ResponderDashboard />
            ) : (
              <Navigate to="/login" />
            )
          }
        />
        <Route
          path="/responder/incidents"
          element={
            user?.role === "Responder" ? (
              <ResponderIncidents />
            ) : (
              <Navigate to="/login" />
            )
          }
        />
        <Route
          path="/responder/cctv"
          element={
            user?.role === "Responder" ? (
              <ResponderCCTV />
            ) : (
              <Navigate to="/login" />
            )
          }
        />
        <Route
          path="/responder/settings"
          element={
            user?.role === "Responder" ? (
              <ResponderSettings />
            ) : (
              <Navigate to="/login" />
            )
          }
        />

        {/* ================= DEFAULT ROUTE ================= */}
        <Route
          path="/"
          element={
            <Navigate
              to={
                user?.role === "Admin"
                  ? "/admin/dashboard"
                  : "/responder/dashboard"
              }
            />
          }
        />

        {/* Catch all invalid URLs */}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Router>
  );
}

export default App;
