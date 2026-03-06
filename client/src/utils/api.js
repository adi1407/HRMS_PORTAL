// src/utils/api.js

import axios from "axios";
import useAuthStore from "../store/authStore";

// Local: REACT_APP_API_URL is unset → baseURL = '/api' → CRA proxy forwards to localhost:5000
// Production: REACT_APP_API_URL = 'https://your-render-app.onrender.com' → full URL used
const BASE_URL = `${process.env.REACT_APP_API_URL || ''}/api`;

const api = axios.create({
  baseURL: BASE_URL,
  withCredentials: true, // sends httpOnly refresh cookie
  headers: { "Content-Type": "application/json" },
});

// Inject access token from memory into every request
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Auto-refresh on 401
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => (error ? prom.reject(error) : prom.resolve(token)));
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Avoid infinite loop for auth endpoints
    const isAuthEndpoint =
      originalRequest?.url === "/auth/refresh" || originalRequest?.url === "/auth/login";

    if (error.response?.status === 401 && !originalRequest._retry && !isAuthEndpoint) {
      // If refresh already happening, queue requests
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return api(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // ✅ uses same axios instance (baseURL + withCredentials)
        const { data } = await api.post("/auth/refresh", {});
        const { accessToken } = data;

        // update store
        const state = useAuthStore.getState();
        state.setAuth(state.user, accessToken);

        // release queued requests
        processQueue(null, accessToken);

        // retry original request
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        useAuthStore.getState().clearAuth();
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