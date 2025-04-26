import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL;

const adminService = {
  // User Management
  getUsers: async (params = {}) => {
    const response = await axios.get(`${API_URL}/admin/users`, { params });
    return response.data;
  },

  updateUserStatus: async (userId, isActive) => {
    const response = await axios.patch(`${API_URL}/admin/users/${userId}/status`, {
      isActive
    });
    return response.data;
  },

  makeUserAdmin: async (userId) => {
    const response = await axios.patch(`${API_URL}/admin/users/${userId}/make-admin`);
    return response.data;
  },

  // Strategy Management
  getStrategies: async (params = {}) => {
    const response = await axios.get(`${API_URL}/admin/strategies`, { params });
    return response.data;
  },

  updateStrategyStatus: async (strategyId, status) => {
    const response = await axios.patch(`${API_URL}/admin/strategies/${strategyId}/status`, {
      status
    });
    return response.data;
  },

  deleteStrategy: async (strategyId) => {
    const response = await axios.delete(`${API_URL}/admin/strategies/${strategyId}`);
    return response.data;
  },

  // Analytics
  getAnalytics: async () => {
    const response = await axios.get(`${API_URL}/admin/analytics`);
    return response.data;
  }
};

export default adminService; 