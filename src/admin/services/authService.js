import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL;

const TOKEN_KEY = 'admin_token';
const USER_KEY = 'admin_user';

const authService = {
  login: async (username, password) => {
    try {
      const response = await axios.post(`${API_URL}/admin/auth/login`, {
        username,
        password
      });
      
      const { token, user } = response.data;
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(USER_KEY, JSON.stringify(user));
      
      return user;
    } catch (error) {
      throw new Error(error.response?.data?.message || 'Login failed');
    }
  },

  logout: () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    window.location.href = '/admin/login';
  },

  getCurrentUser: () => {
    const userStr = localStorage.getItem(USER_KEY);
    return userStr ? JSON.parse(userStr) : null;
  },

  getToken: () => {
    return localStorage.getItem(TOKEN_KEY);
  },

  isAuthenticated: () => {
    return !!localStorage.getItem(TOKEN_KEY);
  },

  isAdmin: () => {
    const user = authService.getCurrentUser();
    return user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN';
  },

  setupAxiosInterceptors: () => {
    axios.interceptors.request.use(
      (config) => {
        const token = authService.getToken();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    axios.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          authService.logout();
        }
        return Promise.reject(error);
      }
    );
  }
};

// Setup axios interceptors on import
authService.setupAxiosInterceptors();

export default authService; 