import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import Sidebar from './Sidebar';
import Header from '../common/Header';
const API_URL = process.env.REACT_APP_API_URL;
const API_URL2 = process.env.REACT_APP_API_URL2;
const Layout = ({ children }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const checkUserStatus = async () => {
      try {
        const userId = localStorage.getItem('userId');
        if (!userId) {
          navigate('/login');
          return;
        }

        try {
          const response = await axios.get(`${API_URL}/users/${userId}/access`);
          
          if (!response.data.success) {
            setError(response.data.message || 'Failed to verify account status');
            return;
          }
          if (!response.data.data?.isActive) {
            setError('Tài khoản chưa được kích hoạt, liên hệ admin để kích hoạt tài khoản');
          }
        } catch (error) {
          if (error.response?.status === 404) {
            setError('Tài khoản không tồn tại');
            localStorage.removeItem('userId');
            navigate('/login');
            return;
          }
          console.error('Error checking user access:', error);
          setError(error.response?.data?.message || 'Unable to verify account status. Please try again later.');
        }
      } catch (error) {
        console.error('Error checking user status:', error);
        setError('An error occurred. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    checkUserStatus();
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem('userId');
    navigate('/login');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#0B1221]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#00DC82]"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0B1221] text-white">
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`fixed top-0 left-0 h-full z-50 transition-transform duration-300 ease-in-out ${
        isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
      } lg:translate-x-0`}>
        <Sidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />
      </div>

      {/* Main Content */}
      <div className={`lg:pl-[280px] transition-all duration-300`}>
        <Header onMenuClick={() => setIsSidebarOpen(!isSidebarOpen)} onLogout={handleLogout} />
        <main className="p-4 sm:p-6 lg:p-8">
          {error ? (
            <div className="flex flex-col items-center justify-center h-[calc(100vh-200px)]">
              <div className="bg-[#1E1E1E] rounded-lg p-6 max-w-md w-full">
                <div className="text-center">
                  <div className="text-red-500 text-4xl mb-4">⚠️</div>
                  <h2 className="text-xl font-bold text-white mb-2">Error</h2>
                  <p className="text-gray-300 mb-4">{error}</p>
                  <div className="flex justify-center gap-4">
                    <button
                      onClick={() => window.location.reload()}
                      className="bg-[#00DC82] text-black px-4 py-2 rounded-lg hover:bg-opacity-90 transition-colors"
                    >
                      Try Again
                    </button>
                    <button
                      onClick={handleLogout}
                      className="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-opacity-90 transition-colors"
                    >
                      Logout
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            children
          )}
        </main>
      </div>
    </div>
  );
};

export default Layout; 