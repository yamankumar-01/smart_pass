import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request Interceptor: Attach JWT Token if present
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: Handle Token Refresh on 401
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    if (error.response && error.response.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      const refreshToken = localStorage.getItem('refreshToken');

      if (refreshToken) {
        try {
          const res = await axios.post('/api/token/refresh/', { refresh: refreshToken });
          if (res.data.access) {
            localStorage.setItem('accessToken', res.data.access);
            originalRequest.headers.Authorization = `Bearer ${res.data.access}`;
            return api(originalRequest);
          }
        } catch (refreshErr) {
          // Token refresh failed -> Clear tokens
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          window.location.reload();
        }
      }
    }
    return Promise.reject(error);
  }
);

export default api;
