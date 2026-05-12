import React from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { Toaster } from "react-hot-toast";

import { AuthProvider }  from "./hooks/useAuth";
import { WalletProvider } from "./hooks/useWallet";

import PrivateRoute   from "./router/PrivateRoute";
import PublicRoute    from "./router/PublicRoute";
import AuthLayout     from "./layouts/AuthLayout";
import DashboardLayout from "./layouts/DashboardLayout";

// Auth pages
import LoginPage    from "./pages/auth/LoginPage";
import RegisterPage from "./pages/auth/RegisterPage";

// Dashboard pages (lazy loaded)
import { lazy, Suspense } from "react";

const ProducerDashboard  = lazy(() => import("./pages/producer/ProducerDashboard"));
const ProducerListings   = lazy(() => import("./pages/producer/ProducerListings"));
const ProducerBids       = lazy(() => import("./pages/producer/ProducerBids"));
const ProducerDevices    = lazy(() => import("./pages/producer/ProducerDevices"));
const ProducerTrades     = lazy(() => import("./pages/producer/ProducerTrades"));

const ConsumerDashboard  = lazy(() => import("./pages/consumer/ConsumerDashboard"));
const ConsumerMarket     = lazy(() => import("./pages/consumer/ConsumerMarket"));
const ConsumerBids       = lazy(() => import("./pages/consumer/ConsumerBids"));
const ConsumerTrades     = lazy(() => import("./pages/consumer/ConsumerTrades"));

const AdminDashboard     = lazy(() => import("./pages/admin/AdminDashboard"));
const AdminUsers         = lazy(() => import("./pages/admin/AdminUsers"));
const AdminTransactions  = lazy(() => import("./pages/admin/AdminTransactions"));
const AdminFraud         = lazy(() => import("./pages/admin/AdminFraud"));
const AdminApprovals     = lazy(() => import("./pages/admin/AdminApprovals"));
const AdminAuditLogs     = lazy(() => import("./pages/admin/AdminAuditLogs"));
const AdminSettings      = lazy(() => import("./pages/admin/AdminSettings"));

const WalletPage         = lazy(() => import("./pages/settings/WalletPage"));
const ProfilePage        = lazy(() => import("./pages/settings/ProfilePage"));
const AutoTradePage      = lazy(() => import("./pages/settings/AutoTradePage"));
const AlertsPage         = lazy(() => import("./pages/settings/AlertsPage"));


// Add lazy imports
const ProducerCharts = lazy(() => import("./pages/producer/ProducerCharts"));
const ConsumerCharts = lazy(() => import("./pages/consumer/ConsumerCharts"));
const AdminCharts    = lazy(() => import("./pages/admin/AdminCharts"));


// Loading fallback
const PageLoader = () => (
  <div className="flex items-center justify-center h-64">
    <div className="flex flex-col items-center gap-3">
      <span className="text-2xl animate-spin">⚡</span>
      <p className="font-mono text-xs text-muted">LOADING…</p>
    </div>
  </div>
);

export default function App() {
  return (
    <AuthProvider>
      <WalletProvider>
        <BrowserRouter>
          
          <Toaster
            position="bottom-right"
            toastOptions={{
              style: {
                background: "#0f1217",
                color:      "#d4dce8",
                border:     "1px solid #1e2530",
                fontFamily: "'Share Tech Mono', monospace",
                fontSize:   "0.8rem",
                borderRadius: "6px",
              },
              success: {
                iconTheme: { primary: "#00ff88", secondary: "#0f1217" },
              },
              error: {
                iconTheme: { primary: "#ff5050", secondary: "#0f1217" },
              },
            }}
          />

          <Routes>

            {/* ── Public Auth Routes ──────────────────────────────── */}

            <Route
                path="/producer/analytics"
                element={
                  <PrivateRoute role="producer">
                    <Suspense fallback={<PageLoader />}>
                      <ProducerCharts />
                    </Suspense>
                  </PrivateRoute>
                }
              />

              <Route
                path="/consumer/analytics"
                element={
                  <PrivateRoute role="consumer">
                    <Suspense fallback={<PageLoader />}>
                      <ConsumerCharts />
                    </Suspense>
                  </PrivateRoute>
                }
              />

            <Route
              path="/admin/analytics"
              element={
                <PrivateRoute role="admin">
                  <Suspense fallback={<PageLoader />}>
                    <AdminCharts />
                  </Suspense>
                </PrivateRoute>
              }
            />
            <Route element={<AuthLayout />}>
              <Route
                path="/login"
                element={
                  <PublicRoute>
                    <LoginPage />
                  </PublicRoute>
                }
              />
              <Route
                path="/register"
                element={
                  <PublicRoute>
                    <RegisterPage />
                  </PublicRoute>
                }
              />
            </Route>

            {/* ── Dashboard Routes ────────────────────────────────── */}
            <Route
              element={
                <PrivateRoute>
                  <DashboardLayout />
                </PrivateRoute>
              }
            >
              {/* Producer */}
              <Route
                path="/producer"
                element={
                  <PrivateRoute role="producer">
                    <Suspense fallback={<PageLoader />}>
                      <ProducerDashboard />
                    </Suspense>
                  </PrivateRoute>
                }
              />
              <Route
                path="/producer/listings"
                element={
                  <PrivateRoute role="producer">
                    <Suspense fallback={<PageLoader />}>
                      <ProducerListings />
                    </Suspense>
                  </PrivateRoute>
                }
              />
              <Route
                path="/producer/bids"
                element={
                  <PrivateRoute role="producer">
                    <Suspense fallback={<PageLoader />}>
                      <ProducerBids />
                    </Suspense>
                  </PrivateRoute>
                }
              />
              <Route
                path="/producer/devices"
                element={
                  <PrivateRoute role="producer">
                    <Suspense fallback={<PageLoader />}>
                      <ProducerDevices />
                    </Suspense>
                  </PrivateRoute>
                }
              />
              <Route
                path="/producer/trades"
                element={
                  <PrivateRoute role="producer">
                    <Suspense fallback={<PageLoader />}>
                      <ProducerTrades />
                    </Suspense>
                  </PrivateRoute>
                }
              />

              {/* Consumer */}
              <Route
                path="/consumer"
                element={
                  <PrivateRoute role="consumer">
                    <Suspense fallback={<PageLoader />}>
                      <ConsumerDashboard />
                    </Suspense>
                  </PrivateRoute>
                }
              />
              <Route
                path="/consumer/market"
                element={
                  <PrivateRoute role="consumer">
                    <Suspense fallback={<PageLoader />}>
                      <ConsumerMarket />
                    </Suspense>
                  </PrivateRoute>
                }
              />
              <Route
                path="/consumer/bids"
                element={
                  <PrivateRoute role="consumer">
                    <Suspense fallback={<PageLoader />}>
                      <ConsumerBids />
                    </Suspense>
                  </PrivateRoute>
                }
              />
              <Route
                path="/consumer/trades"
                element={
                  <PrivateRoute role="consumer">
                    <Suspense fallback={<PageLoader />}>
                      <ConsumerTrades />
                    </Suspense>
                  </PrivateRoute>
                }
              />

              {/* Admin */}
              <Route
                path="/admin"
                element={
                  <PrivateRoute role="admin">
                    <Suspense fallback={<PageLoader />}>
                      <AdminDashboard />
                    </Suspense>
                  </PrivateRoute>
                }
              />
              <Route
                path="/admin/users"
                element={
                  <PrivateRoute role="admin">
                    <Suspense fallback={<PageLoader />}>
                      <AdminUsers />
                    </Suspense>
                  </PrivateRoute>
                }
              />
              <Route
                path="/admin/transactions"
                element={
                  <PrivateRoute role="admin">
                    <Suspense fallback={<PageLoader />}>
                      <AdminTransactions />
                    </Suspense>
                  </PrivateRoute>
                }
              />
              <Route
                path="/admin/fraud"
                element={
                  <PrivateRoute role="admin">
                    <Suspense fallback={<PageLoader />}>
                      <AdminFraud />
                    </Suspense>
                  </PrivateRoute>
                }
              />
              <Route
                path="/admin/approvals"
                element={
                  <PrivateRoute role="admin">
                    <Suspense fallback={<PageLoader />}>
                      <AdminApprovals />
                    </Suspense>
                  </PrivateRoute>
                }
              />
              <Route
                path="/admin/audit-logs"
                element={
                  <PrivateRoute role="admin">
                    <Suspense fallback={<PageLoader />}>
                      <AdminAuditLogs />
                    </Suspense>
                  </PrivateRoute>
                }
              />
              <Route
                path="/admin/settings"
                element={
                  <PrivateRoute role="admin">
                    <Suspense fallback={<PageLoader />}>
                      <AdminSettings />
                    </Suspense>
                  </PrivateRoute>
                }
              />

              {/* Shared Settings */}
              <Route
                path="/wallet"
                element={
                  <Suspense fallback={<PageLoader />}>
                    <WalletPage />
                  </Suspense>
                }
              />
              <Route
                path="/profile"
                element={
                  <Suspense fallback={<PageLoader />}>
                    <ProfilePage />
                  </Suspense>
                }
              />
              <Route
                path="/settings/auto-trade"
                element={
                  <Suspense fallback={<PageLoader />}>
                    <AutoTradePage />
                  </Suspense>
                }
              />
              <Route
                path="/settings/alerts"
                element={
                  <Suspense fallback={<PageLoader />}>
                    <AlertsPage />
                  </Suspense>
                }
              />
            </Route>

            {/* ── Fallback ─────────────────────────────────────────── */}
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="*" element={<Navigate to="/login" replace />} />

          </Routes>
        </BrowserRouter>
      </WalletProvider>
    </AuthProvider>
  );
}