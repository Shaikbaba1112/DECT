import axios from "axios";

const BASE_URL = process.env.REACT_APP_API_URL || "http://localhost:8000";

const api = axios.create({
  baseURL: BASE_URL,
  headers: { "Content-Type": "application/json" },
});

// ── Request interceptor — attach token ────────────────────────────────────
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("access_token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ── Response interceptor — silent token refresh ───────────────────────────
let isRefreshing = false;
let failedQueue  = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach(prom => {
    if (error) prom.reject(error);
    else       prom.resolve(token);
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;

    if (
      error.response?.status === 401 &&
      !original._retry &&
      !original.url?.includes("/auth/login") &&
      !original.url?.includes("/auth/token/refresh")
    ) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then(token => {
          original.headers.Authorization = `Bearer ${token}`;
          return api(original);
        }).catch(err => Promise.reject(err));
      }

      original._retry  = true;
      isRefreshing     = true;

      const refresh = localStorage.getItem("refresh_token");

      if (!refresh) {
        isRefreshing = false;
        localStorage.clear();
        window.location.href = "/login";
        return Promise.reject(error);
      }

      try {
        const res = await axios.post(`${BASE_URL}/auth/token/refresh/`, {
          refresh,
        });

        const newAccess = res.data.access;
        localStorage.setItem("access_token", newAccess);
        if (res.data.refresh) {
          localStorage.setItem("refresh_token", res.data.refresh);
        }

        api.defaults.headers.Authorization = `Bearer ${newAccess}`;
        original.headers.Authorization     = `Bearer ${newAccess}`;

        processQueue(null, newAccess);
        return api(original);
      } catch (refreshError) {
        processQueue(refreshError, null);
        localStorage.clear();
        window.location.href = "/login";
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default api;

// ─────────────────────────────────────────────────────────────────────────────
//  Auth
// ─────────────────────────────────────────────────────────────────────────────

export const authAPI = {
  register:       (data)   => api.post("/auth/register/", data),
  login:          (data)   => api.post("/auth/login/", data),
  logout:         (refresh)=> api.post("/auth/logout/", { refresh }),
  me:             ()       => api.get("/auth/me/"),
  profile:        ()       => api.get("/auth/profile/"),
  updateProfile:  (data)   => api.patch("/auth/profile/", data),
  changePassword: (data)   => api.post("/auth/change-password/", data),
  connectWallet:  (addr)   => api.post("/auth/connect-wallet/", {
    wallet_address: addr,
  }),
  refreshToken:   (refresh)=> api.post("/auth/token/refresh/", { refresh }),
  unlinkWallet: () => api.post("/auth/unlink-wallet/"),
};

// ─────────────────────────────────────────────────────────────────────────────
//  Market
// ─────────────────────────────────────────────────────────────────────────────

export const marketAPI = {
  getListings:    (params) => api.get("/api/market/listings/", { params }),
  getStats:       ()       => api.get("/api/market/stats/"),
  getPrice:       (id)     => api.get(`/api/market/price/?listing_id=${id}`),
  getHistory:     ()       => api.get("/api/market/history/"),
  placeBid:       (data)   => api.post("/api/market/bid/", data),
  syncListing:    (id)     => api.post("/api/listings/sync/", {
    listing_id: id,
  }),
  syncTransaction: (data)  => api.post("/api/trades/sync/", data),
};

// ─────────────────────────────────────────────────────────────────────────────
//  Producer
// ─────────────────────────────────────────────────────────────────────────────

export const producerAPI = {
  // Listings
  getListings:    (params) => api.get("/api/producer/listings/", { params }),
  createListing:  (data)   => api.post("/api/producer/listings/create/", data),
  updateListing:  (id, data)=> api.patch(`/api/producer/listings/${id}/`, data),
  cancelListing:  (id)     => api.post(`/api/producer/listings/${id}/cancel/`),
  pauseAll:       ()       => api.post("/api/producer/listings/pause-all/"),

  // Bids
  getBids:        (params) => api.get("/api/producer/bids/", { params }),
  respondBid:     (id, data)=> api.post(`/api/producer/bids/${id}/respond/`, data),

  // Devices
  getDevices:     ()       => api.get("/api/producer/devices/"),
  registerDevice: (data)   => api.post("/api/producer/devices/register/", data),
  updateDevice:   (id, data)=> api.patch(`/api/producer/devices/${id}/`, data),
  deleteDevice:   (id)     => api.delete(`/api/producer/devices/${id}/`),

  // Stats
  getStats:       ()       => api.get("/api/producer/stats/"),

  // Trades
 
  getTrades:      ()       => api.get("/api/trades/"),  
};

// ─────────────────────────────────────────────────────────────────────────────
//  Consumer
// ─────────────────────────────────────────────────────────────────────────────

export const consumerAPI = {
  getBids:        (params) => api.get("/api/consumer/bids/", { params }),
  getTrades:      ()       => api.get("/api/trades/"),
  getStats:       ()       => api.get("/api/consumer/stats/"),
};

// ─────────────────────────────────────────────────────────────────────────────
//  Wallet
// ─────────────────────────────────────────────────────────────────────────────

export const walletAPI = {
  getWallet:        ()     => api.get("/api/wallet/"),
  getTransactions:  (params)=> api.get("/api/wallet/transactions/", { params }),
  withdraw:         (data) => api.post("/api/wallet/withdraw/", data),
  topUp:            (data) => api.post("/api/wallet/topup/", data),
  claimRewards:     ()     => api.post("/api/wallet/claim-rewards/"),
};

// ─────────────────────────────────────────────────────────────────────────────
//  Settings
// ─────────────────────────────────────────────────────────────────────────────

export const settingsAPI = {
  getAutoTrade:     ()     => api.get("/api/settings/auto-trade/"),
  updateAutoTrade:  (data) => api.patch("/api/settings/auto-trade/", data),
  getAlerts:        ()     => api.get("/api/settings/alerts/"),
  createAlert:      (data) => api.post("/api/settings/alerts/", data),
  updateAlert:      (id, data) => api.patch(`/api/settings/alerts/${id}/`, data),
  deleteAlert:      (id)   => api.delete(`/api/settings/alerts/${id}/`),
};

// ─────────────────────────────────────────────────────────────────────────────
//  Admin
// ─────────────────────────────────────────────────────────────────────────────

export const adminAPI = {
  // Overview
  getOverview:      ()     => api.get("/api/admin-api/overview/"),

  // Users
  getUsers:         (params)=> api.get("/api/admin-api/users/", { params }),
  getUser:          (id)   => api.get(`/api/admin-api/users/${id}/`),
  suspendUser:      (id, data) => api.post(
    `/api/admin-api/users/${id}/suspend/`, data
  ),
  approveProducer:  (id, data) => api.post(
    `/api/admin-api/users/${id}/approve/`, data
  ),
  getPendingApprovals: ()  => api.get("/api/admin-api/approvals/"),

  // Listings + Transactions
  getAllListings:    (params)=> api.get("/api/admin-api/listings/", { params }),
  getAllTransactions:(params)=> api.get(
    "/api/admin-api/transactions/", { params }
  ),
  getParticipants:  ()     => api.get("/api/admin-api/participants/"),

  // Fraud
  getFraud:         (params)=> api.get("/api/admin-api/fraud/", { params }),
  reviewFraud:      (id, data)=> api.post(
    `/api/admin-api/fraud/${id}/review/`, data
  ),
  banWallet:        (id)   => api.post(`/api/admin-api/fraud/${id}/ban/`),

  // System
  pause:            (data) => api.post("/api/admin-api/system/pause/", data),
  resume:           ()     => api.post("/api/admin-api/system/resume/"),
  getStatus:        ()     => api.get("/api/admin-api/system/status/"),

  // Audit
  getAuditLogs:     (params)=> api.get(
    "/api/admin-api/audit-logs/", { params }
  ),

  // Broadcast
  getBroadcasts:    ()     => api.get("/api/admin-api/broadcast/"),
  sendBroadcast:    (data) => api.post("/api/admin-api/broadcast/", data),

  // Pricing
  getPricingConfig: ()     => api.get("/api/admin-api/pricing-config/"),
  updatePricingConfig:(data)=> api.patch(
    "/api/admin-api/pricing-config/", data
  ),
};

// ─────────────────────────────────────────────────────────────────────────────
//  Broadcasts (public — for all dashboards)
// ─────────────────────────────────────────────────────────────────────────────

export const broadcastAPI = {
  getActive: () => api.get("/api/broadcasts/active/"),
};