import React, { useState, useEffect } from 'react';
import { FaWallet } from 'react-icons/fa';
import axios from 'axios';

const API_URL2 = process.env.REACT_APP_API_URL2;
const Header = ({ onMenuClick }) => {
  const [balance, setBalance] = useState('0.00');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchBalance = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) return;

        const response = await axios.get(`${API_URL2}/proxy/user-info`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (response.data.error === 0) {
          const usdtBalance = parseFloat(response.data.data.usdt || 0);
          setBalance(new Intl.NumberFormat('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
            useGrouping: true
          }).format(usdtBalance));
        }
      } catch (error) {
        console.error('Error fetching balance:', error);
      } finally {
        setLoading(false);
      }
    };

    // Initial fetch
    fetchBalance();

    // Set up interval to fetch balance every 30 seconds
    const intervalId = setInterval(fetchBalance, 30000);

    // Cleanup interval on component unmount
    return () => clearInterval(intervalId);
  }, []);

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
              <span className="text-white font-medium">
                {loading ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  `${balance} USDT`
                )}
              </span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header; 