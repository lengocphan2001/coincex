import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/layout/Layout';
import Login from './pages/Login';
import Statistics from './pages/Statistics';
import CopyAI from './pages/CopyAI';
import CopyExpert from './pages/CopyExpert';
import Strategy from './pages/Strategy';
import { isAuthenticated } from './utils/auth';

// Protected Route component
const ProtectedRoute = ({ children }) => {
  const auth = isAuthenticated();
  return auth ? children : <Navigate to="/login" />;
};

// Public Route component - redirects to /statistics if already logged in
const PublicRoute = ({ children }) => {
  const auth = isAuthenticated();
  return auth ? <Navigate to="/statistics" /> : children;
};

function App() {
  return (
    <Router>
      <Routes>
        <Route
          path="/login"
          element={
            <PublicRoute>
              <Login />
            </PublicRoute>
          }
        />
        {/* <Route
          path="/"
          element={<Navigate to="/statistics" />}
        /> */}
        <Route
          path="/statistics"
          element={
            <ProtectedRoute>
              <Layout>
                <Statistics />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/copy-ai"
          element={
            <ProtectedRoute>
              <Layout>
                <CopyAI />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/copy-expert"
          element={
            <ProtectedRoute>
              <Layout>
                <CopyExpert />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/strategy"
          element={
            <ProtectedRoute>
              <Layout>
                <Strategy />
              </Layout>
            </ProtectedRoute>
          }
        />
        {/* Add other routes here */}
      </Routes>
    </Router>
  );
}

export default App;
