import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { FaChartLine, FaRobot, FaSignOutAlt } from 'react-icons/fa';
import { GrUserExpert } from "react-icons/gr";
import { PiStrategy } from "react-icons/pi";
import { logout } from '../../utils/auth';
import logo from '../../assets/logo.png';

const Sidebar = ({ isOpen, setIsOpen }) => {
  const location = useLocation();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const menuItems = [
    { path: '/statistics', icon: <FaChartLine />, label: 'Thống kê' },
    { path: '/copy-ai', icon: <FaRobot />, label: 'Copy theo AI' },
    { path: '/copy-expert', icon: <GrUserExpert />, label: 'Copy theo CG' },
    { path: '/strategy', icon: <PiStrategy />, label: 'Tạo chiến lược' },
  ];

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
    } catch (error) {
      console.error('Logout failed:', error);
      setIsLoggingOut(false);
    }
  };

  return (
    <div className={`h-full bg-[#0F1A2E] w-[280px] flex flex-col`}>
      {/* Logo */}
      <div className="p-4 sm:p-6 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <img src={logo} alt="Coincex Logo" className="w-[120px] sm:w-[140px]" />
        </Link>
        <button 
          className="lg:hidden text-white/70 hover:text-white"
          onClick={() => setIsOpen(false)}
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 sm:px-6 py-4">
        <ul className="space-y-2">
          {menuItems.map((item) => (
            <li key={item.path}>
              <Link
                to={item.path}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  location.pathname === item.path
                    ? 'bg-[#00D88A] text-white'
                    : 'text-white/70 hover:bg-white/10 hover:text-white'
                }`}
                onClick={() => setIsOpen(false)}
              >
                <span className="text-lg">{item.icon}</span>
                <span className="text-sm font-medium">{item.label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {/* Logout Button */}
      <div className="p-4 sm:p-6 border-t border-white/10">
        <button
          className={`flex items-center gap-3 w-full px-4 py-3 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors ${
            isLoggingOut ? 'opacity-50 cursor-not-allowed' : ''
          }`}
          onClick={handleLogout}
          disabled={isLoggingOut}
        >
          <FaSignOutAlt className="text-lg" />
          <span className="text-sm font-medium">
            {isLoggingOut ? 'Đang đăng xuất...' : 'Đăng xuất'}
          </span>
        </button>
      </div>
    </div>
  );
};

export default Sidebar; 