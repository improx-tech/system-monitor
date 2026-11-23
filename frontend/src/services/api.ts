import axios from 'axios';

// Dynamically determine API URL based on current host or environment variable
export const API_BASE_URL = import.meta.env.VITE_API_URL || (
  window.location.protocol === 'https:' || !window.location.port || window.location.port === '80' || window.location.port === '443'
    ? `${window.location.protocol}//${window.location.host}`
    : `${window.location.protocol}//${window.location.hostname}:4000`
);

export const api = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  headers: {
    'Content-Type': 'application/json'
  }
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('improx_token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('improx_token');
      localStorage.removeItem('improx_user');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);