import axios, { type AxiosError } from 'axios';
import { API_URL } from '@/config/env';
import { useAuthStore } from '@/store/authStore';

const api = axios.create({
  baseURL: API_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
    'X-Client': 'mobile',
  },
});

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let isRefreshing = false;
let failedQueue: Array<{ resolve: (t: string | null) => void; reject: (err: unknown) => void }> = [];

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach((p) => (error ? p.reject(error) : p.resolve(token)));
  failedQueue = [];
};

api.interceptors.response.use(
  (res) => res,
  async (err: AxiosError) => {
    const originalRequest = err.config as typeof err.config & { _retry?: boolean };
    if (!originalRequest) return Promise.reject(err);

    const isAuth = originalRequest.url?.includes('/auth/login') || originalRequest.url?.includes('/auth/refresh');
    if (err.response?.status !== 401 || originalRequest._retry || isAuth) {
      return Promise.reject(err);
    }

    originalRequest._retry = true;

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        failedQueue.push({ resolve: (t) => resolve(t ? api(originalRequest) : Promise.reject(err)), reject });
      });
    }

    isRefreshing = true;
    const refreshToken = await useAuthStore.getState().getStoredRefreshToken();

    if (!refreshToken) {
      await useAuthStore.getState().clearAuth();
      processQueue(err, null);
      isRefreshing = false;
      return Promise.reject(err);
    }

    try {
      const { data } = await api.post<{ accessToken: string }>('/auth/refresh', { refreshToken });
      const { accessToken } = data;
      useAuthStore.setState({ accessToken });
      processQueue(null, accessToken);
      originalRequest.headers.Authorization = `Bearer ${accessToken}`;
      return api(originalRequest);
    } catch (e) {
      await useAuthStore.getState().clearAuth();
      processQueue(e, null);
      return Promise.reject(e);
    } finally {
      isRefreshing = false;
    }
  }
);

export default api;
