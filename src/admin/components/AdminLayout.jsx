import React, { useState, useEffect } from 'react';
import { FaUsers, FaCopy, FaClock, FaInfinity, FaSignOutAlt, FaBars, FaTimes, FaRobot } from 'react-icons/fa';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import logo from '../../assets/logo.png';

const API_URL = process.env.REACT_APP_API_URL;

const AdminLayout = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);

  useEffect(() => {
    const token = localStorage.getItem('adminToken');
    const adminData = localStorage.getItem('adminData');
    
    if (!token || !adminData) {
      navigate('/admin/login');
      return;
    }

    // Set up axios default headers
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    
    try {
      const parsedAdminData = JSON.parse(adminData);
      setCurrentUser(parsedAdminData);
    } catch (error) {
      console.error('Error parsing admin data:', error);
      navigate('/admin/login');
    }

    const handleResize = () => {
      setIsMobile(window.innerWidth < 1024);
      if (window.innerWidth >= 1024) {
        setIsSidebarOpen(true);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [navigate]);

  const handleLogout = async () => {
    try {
      const token = localStorage.getItem('adminToken');
      if (token) {
        await axios.post(`${API_URL}/admin/logout`, null, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      localStorage.removeItem('adminToken');
      localStorage.removeItem('adminData');
      navigate('/admin/login');
    }
  };

  const sidebarItems = [
    { id: 'members', label: 'Thành viên', icon: <FaUsers />, path: '/admin/members' },
    { id: 'copyExpert', label: 'Copy Chuyên gia', icon: <FaCopy />, path: '/admin/copy-expert' },
    { id: '30days', label: 'Gói kích hoạt 30 ngày', icon: <FaClock />, path: '/admin/30-days' },
    { id: 'unlimited', label: 'Gói kích hoạt thành viên', icon: <FaInfinity />, path: '/admin/unlimited' },
    { id: 'logout', label: 'Đăng xuất', icon: <FaSignOutAlt />, path: '/logout' }
  ];

  const handleNavigation = (path) => {
    if (path === '/logout') {
      handleLogout();
      return;
    }
    navigate(path);
    if (isMobile) {
      setIsSidebarOpen(false);
    }
  };

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  if (!currentUser) {
    return null;
  }

  return (
    <div className="flex h-screen bg-[#0D0D0D]">
      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-20 bg-[#1E1E1E] p-4 flex justify-between items-center shadow-lg">
        <button
          onClick={toggleSidebar}
          className="text-white p-2 rounded-lg hover:bg-[#2C2C2C] transition-colors duration-200"
        >
          {isSidebarOpen ? <FaTimes size={20} /> : <FaBars size={20} />}
        </button>
        <img src={logo} alt="Coin Logo" className="h-8" />
        <div className="w-8" /> {/* Spacer for balance */}
      </div>

      {/* Sidebar */}
      <div className={`
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} 
        lg:translate-x-0
        fixed lg:static
        z-10
        w-64 h-full
        bg-[#1E1E1E] text-white
        transition-transform duration-300 ease-in-out
        border-r border-gray-800
        ${isMobile ? 'top-16' : 'top-0'}
      `}>
        <div className="p-4 flex items-center justify-between border-b border-gray-800 lg:block">
          <img src={logo} alt="Coin Logo" className="h-8 hidden lg:block" />
        </div>
        
        {/* User Info */}
        <div className="px-4 py-3 border-b border-gray-800 bg-[#2C2C2C]">
          <p className="text-sm font-medium text-white">{currentUser.username}</p>
          <p className="text-xs text-gray-400">{currentUser.role}</p>
        </div>

        <nav className="mt-4 px-2">
          {sidebarItems.map((item) => (
            <button
              key={item.id}
              onClick={() => handleNavigation(item.path)}
              className={`w-full flex items-center px-4 py-3 text-sm transition-all duration-200 rounded-lg mb-1 ${
                location.pathname === item.path 
                  ? 'bg-[#00DC82] text-black font-medium'
                  : 'text-gray-300 hover:bg-[#2C2C2C] hover:text-white'
              }`}
            >
              <span className={`mr-3 ${location.pathname === item.path ? 'text-black' : 'text-[#00DC82]'}`}>
                {item.icon}
              </span>
              {item.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Main Content */}
      <div className={`flex-1 overflow-auto bg-[#0D0D0D] transition-all duration-300 ${isSidebarOpen ? '' : 'ml-0'}`}>
        <div className="w-full h-full p-4 lg:p-6 mt-16 lg:mt-0">
          {children}
        </div>
      </div>

      {/* Overlay for mobile */}
      {isSidebarOpen && isMobile && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm z-0"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}
    </div>
  );
};

export default AdminLayout; 