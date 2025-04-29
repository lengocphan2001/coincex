import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { FaPlay, FaStop, FaChevronDown } from 'react-icons/fa';
import { toast } from 'react-toastify';

const API_URL = process.env.REACT_APP_API_URL;
const API_URL2 = process.env.REACT_APP_API_URL2;

const CopyExpert = () => {
  const [history, setHistory] = useState([]);
  const [pendingTrades, setPendingTrades] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedBot, setSelectedBot] = useState(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [capitalManagement, setCapitalManagement] = useState('1-2-4-8');
  const [currentProfit, setCurrentProfit] = useState(0);
  const [stopLoss, setStopLoss] = useState('30/60');
  const [isTrading, setIsTrading] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);
  const [ws, setWs] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const bots = [
    { id: 1, name: 'Expert Bot 1', follow_candle: 'd', capital_management: '1-2-4-8', sl_tp: '30/60' },
  ];

  // Connect to WebSocket
  useEffect(() => {
    const userId = localStorage.getItem('userId');
    const token = localStorage.getItem('token');
    if (!userId || !token) return;

    const wsUrl = `${API_URL.replace('http', 'ws')}/expert/users/${userId}/ws`;
    const wsConnection = new WebSocket(wsUrl);

    wsConnection.onopen = () => {
        setWsConnected(true);
    };

    wsConnection.onmessage = (event) => {
      const data = JSON.parse(event.data);
      handleWebSocketMessage(data);
    };

    wsConnection.onclose = () => {
        setWsConnected(false);
      // Try to reconnect after 5 seconds
      setTimeout(() => {
        setWs(null);
      }, 15000);
    };

    setWs(wsConnection);

    return () => {
      if (wsConnection) {
        wsConnection.close();
      }
    };
  }, [ws === null]);

  // Handle WebSocket messages
  const handleWebSocketMessage = (message) => {
    switch (message.type) {
      case 'STATE_UPDATE':
        setIsTrading(message.data.isTrading);
        if (message.data.bot) {
          setSelectedBot(message.data.bot);
          setCapitalManagement(message.data.bot.capital_management);
          setStopLoss(message.data.bot.sl_tp);
        }
        break;
      case 'NEW_TRADE':
        setPendingTrades(prev => [message.data, ...prev]);
        break;
      case 'CANDLE_PROCESSED':
        fetchTradeHistory();
        break;
      case 'ERROR':
        toast.error(message.error);
        break;
      default:
        break;
    }
  };

  // Initialize component
  useEffect(() => {
    const initializeComponent = async () => {
      try {
        const userId = localStorage.getItem('userId');
        const token = localStorage.getItem('token');
        if (!userId || !token) return;

        // Get current trading state
        const response = await axios.get(
          `${API_URL}/expert/users/${userId}/state`,
          {
            headers: { 'Authorization': `Bearer ${token}` }
          }
        );

        if (response.data.error === 0) {
          const state = response.data.data;
          setIsTrading(state.isTrading);
          if (state.bot) {
            setSelectedBot(state.bot);
            setCapitalManagement(state.bot.capital_management);
            setStopLoss(state.bot.sl_tp);
          }
        }

        // Fetch initial trade history
        await fetchTradeHistory();
      
      } catch (error) {
        console.error('Error initializing component:', error);
        if (error.response?.status === 401) {
          localStorage.removeItem('token');
          window.location.href = '/login';
        }
      }
    };

    initializeComponent();
  }, []);

  const handleBotSelect = async (bot) => {
    if (!bot) return;

    try {
      const userId = localStorage.getItem('userId');
      const token = localStorage.getItem('token');
      if (!userId || !token) {
        toast.error('Please login to continue');
        window.location.href = '/login';
        return;
      }

      // If currently trading, stop first
      if (isTrading) {
        await axios.post(
          `${API_URL}/expert/users/${userId}/stop`,
          { userId, token },
          { headers: { 'Authorization': `Bearer ${token}` } }
        );
      }
      
      setSelectedBot(bot);
      setCapitalManagement(bot.capital_management);
      setStopLoss(bot.sl_tp);
      setShowDropdown(false);

      // If we were trading, restart with new bot
      if (isTrading) {
        await axios.post(
          `${API_URL}/expert/users/${userId}/start`,
          { bot }, // Only send the bot configuration
          { headers: { 'Authorization': `Bearer ${token}` } }
        );
      }
    } catch (error) {
      console.error('Error selecting bot:', error);
      toast.error('Failed to select bot');
      if (error.response?.status === 401 || error.response?.data?.message?.includes('token')) {
        localStorage.removeItem('token');
        window.location.href = '/login';
      }
    }
  };

  const handleStartTrading = async (bot) => {
    try {
      setIsLoading(true);
      const token = localStorage.getItem('token');
      const userId = localStorage.getItem('userId');

      if (!token || !userId) {
        toast.error('Please login to start trading');
        return;
      }

      // Save selected bot to localStorage
      localStorage.setItem('selectedExpertBot', JSON.stringify(bot));
      
      // Start trading with bot, token and userId
      const response = await axios.post(
        `${API_URL}/expert/users/${userId}/start`,
        { bot }, // Only send the bot configuration
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.data.error === 0) {
        // Update UI state
        setSelectedBot(bot);
        setIsTrading(true);
        toast.success('Trading started successfully');
      } else {
        throw new Error(response.data.message || 'Failed to start trading');
      }
    } catch (error) {
      console.error('Error starting trading:', error);
      toast.error(error.response?.data?.message || error.message || 'Failed to start trading');
      if (error.response?.status === 401 || error.response?.data?.message?.includes('token')) {
        localStorage.removeItem('token');
        window.location.href = '/login';
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleStopTrading = async () => {
    try {
      setIsLoading(true);
      const token = localStorage.getItem('token');
      const userId = localStorage.getItem('userId');

      if (!token || !userId) {
        toast.error('Please login to stop trading');
        return;
      }

      const response = await axios.post(
        `${API_URL}/expert/users/${userId}/stop`,
        { token },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.data.error === 0) {
        setIsTrading(false);
        toast.success('Trading stopped successfully');
      } else {
        throw new Error(response.data.message || 'Failed to stop trading');
      }
    } catch (error) {
      console.error('Error stopping trading:', error);
      toast.error(error.response?.data?.message || error.message || 'Failed to stop trading');
      // If token is invalid, redirect to login
      if (error.response?.status === 401 || error.response?.data?.message?.includes('token')) {
        localStorage.removeItem('token');
        window.location.href = '/login';
      }
    } finally {
      setIsLoading(false);
    }
  };

  const fetchTradeHistory = async () => {
    try {
      const token = localStorage.getItem('token');
      const userId = localStorage.getItem('userId');
      if (!token || !userId) return;
      
      // First, get pending orders
      const pendingResponse = await axios.get(`${API_URL2}/proxy/history-bo`, {
        params: {
          status: 'pending',
          offset: 0,
          limit: 10
        },
          headers: {
            'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        }
      });

      if (pendingResponse.data?.data) {
        setPendingTrades(pendingResponse.data.data);
      }

      // Then get completed orders
      const historyResponse = await axios.get(`${API_URL2}/proxy/history-bo`, {
          params: {
          status: 'completed',
            offset: 0,
          limit: 10
          },
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json'
          }
        });

      if (historyResponse.data?.data) {
        await axios.post(
          `${API_URL}/copy-expert-orders/update-completed/user/${userId}`,
          {
            completedOrders: historyResponse.data.data
          },
            {
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
              }
            }
          );

        const ordersResponse = await axios.get(
          `${API_URL}/copy-expert-orders/user/${userId}`,
          {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          }
        );

        if (ordersResponse.data.error === 0) {
          setHistory(ordersResponse.data.data || []);
          const totalProfit = calculateTotalProfit(ordersResponse.data.data || []);
          setCurrentProfit(totalProfit.toFixed(2));
        }
      }
    } catch (error) {
      console.error('Error fetching trade history:', error);
      if (error.response?.status === 401) {
        localStorage.removeItem('token');
        window.location.href = '/login';
      }
    }
  };

  const calculateTotalProfit = (trades) => {
    return trades.reduce((total, trade) => {
      if (trade.status === 'LOSS') {
        return total - parseFloat(trade.amount);
      } else if (trade.status === 'WIN') {
        return total + (parseFloat(trade.received_usdt) - parseFloat(trade.amount));
      }
      return total;
    }, 0);
  };

  const formatDateTime = (dateString) => {
    const date = new Date(dateString);
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes} ${day}/${month}/${year}`;
  };

  const renderTradeRow = (trade) => (
    <tr key={trade.order_code} className="border-b border-white/10">
      <td className="py-4 px-4">
        <div className="text-white/70 text-sm">
          {formatDateTime(trade.createdAt)}
        </div>
      </td>
      <td className="py-4 px-4 text-sm text-white/70">
        {trade.bot || 'BTCUSDT'}
      </td>
      <td className="py-4 px-4 text-sm text-white/70">
        {trade.symbol || 'BTCUSDT'}
      </td>
      <td className="py-4 px-4">
        <div className="flex items-center gap-2">
          <span 
            className={`px-2 py-1 text-xs font-medium rounded-md ${
              trade.status === 'WIN' 
                ? 'bg-green-500/10 text-green-500' 
                : trade.status === 'LOSS'
                ? 'bg-red-500/10 text-red-500'
                : 'bg-yellow-500/10 text-yellow-500'
            }`}
          >
            {trade.status}
          </span>
        </div>
      </td>
      <td className="py-4 px-4 text-sm text-white/70">
        {trade.amount} USDT
      </td>
      <td className="py-4 px-4 text-sm">
        {trade.status === 'PENDING' ? (
          <span className="text-yellow-500">Pending</span>
        ) : (
          <span className={trade.status === 'WIN' ? 'text-green-500' : 'text-red-500'}>
            {trade.status === 'WIN' ? '+' : '-'}
            {Math.abs(trade.received_usdt - trade.amount).toFixed(2)} USDT
          </span>
        )}
      </td>
    </tr>
  );

  return (
    <div className="space-y-6">
      <div className="bg-[#0F1A2E] rounded-xl p-6">
        <h2 className="text-white text-lg font-medium mb-6">COPY THEO EXPERT</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="relative">
              <label className="block text-white/70 text-sm mb-2">Chiến lược</label>
              <button
                type="button"
                onClick={() => !isTrading && setShowDropdown(!showDropdown)}
                disabled={isTrading}
                className={`w-full bg-[#0B1221] rounded-lg p-4 text-white text-sm border-0 focus:ring-1 focus:ring-[#00D88A] outline-none flex items-center justify-between ${
                  isTrading ? 'opacity-75 cursor-not-allowed' : ''
                }`}
              >
                <span>{selectedBot?.name || 'Chọn chiến lược'}</span>
                <FaChevronDown className={`transform transition-transform ${showDropdown ? 'rotate-180' : ''}`} />
              </button>
              
              {showDropdown && !isTrading && (
                <div className="absolute z-10 w-full mt-2 bg-[#0B1221] rounded-lg shadow-lg max-h-60 overflow-y-auto">
                  {bots.map((bot) => (
                    <button
                      key={bot.id}
                      onClick={() => handleBotSelect(bot)}
                      className={`w-full text-left px-4 py-3 text-white hover:bg-[#1A2A3F] transition-colors flex items-center justify-between ${
                        selectedBot?.id === bot.id ? 'bg-[#1A2A3F]' : ''
                      }`}
                    >
                      <div className="flex flex-col">
                        <span>{bot.name}</span>
                        <span className="text-sm text-white/70">Pattern: {bot.follow_candle}</span>
                        <span className="text-sm text-white/70">Capital: {bot.capital_management}</span>
                        <span className="text-sm text-white/70">SL/TP: {bot.sl_tp}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            
            <div>
              <label className="block text-white/70 text-sm mb-2">Quản lý vốn</label>
              <input
                type="text"
                disabled={true}
                value={capitalManagement}
                onChange={(e) => setCapitalManagement(e.target.value)}
                className="w-full bg-[#0B1221] rounded-lg p-4 text-white text-sm border-0 focus:ring-1 focus:ring-[#00D88A] outline-none"
                placeholder="Nhập tỷ lệ quản lý vốn"
              />
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-white/70 text-sm mb-2">Lợi nhuận hiện tại</label>
              <div className="bg-[#0B1221] rounded-lg p-4">
                <h3 className={`text-xl font-bold ${currentProfit >= 0 ? 'text-[#00D88A]' : 'text-red-500'}`}>
                  {currentProfit > 0 ? '+' : ''}{currentProfit}$
                </h3>
              </div>
            </div>
            
            <div>
              <label className="block text-white/70 text-sm mb-2">Dừng lỗ & Chốt lỗ</label>
              <input
                type="text"
                disabled={true}
                value={stopLoss}
                onChange={(e) => setStopLoss(e.target.value)}
                className="w-full bg-[#0B1221] rounded-lg p-4 text-[#00D88A] text-sm border-0 focus:ring-1 focus:ring-[#00D88A] outline-none"
                placeholder="Nhập SL/TP"
              />
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-center">
          {!isTrading ? (
            <button 
              onClick={() => handleStartTrading(selectedBot)}
              disabled={!selectedBot || isLoading}
              className={`${
                selectedBot && !isLoading
                  ? 'bg-[#00D88A] hover:bg-opacity-90'
                  : 'bg-gray-500 cursor-not-allowed'
              } text-white px-8 py-3 rounded-lg flex items-center gap-2 transition-colors`}
            >
              {isLoading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <FaPlay className="w-4 h-4" />
              )}
              <span>{isLoading ? 'Starting...' : 'Bắt đầu chạy'}</span>
            </button>
          ) : (
            <button 
              onClick={handleStopTrading}
              disabled={isLoading}
              className="bg-red-500 text-white px-8 py-3 rounded-lg flex items-center gap-2 hover:bg-opacity-90 transition-colors disabled:opacity-75 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <FaStop className="w-4 h-4" />
              )}
              <span>{isLoading ? 'Stopping...' : 'Dừng'}</span>
            </button>
          )}
        </div>


        {error && (
          <div className="mt-4 p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
            <p className="text-red-500 text-sm text-center">{error}</p>
          </div>
        )}
      </div>

      <div className="bg-[#0F1A2E] rounded-xl p-6">
        <h2 className="text-white text-lg font-medium mb-6">Lịch sử giao dịch</h2>
        
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#00DC82]"></div>
          </div>
        ) : error ? (
          <div className="text-red-500 text-center p-4">
            {error}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-sm text-white/70 border-b border-white/10">
                  <th className="py-4 px-4">Time</th>
                  <th className="py-4 px-4">Bot</th>
                  <th className="py-4 px-4">Symbol</th>
                  <th className="py-4 px-4">Type</th>
                  <th className="py-4 px-4">Amount</th>
                  <th className="py-4 px-4">Open</th>
                  <th className="py-4 px-4">Close</th>
                  <th className="py-4 px-4">Status</th>
                  <th className="py-4 px-4">Received</th>
                </tr>
              </thead>
              <tbody>
                {[...history]
                  .filter(trade => trade && trade.order_code && trade.createdAt)
                  .map(trade => (
                    <tr key={trade.order_code} className="border-b border-white/10">
                      <td className="py-4 px-4">
                        <div className="text-white/70 text-sm">
                          {formatDateTime(trade.createdAt)}
                        </div>
                      </td>
                      <td className="py-4 px-4 text-sm text-white/70">{trade.bot || 'BTCUSDT'}</td>
                      <td className="py-4 px-4 text-sm text-white/70">{trade.symbol || 'BTCUSDT'}</td>
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${trade.type === 'long' ? 'bg-[#00D88A]' : 'bg-red-500'}`}></span>
                          <span className="text-sm text-white/70">{(trade.type || '').toUpperCase()}</span>
                        </div>
                      </td>
                      <td className="py-4 px-4 text-sm text-white/70">{trade.amount} USDT</td>
                      <td className="py-4 px-4 text-sm text-white/70">{trade.open_price || '-'}</td>
                      <td className="py-4 px-4 text-sm text-white/70">{trade.close_price || '-'}</td>
                      <td className="py-4 px-4">
                        {trade.status === 'PENDING' ? (
                          <div className="flex items-center gap-2">
                            <div className="w-4 h-4 rounded-full border-2 border-yellow-400 border-t-transparent animate-spin"></div>
                            <span className="text-sm text-yellow-400">PENDING</span>
                          </div>
                        ) : (
                          <span className={`text-sm ${trade.status === 'WIN' ? 'text-[#00D88A]' : 'text-red-500'}`}>
                            {trade.status}
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-4">
                        {trade.status === 'PENDING' ? (
                          <span className="text-sm text-white/70">-</span>
                        ) : (
                          <span className={`text-sm ${trade.received_usdt > 0 ? 'text-[#00D88A]' : 'text-red-500'}`}>
                            {trade.received_usdt > 0 ? '+' : ''}{trade.received_usdt} USDT
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default CopyExpert; 