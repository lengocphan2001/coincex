import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { FaPlay, FaStop, FaChevronDown } from 'react-icons/fa';
import { toast } from 'react-toastify';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001/api';
const API_URL2 = process.env.REACT_APP_API_URL2 || 'http://localhost:5001/api';

const CopyAi = () => {
  const [history, setHistory] = useState([]);
  const [pendingTrades, setPendingTrades] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [strategies, setStrategies] = useState([]);
  const [selectedStrategy, setSelectedStrategy] = useState(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [capitalManagement, setCapitalManagement] = useState('');
  const [currentProfit, setCurrentProfit] = useState(0);
  const [stopLoss, setStopLoss] = useState('');
  const [isTrading, setIsTrading] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);
  const [startingTrade, setStartingTrade] = useState(false);
  const [stoppingTrade, setStoppingTrade] = useState(false);
  const [ws, setWs] = useState(null);

  // Handle WebSocket messages
  const handleWebSocketMessage = (data) => {
    switch (data.type) {
      case 'STATE_UPDATE':
        setIsTrading(data.data.isTrading);
        if (data.data.strategy) {
          setSelectedStrategy(data.data.strategy);
          setCapitalManagement(data.data.strategy.capital_management || '');
          setStopLoss(data.data.strategy.sl_tp || '');
        }
        break;
      case 'NEW_TRADE':
        setPendingTrades(prev => [data.data, ...prev]);
        break;
      case 'CANDLE_PROCESSED':
        fetchTradeHistory();
        break;
      case 'ERROR':
        toast.error(data.error);
        break;
      case 'TRADING_STOPPED':
        setIsTrading(false);
        toast.info('Trading has been stopped');
        break;
      default:
        break;
    }
  };

  // Initialize component and WebSocket
  useEffect(() => {
    const userId = localStorage.getItem('userId');
    const token = localStorage.getItem('token');
    if (!userId || !token) return;

    // Initial fetch of trade history
    fetchTradeHistory();

    // WebSocket connection
    const wsUrl = `${API_URL.replace('http', 'ws')}/copy-ai/users/${userId}/ws`;
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
        const newWs = new WebSocket(wsUrl);
        newWs.onopen = wsConnection.onopen;
        newWs.onmessage = wsConnection.onmessage;
        newWs.onclose = wsConnection.onclose;
      }, 5000);
    };

    return () => {
      if (wsConnection) {
        wsConnection.close();
      }
    };
  }, []); // Run only once on mount

  // Fetch trade history
  const fetchTradeHistory = async () => {
    try {
      const token = localStorage.getItem('token');
      const userId = localStorage.getItem('userId');
      
      // Get pending orders
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

      // Get completed orders
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
          `${API_URL}/copy-ai-orders/update-completed/user/${userId}`,
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
          `${API_URL}/copy-ai-orders/user/${userId}`,
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
      console.error('Error fetching trade data:', error);
      if (error.response?.status === 401) {
        localStorage.removeItem('token');
        window.location.href = '/login';
      }
      toast.error('Failed to fetch trading data. Please check your connection.');
    }
  };

  // Calculate total profit
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

  // Fetch strategies
  useEffect(() => {
    const fetchStrategies = async () => {
      try {
        setLoading(true);
        const userId = localStorage.getItem('userId');
        const token = localStorage.getItem('token');

        // Fetch default strategies
        const defaultResponse = await axios.get(
          `${API_URL}/strategies/user/admin`,
          {
            headers: { 'Authorization': `Bearer ${token}` }
          }
        );

        let allStrategies = [];
        
        if (defaultResponse.data.success) {
          const defaultStrategies = defaultResponse.data.data.map(s => ({
            ...s,
            isDefault: true
          }));
          allStrategies = [...defaultStrategies];
        }

        // Fetch user strategies
        const userResponse = await axios.get(
          `${API_URL}/strategies/user/${userId}`,
          {
            headers: { 'Authorization': `Bearer ${token}` }
          }
        );

        if (userResponse.data.success) {
          allStrategies = [...allStrategies, ...userResponse.data.data];
        }

        setStrategies(allStrategies);

        if (!selectedStrategy && allStrategies.length > 0) {
          handleStrategySelect(allStrategies[0]);
        }

      } catch (error) {
        console.error('Error fetching strategies:', error);
        toast.error('Failed to load strategies');
      } finally {
        setLoading(false);
      }
    };

    fetchStrategies();
  }, []);

  // Handle strategy selection
  const handleStrategySelect = (strategy) => {
    if (!strategy || isTrading) return;
    
    // Ensure strategy has all required properties
    const formattedStrategy = {
      name: strategy.name,
      parameters: {
        follow_candle: strategy.follow_candle || '',
        capital_management: strategy.capital_management || '',
        sl_tp: strategy.sl_tp || '',
        ...strategy.parameters // Include any existing parameters
      },
      id: strategy.id,
      isDefault: strategy.isDefault || false
    };
    
    setSelectedStrategy(formattedStrategy);
    setCapitalManagement(strategy.capital_management || '');
    setStopLoss(strategy.sl_tp || '');
    setShowDropdown(false);
    
    localStorage.setItem('selectedStrategy', JSON.stringify(formattedStrategy));
  };

  // Start trading
  const startTrading = async () => {
    if (!selectedStrategy) return;
    
    try {
      setStartingTrade(true);
      const token = localStorage.getItem('token');
      const userId = localStorage.getItem('userId');

      // Ensure strategy object has required structure
      const tradingStrategy = {
        name: selectedStrategy.name,
        parameters: {
          follow_candle: selectedStrategy.parameters?.follow_candle || selectedStrategy.follow_candle || '',
          capital_management: selectedStrategy.parameters?.capital_management || selectedStrategy.capital_management || '',
          sl_tp: selectedStrategy.parameters?.sl_tp || selectedStrategy.sl_tp || '',
          ...selectedStrategy.parameters
        }
      };


      const response = await axios.post(
        `${API_URL}/copy-ai/users/${userId}/start`,
        { strategy: tradingStrategy },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.data.error === 0) {
        setIsTrading(true);
        toast.success('Trading started successfully');
        await fetchTradeHistory();
      } else {
        toast.error(response.data.message || 'Failed to start trading');
        console.error('Trading start error:', response.data);
      }
    } catch (error) {
      console.error('Error starting trading:', error.response?.data || error);
      toast.error(error.response?.data?.message || 'Failed to start trading. Please try again.');
    } finally {
      setStartingTrade(false);
    }
  };

  // Stop trading
  const stopTrading = async () => {
    try {
      setStoppingTrade(true);
      const token = localStorage.getItem('token');
      const userId = localStorage.getItem('userId');

      const response = await axios.post(
        `${API_URL}/copy-ai/users/${userId}/stop`,
        {},
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
        await fetchTradeHistory(); // Fetch latest state
      } else {
        toast.error(response.data.message || 'Failed to stop trading');
      }
    } catch (error) {
      console.error('Error stopping trading:', error);
      toast.error('Failed to stop trading. Please try again.');
    } finally {
      setStoppingTrade(false);
    }
  };

  // Format date for display
  const formatDateTime = (dateString) => {
    const date = new Date(dateString);
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes} ${day}/${month}/${year}`;
  };

  // Render trade row
  const renderTradeRow = (trade) => (
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
      <td className="py-4 px-4 text-sm text-white/70">{trade.open || '-'}</td>
      <td className="py-4 px-4 text-sm text-white/70">{trade.close || '-'}</td>
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
  );

  return (
    <div className="space-y-6">
      <div className="bg-[#0F1A2E] rounded-xl p-6">
        <h2 className="text-white text-lg font-medium mb-6">COPY THEO AI</h2>
        
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
                <span>{selectedStrategy?.name || 'Chọn chiến lược'}</span>
                <FaChevronDown className={`transform transition-transform ${showDropdown ? 'rotate-180' : ''}`} />
              </button>
              
              {showDropdown && !isTrading && (
                <div className="absolute z-10 w-full mt-2 bg-[#0B1221] rounded-lg shadow-lg max-h-60 overflow-y-auto">
                  {strategies.map((strategy) => (
                    <button
                      key={strategy.id}
                      onClick={() => handleStrategySelect(strategy)}
                      className={`w-full text-left px-4 py-3 text-white hover:bg-[#1A2A3F] transition-colors flex items-center justify-between ${
                        selectedStrategy?.id === strategy.id ? 'bg-[#1A2A3F]' : ''
                      }`}
                    >
                      <div className="flex flex-col">
                        <span>{strategy.name}</span>
                        <span className="text-sm text-white/70">Pattern: {strategy.follow_candle || strategy.parameters?.follow_candle || 'N/A'}</span>
                        <span className="text-sm text-white/70">Capital: {strategy.capital_management || strategy.parameters?.capital_management || 'N/A'}</span>
                        <span className="text-sm text-white/70">SL/TP: {strategy.sl_tp || strategy.parameters?.sl_tp || 'N/A'}</span>
                      </div>
                      {strategy.isDefault && (
                        <span className="text-xs text-[#00D88A] px-2 py-1 rounded-full border border-[#00D88A]">
                          Mặc định
                        </span>
                      )}
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
              onClick={startTrading}
              disabled={!selectedStrategy || startingTrade}
              className={`${
                selectedStrategy && !startingTrade
                  ? 'bg-[#00D88A] hover:bg-opacity-90'
                  : 'bg-gray-500 cursor-not-allowed'
              } text-white px-8 py-3 rounded-lg flex items-center gap-2 transition-colors`}
            >
              {startingTrade ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <FaPlay className="w-4 h-4" />
              )}
              <span>{startingTrade ? 'Starting...' : 'Bắt đầu chạy'}</span>
            </button>
          ) : (
            <button 
              onClick={stopTrading}
              disabled={stoppingTrade}
              className="bg-red-500 text-white px-8 py-3 rounded-lg flex items-center gap-2 hover:bg-opacity-90 transition-colors disabled:opacity-75 disabled:cursor-not-allowed"
            >
              {stoppingTrade ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <FaStop className="w-4 h-4" />
              )}
              <span>{stoppingTrade ? 'Stopping...' : 'Dừng'}</span>
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
                  .map(trade => renderTradeRow(trade))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default CopyAi; 