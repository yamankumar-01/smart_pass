import axios from 'axios';

// Support Vercel / Cloud Environment Variable: VITE_API_URL
const rawBase = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || '';
const cleanBase = rawBase ? rawBase.replace(/\/+$/, '') : '';
export const API_BASE_URL = cleanBase ? (cleanBase.endsWith('/api') ? cleanBase : `${cleanBase}/api`) : '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request Interceptor: Attach JWT Token if present
api.interceptors.request.use(
  (config) => {
    const token = sessionStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Concurrency-safe Token Refresh Mutex & Queue
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

const clearSessionAndRedirect = () => {
  sessionStorage.removeItem('accessToken');
  sessionStorage.removeItem('refreshToken');
  sessionStorage.removeItem('username');
  sessionStorage.removeItem('role');
  sessionStorage.removeItem('activeTab');
  sessionStorage.removeItem('smartpass_active_session');
  sessionStorage.removeItem('smartpass_selected_event_id');
  sessionStorage.removeItem('selected_session_id');

  // Notify UI of session invalidation
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('smartpass:auth:logout'));
  }
};

// Response Interceptor: Handle Token Refresh on 401 with Queueing
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response && error.response.status === 401 && !originalRequest._retry) {
      // If the refresh call itself returned 401, clear session immediately
      if (originalRequest.url?.includes('/token/refresh/')) {
        clearSessionAndRedirect();
        return Promise.reject(error);
      }

      const refreshToken = sessionStorage.getItem('refreshToken');
      if (!refreshToken) {
        clearSessionAndRedirect();
        return Promise.reject(error);
      }

      // If already refreshing, subscribe this request to queue until in-flight refresh completes
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return api(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const res = await axios.post(`${API_BASE_URL}/token/refresh/`, { refresh: refreshToken });
        const newAccess = res.data?.access;
        if (newAccess) {
          sessionStorage.setItem('accessToken', newAccess);
          api.defaults.headers.common.Authorization = `Bearer ${newAccess}`;
          originalRequest.headers.Authorization = `Bearer ${newAccess}`;
          processQueue(null, newAccess);
          return api(originalRequest);
        } else {
          throw new Error('Refresh response missing access token');
        }
      } catch (refreshErr) {
        processQueue(refreshErr, null);
        clearSessionAndRedirect();
        return Promise.reject(refreshErr);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default api;
