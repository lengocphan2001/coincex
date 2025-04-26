import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/layout/Layout';
import Login from './pages/Login';
import Statistics from './pages/Statistics';
import CopyAI from './pages/CopyAI';
import CopyExpertManagement from './admin/pages/CopyExpertManagement';
import Activation30Days from './admin/pages/Activation30Days';
import CopyExpert from './pages/CopyExpert';
import Strategy from './pages/Strategy';
import AdminLayout from './admin/components/AdminLayout';
import AdminLogin from './admin/pages/Login';
import Members from './admin/pages/Members';
import ActivationUnlimited from './admin/pages/ActivationUnlimited';

// Protected Route component
const ProtectedRoute = ({ children }) => {
  const token = localStorage.getItem('token');
  return token ? children : <Navigate to="/login" />;
};

// Public Route component - redirects to /statistics if already logged in
const PublicRoute = ({ children }) => {
  const token = localStorage.getItem('token');
  return !token ? children : <Navigate to="/statistics" />;
};

// Admin Protected Route component
const AdminProtectedRoute = ({ children }) => {
  const adminToken = localStorage.getItem('adminToken');
  const adminData = localStorage.getItem('adminData');
  
  if (!adminToken || !adminData) {
    return <Navigate to="/admin/login" />;
  }

  try {
    const parsedAdminData = JSON.parse(adminData);
    if (parsedAdminData.role !== 'super_admin') {
      return <Navigate to="/admin/login" />;
    }
    return children;
  } catch (error) {
    return <Navigate to="/admin/login" />;
  }
};

// Admin Public Route component
const AdminPublicRoute = ({ children }) => {
  const adminToken = localStorage.getItem('adminToken');
  return !adminToken ? children : <Navigate to="/admin/members" />;
};

function App() {
  return (
    <Router>
      <Routes>
        {/* Public Routes */}
        <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
        
        {/* Protected Routes */}
        <Route path="/statistics" element={<ProtectedRoute><Layout><Statistics /></Layout></ProtectedRoute>} />
        <Route path="/copy-ai" element={<ProtectedRoute><Layout><CopyAI /></Layout></ProtectedRoute>} />
        <Route path="/copy-expert" element={<ProtectedRoute><Layout><CopyExpert /></Layout></ProtectedRoute>} />
        <Route path="/strategy" element={<ProtectedRoute><Layout><Strategy /></Layout></ProtectedRoute>} />
        
        {/* Admin Routes */}
        <Route path="/admin/login" element={<AdminPublicRoute><AdminLogin /></AdminPublicRoute>} />
        <Route path="/admin" element={<AdminProtectedRoute><AdminLayout><Navigate to="/admin/members" /></AdminLayout></AdminProtectedRoute>} />
        <Route path="/admin/members" element={<AdminProtectedRoute><AdminLayout><Members /></AdminLayout></AdminProtectedRoute>} />
        <Route path="/admin/copy-expert" element={<AdminProtectedRoute><AdminLayout><CopyExpertManagement /></AdminLayout></AdminProtectedRoute>} />
        <Route path="/admin/30-days" element={<AdminProtectedRoute><AdminLayout><Activation30Days /></AdminLayout></AdminProtectedRoute>} />
        <Route path="/admin/unlimited" element={<AdminProtectedRoute><AdminLayout><ActivationUnlimited /></AdminLayout></AdminProtectedRoute>} />
        
        {/* Default Route */}
        <Route path="/" element={<Navigate to="/statistics" />} />
      </Routes>
    </Router>
  );
}

export default App;
