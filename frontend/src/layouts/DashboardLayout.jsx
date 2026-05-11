import React, { useState } from "react";
import { Outlet }          from "react-router-dom";
import Navbar              from "../components/Navbar";
import Sidebar             from "../components/Sidebar";
import BroadcastBanner     from "../components/BroadcastBanner";
import "./DashboardLayout.css";

export default function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <div className="dashboard-layout">
      <BroadcastBanner />
      <Navbar onToggleSidebar={() => setSidebarOpen(o => !o)} />
      <div className="dashboard-body">
        <Sidebar open={sidebarOpen} />
        <main className={`dashboard-main ${sidebarOpen ? "sidebar-open" : "sidebar-closed"}`}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}