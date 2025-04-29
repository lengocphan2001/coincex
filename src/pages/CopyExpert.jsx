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
      console.log('WebSocket connected');
        setWsConnected(true);
    };

    wsConnection.onmessage = (event) => {
      const data = JSON.parse(event.data);
      handleWebSocketMessage(data);
    };

    wsConnection.onclose = () => {
      console.log('WebSocket disconnected');
        setWsConnected(false);
      // Try to reconnect after 5 seconds
      setTimeout(() => {
        setWs(null);
      }, 5000);
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
        
        // Set up history fetching interval
        const historyInterval = setInterval(fetchTradeHistory, 30000);

        return () => clearInterval(historyInterval);
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
    <div className="container mx-auto px-4 py-8">
      <div className="bg-[#0F1A2E] rounded-xl p-6 mb-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
          <div className="flex items-center gap-4 mb-4 md:mb-0">
            <div className="relative">
              <button
                onClick={() => setShowDropdown(!showDropdown)}
                disabled={isTrading}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
                  isTrading ? 'bg-gray-700 cursor-not-allowed' : 'bg-[#1B2B45] hover:bg-[#2C3B55]'
                }`}
              >
                <span className="text-white">
                  {selectedBot ? selectedBot.name : 'Select Bot'}
                </span>
                <FaChevronDown className="text-white/70" />
              </button>
              {showDropdown && (
                <div className="absolute top-full left-0 mt-2 w-48 bg-[#1B2B45] rounded-lg shadow-lg z-10">
                  {bots.map(bot => (
                    <button
                      key={bot.id}
                      onClick={() => handleBotSelect(bot)}
                      className="w-full px-4 py-2 text-left text-white hover:bg-[#2C3B55] first:rounded-t-lg last:rounded-b-lg"
                    >
                      {bot.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {selectedBot && (
              <button
                onClick={isTrading ? handleStopTrading : () => handleStartTrading(selectedBot)}
                disabled={isLoading}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
                  isTrading ? 'bg-red-500 hover:bg-red-600' : 'bg-[#00DC82] hover:bg-[#00C974]'
                }`}
              >
                {isLoading ? (
                  <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin"></div>
                ) : isTrading ? (
                  <FaStop className="text-white" />
                ) : (
                  <FaPlay className="text-white" />
                )}
                <span className="text-white">
                  {isTrading ? 'Stop Trading' : 'Start Trading'}
                </span>
              </button>
            )}
          </div>
          <div className="flex flex-col items-end">
            <div className="text-sm text-white/70 mb-1">Current Profit</div>
            <div className={`text-2xl font-medium ${currentProfit >= 0 ? 'text-[#00D88A]' : 'text-red-500'}`}>
              {currentProfit >= 0 ? '+' : ''}{currentProfit} USDT
            </div>
          </div>
        </div>
        {selectedBot && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-[#1B2B45] rounded-lg p-4">
              <div className="text-sm text-white/70 mb-2">Follow Candle</div>
              <div className="text-white">{selectedBot.follow_candle}</div>
            </div>
            <div className="bg-[#1B2B45] rounded-lg p-4">
              <div className="text-sm text-white/70 mb-2">Capital Management</div>
              <div className="text-white">{capitalManagement}</div>
            </div>
            <div className="bg-[#1B2B45] rounded-lg p-4">
              <div className="text-sm text-white/70 mb-2">SL/TP</div>
              <div className="text-white">{stopLoss}</div>
        </div>
          </div>
        )}
      </div>

      <div className="bg-[#0F1A2E] rounded-xl p-6">
        <h2 className="text-white text-lg font-medium mb-6">Trade History</h2>
        
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
                  <th className="py-4 px-4">Status</th>
                  <th className="py-4 px-4">Amount</th>
                  <th className="py-4 px-4">Profit/Loss</th>
                </tr>
              </thead>
              <tbody>
                {[...history]
                  .filter(trade => trade && trade.order_code && trade.createdAt)
                  .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
                  .map(trade => renderTradeRow(trade))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default CopyExpert; 