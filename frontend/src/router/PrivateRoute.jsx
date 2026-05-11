import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

export default function PrivateRoute({ children, role }) {
  const { user, loading } = useAuth();
  const location          = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <span className="text-3xl animate-spin">⚡</span>
          <p className="font-mono text-xs text-muted tracking-widest">
            LOADING…
          </p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Role check
  if (role) {
    const allowed =
      role === "admin"    ? (user.role === "admin" || user.is_staff) :
      role === "producer" ? (user.role === "producer" || user.role === "both") :
      role === "consumer" ? (user.role === "consumer" || user.role === "both") :
      true;

    if (!allowed) {
      // Redirect to their correct dashboard
      const redirect =
        user.role === "admin"    ? "/admin"    :
        user.role === "producer" ? "/producer" : "/consumer";
      return <Navigate to={redirect} replace />;
    } 
  }

  return children;
}