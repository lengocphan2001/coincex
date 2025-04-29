import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { FaPlay, FaStop, FaChevronDown } from 'react-icons/fa';
import expertTradingService from '../services/ExpertTradingService';

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

  const bots = [
    { id: 1, name: 'Expert Bot 1', follow_candle: 'd', capital_management: '1-2-4-8', sl_tp: '30/60' },
  ];

  // Handle trading service events
  useEffect(() => {
    const unsubscribe = expertTradingService.subscribe((event) => {
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
        const status = expertTradingService.getStatus();
        setIsTrading(status.isTrading);
        
        if (status.bot) {
          setSelectedBot(status.bot);
          setCapitalManagement(status.bot.capital_management);
          setStopLoss(status.bot.sl_tp);
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

  const handleBotSelect = (bot) => {
    if (!bot) return;

    // If currently trading with a different bot, stop trading
    const status = expertTradingService.getStatus();
    if (status.isTrading && status.bot?.id !== bot.id) {
      expertTradingService.stopTrading();
    }
    
    setSelectedBot(bot);
    setCapitalManagement(bot.capital_management);
    setStopLoss(bot.sl_tp);
    setShowDropdown(false);

    // If we were trading, restart with new bot
    if (status.isTrading) {
      expertTradingService.startTrading(bot);
    }
  };

  const startTrading = async () => {
    if (!selectedBot) return;
    setIsTrading(true);
    await expertTradingService.startTrading(selectedBot);
  };

  const stopTrading = () => {
    expertTradingService.stopTrading();
    setIsTrading(false);
  };

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
  );

  return (
    <div className="space-y-6">
      <div className="bg-[#0F1A2E] rounded-xl p-6">
        <h2 className="text-white text-lg font-medium mb-6">COPY THEO EXPERT</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="relative">
              <label className="block text-white/70 text-sm mb-2">Expert</label>
              <button
                type="button"
                onClick={() => setShowDropdown(!showDropdown)}
                className="w-full bg-[#0B1221] rounded-lg p-4 text-white text-sm border-0 focus:ring-1 focus:ring-[#00D88A] outline-none flex items-center justify-between"
              >
                <span>{selectedBot ? selectedBot.name : 'Chọn Expert'}</span>
                <FaChevronDown className={`transform transition-transform ${showDropdown ? 'rotate-180' : ''}`} />
              </button>
              
              {showDropdown && (
                <div className="absolute z-10 w-full mt-2 bg-[#0B1221] rounded-lg shadow-lg max-h-60 overflow-y-auto">
                  {bots.map((bot) => (
                    <button
                      key={bot.id}
                      onClick={() => handleBotSelect(bot)}
                      className="w-full text-left px-4 py-3 text-white hover:bg-[#1A2A3F] transition-colors flex items-center justify-between"
                    >
                      <div className="flex flex-col">
                        <span>{bot.name}</span>
                        <span className="text-sm text-white/70">Capital: {bot.capital_management}</span>
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
              onClick={startTrading}
              disabled={!selectedBot}
              className={`${
                selectedBot ? 'bg-[#00D88A] hover:bg-opacity-90' : 'bg-gray-500 cursor-not-allowed'
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

export default CopyExpert; 