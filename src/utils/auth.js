export const setAuth = (token) => {
  localStorage.setItem('token', token);
};

export const clearAuth = () => {
  localStorage.removeItem('token');
};

export const isAuthenticated = () => {
  const token = localStorage.getItem('token');
  return !!token;
};

export const getToken = () => {
  return localStorage.getItem('token');
};

export const logout = async () => {
  // Clear all auth-related items from localStorage
  clearAuth();
  
  // Clear any other user-related data
  localStorage.removeItem('user');
  localStorage.removeItem('coinexApiKey');
  
  // Clear any session storage items if you're using them
  sessionStorage.clear();
  
  // Force reload to clear any in-memory state
  window.location.href = '/login';
}; 