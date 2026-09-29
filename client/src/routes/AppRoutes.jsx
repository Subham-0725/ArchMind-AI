// src/routes/AppRoutes.jsx
import { Routes, Route, Navigate } from "react-router-dom";
import LandingPage from "../pages/LandingPage";
import Dashboard from "../pages/Dashboard";
import ProjectWorkspace from "../pages/ProjectWorkspace";
import PrivateRoute from "./PrivateRoute";
import PublicOnlyRoute from "./PublicOnlyRoute";

export default function AppRoutes() {
  return (
    <Routes>
      {/*
       * PUBLIC-ONLY ROUTES
       * Authenticated users are redirected to /dashboard.
       */}
      <Route
        path="/"
        element={
          <PublicOnlyRoute>
            <LandingPage />
          </PublicOnlyRoute>
        }
      />

      {/*
       * PRIVATE ROUTES
       * Unauthenticated users are redirected to /sign-in.
       */}
      <Route
        path="/dashboard"
        element={
          <PrivateRoute>
            <Dashboard />
          </PrivateRoute>
        }
      />

      <Route
        path="/project/:id"
        element={
          <PrivateRoute>
            <ProjectWorkspace />
          </PrivateRoute>
        }
      />

      {/* Catch-all — send unknown URLs back to the root */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
