import React from 'react';
import { FaWallet } from 'react-icons/fa';

const Header = ({ onMenuClick }) => {
  return (
    <header className="bg-[#0F1A2E] border-b border-white/10">
      <div className="mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          {/* Mobile menu button */}
          <button
            className="lg:hidden text-white/70 hover:text-white p-2 rounded-lg hover:bg-white/10"
            onClick={onMenuClick}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          {/* Balance Display */}
          <div className="flex items-center bg-[#00D88A] rounded-xl py-2 px-4 gap-2 ml-auto">
            <FaWallet className="text-white w-8 h-8" />
            <div className="flex flex-col">
              <span className="text-sm text-gray-700 font-medium">Số dư</span>
              <span className="text-white font-medium">3,321.91 USDT</span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header; 