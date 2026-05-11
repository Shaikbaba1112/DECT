import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

export default function PublicRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) return null;

  if (user) {
    const redirect =
      user.role === "admin"    ? "/admin"    :
      user.role === "producer" ? "/producer" : "/consumer";
    return <Navigate to={redirect} replace />;
  }

  return children;
}