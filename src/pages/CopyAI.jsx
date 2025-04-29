import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { FaPlay, FaStop, FaChevronDown } from 'react-icons/fa';
import tradingService from '../services/TradingService';

const API_URL = process.env.REACT_APP_API_URL;
const API_URL2 = process.env.REACT_APP_API_URL2;

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

  // Fetch trade history
  const fetchTradeHistory = async () => {
    try {
      const token = localStorage.getItem('token');
      const userId = localStorage.getItem('userId');
      
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
      console.error('Error fetching trade history:', error);
      if (error.response?.status === 401) {
        localStorage.removeItem('token');
        window.location.href = '/login';
      }
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

  // Handle trading service events
  useEffect(() => {
    const unsubscribe = tradingService.subscribe((event) => {
      switch (event.type) {
        case 'WS_CONNECTED':
          setWsConnected(true);
          break;
        case 'WS_DISCONNECTED':
          setWsConnected(false);
          break;
        case 'NEW_TRADE':
          setPendingTrades(prev => [event.data, ...prev]);
          break;
        case 'CANDLE_PROCESSED':
          fetchTradeHistory();
          break;
        case 'ERROR':
          setError(event.error);
          break;
        case 'TRADING_STOPPED':
          setIsTrading(false);
          break;
        default:
          break;
      }
    });

    return () => unsubscribe();
  }, []);

  // Initialize component
  useEffect(() => {
    const initializeComponent = async () => {
      try {
        // Get current trading status
        const status = tradingService.getStatus();
        setIsTrading(status.isTrading);
        
        if (status.strategy) {
          setSelectedStrategy(status.strategy);
          setCapitalManagement(status.strategy.capital_management || '');
          setStopLoss(status.strategy.sl_tp || '');
        } else {
          // Only restore from localStorage if no active trading
          const savedStrategy = localStorage.getItem('selectedStrategy');
          if (savedStrategy) {
            const strategy = JSON.parse(savedStrategy);
            setSelectedStrategy(strategy);
            setCapitalManagement(strategy.capital_management || '');
            setStopLoss(strategy.sl_tp || '');
          }
        }

        // Fetch initial trade history
        await fetchTradeHistory();
        
        // Set up history fetching interval
        const historyInterval = setInterval(fetchTradeHistory, 30000);

        return () => clearInterval(historyInterval);
      } catch (error) {
        console.error('Error initializing component:', error);
      }
    };

    initializeComponent();
  }, []);

  // Fetch strategies on mount
  useEffect(() => {
    const fetchStrategies = async () => {
      try {
        setLoading(true);
        const userId = localStorage.getItem('userId');

        // Fetch default strategies
        const defaultResponse = await axios.get(`${API_URL}/strategies/user/admin`);
        let allStrategies = [];
        
        if (defaultResponse.data.success) {
          const defaultStrategies = defaultResponse.data.data.map(s => ({
            ...s,
            isDefault: true
          }));
          allStrategies = [...defaultStrategies];
        }

        // Fetch user strategies
        const userResponse = await axios.get(`${API_URL}/strategies/user/${userId}`);
        if (userResponse.data.success) {
          allStrategies = [...allStrategies, ...userResponse.data.data];
        }

        setStrategies(allStrategies);

        // Get current trading status
        const status = tradingService.getStatus();
        
        // If there's an active strategy in the trading service, use that
        if (status.isTrading && status.strategy) {
          const activeStrategy = allStrategies.find(s => s.id === status.strategy.id);
          if (activeStrategy) {
            handleStrategySelect(activeStrategy);
            return;
          }
        }

        // If no active strategy, try to restore from localStorage
        const savedStrategyJson = localStorage.getItem('selectedStrategy');
        if (savedStrategyJson) {
          const savedStrategy = JSON.parse(savedStrategyJson);
          const matchingStrategy = allStrategies.find(s => s.id === savedStrategy.id);
          if (matchingStrategy) {
            handleStrategySelect(matchingStrategy);
            return;
          }
        }

        // If no saved strategy found, select first available strategy
        if (allStrategies.length > 0) {
          handleStrategySelect(allStrategies[0]);
        }

      } catch (error) {
        setError('Failed to load strategies');
      } finally {
        setLoading(false);
      }
    };

    fetchStrategies();
  }, []);

  // Handle strategy selection
  const handleStrategySelect = (strategy) => {
    if (!strategy) return;

    // If currently trading with a different strategy, stop trading
    const status = tradingService.getStatus();
    if (status.isTrading && status.strategy?.id !== strategy.id) {
      tradingService.stopTrading();
    }
    
    setSelectedStrategy(strategy);
    setCapitalManagement(strategy.capital_management || '');
    setStopLoss(strategy.sl_tp || '');
    setShowDropdown(false);
    
    localStorage.setItem('selectedStrategy', JSON.stringify(strategy));

    // If we were trading, restart with new strategy
    if (status.isTrading) {
      tradingService.startTrading(strategy);
    }
  };

  // Start trading
  const startTrading = async () => {
    if (!selectedStrategy) return;
    setIsTrading(true);
    await tradingService.startTrading(selectedStrategy);
  };

  // Stop trading
  const stopTrading = () => {
    tradingService.stopTrading();
    setIsTrading(false);
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
                onClick={() => setShowDropdown(!showDropdown)}
                className="w-full bg-[#0B1221] rounded-lg p-4 text-white text-sm border-0 focus:ring-1 focus:ring-[#00D88A] outline-none flex items-center justify-between"
              >
                <span>{selectedStrategy?.name || 'Chọn chiến lược'}</span>
                <FaChevronDown className={`transform transition-transform ${showDropdown ? 'rotate-180' : ''}`} />
              </button>
              
              {showDropdown && (
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
                        <span className="text-sm text-white/70">Pattern: {strategy.follow_candle}</span>
                        <span className="text-sm text-white/70">Capital: {strategy.capital_management}</span>
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
              disabled={!selectedStrategy}
              className={`${
                selectedStrategy ? 'bg-[#00D88A] hover:bg-opacity-90' : 'bg-gray-500 cursor-not-allowed'
              } text-white px-8 py-3 rounded-lg flex items-center gap-2 transition-colors`}
            >
              <FaPlay className="w-4 h-4" />
              <span>Bắt đầu chạy</span>
            </button>
          ) : (
            <button 
              onClick={stopTrading}
              className="bg-red-500 text-white px-8 py-3 rounded-lg flex items-center gap-2 hover:bg-opacity-90 transition-colors"
            >
              <FaStop className="w-4 h-4" />
              <span>Dừng</span>
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