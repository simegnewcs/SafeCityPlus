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

// Landing Page
import HomePage from "./pages/HomePage";

// Admin Pages
import AdminDashboard from "./pages/AdminDashboard";
import AdminAnalytics from "./pages/AdminAnalytics";
import AdminIncidentLogs from "./pages/AdminIncidentLogs";
import AdminUsers from "./pages/AdminUsers";
import AdminResponders from "./pages/AdminResponders";
import AdminHeatmap from "./pages/AdminHeatmap";
import AdminSettings from "./pages/AdminSettings";
import AdminCCTV from "./pages/AdminCCTV";
import AdminContacts from "./pages/AdminContacts";

// Responder Pages
import ResponderDashboard from "./pages/ResponderDashboard";
import ResponderIncidents from "./pages/ResponderIncidents";
import ResponderCCTV from "./pages/ResponderCCTV";
import ResponderAnalytics from "./pages/ResponderAnalytics";
import ResponderSettings from "./pages/ResponderSettings";

// Super Responder Pages
import SuperResponderDashboard from "./pages/SuperResponderDashboard";
import SuperResponderIncidents from "./pages/SuperResponderIncidents";
import SuperResponderSettings from "./pages/SuperResponderSettings";

function App() {
  const user = JSON.parse(localStorage.getItem("user"));

  return (
    <Router>
      <Routes>
        {/* ================= AUTH ================= */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Navigate to="/login" />} />

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
          path="/admin/contacts"
          element={
            user?.role === "Admin" ? <AdminContacts /> : <Navigate to="/login" />
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
          path="/responder/analytics"
          element={
            user?.role === "Responder" || user?.role === "SuperResponder" ? (
              <ResponderAnalytics />
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

        {/* ================= SUPER RESPONDER ROUTES ================= */}
        <Route
          path="/super-responder/dashboard"
          element={user?.role === "SuperResponder" ? <SuperResponderDashboard /> : <Navigate to="/login" />}
        />
        <Route
          path="/super-responder/incidents"
          element={user?.role === "SuperResponder" ? <SuperResponderIncidents /> : <Navigate to="/login" />}
        />
        <Route
          path="/super-responder/cctv"
          element={user?.role === "SuperResponder" ? <ResponderCCTV /> : <Navigate to="/login" />}
        />
        <Route
          path="/super-responder/analytics"
          element={user?.role === "SuperResponder" ? <ResponderAnalytics /> : <Navigate to="/login" />}
        />
        <Route
          path="/super-responder/settings"
          element={user?.role === "SuperResponder" ? <SuperResponderSettings /> : <Navigate to="/login" />}
        />

        {/* ================= DEFAULT ROUTE ================= */}
        <Route
          path="/"
          element={
            user?.role === "Admin" ? (
              <Navigate to="/admin/dashboard" />
            ) : user?.role === "SuperResponder" ? (
              <Navigate to="/super-responder/dashboard" />
            ) : user?.role === "Responder" ? (
              <Navigate to="/responder/dashboard" />
            ) : (
              <HomePage />
            )
          }
        />

        {/* Catch all invalid URLs */}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Router>
  );
}

export default App;
