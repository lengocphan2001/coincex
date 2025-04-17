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