import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { FaPlay, FaStop, FaChevronDown } from 'react-icons/fa';
import useWebSocket from 'react-use-websocket';
import { BINANCE_WSS_URL } from '../config/constants';

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
  const capitalIndexRef = useRef(0);
  const [tradingInterval, setTradingInterval] = useState(null);
  const [lastCandleTime, setLastCandleTime] = useState(null);
  const [nextCandleTime, setNextCandleTime] = useState(null);
  const [wsConnected, setWsConnected] = useState(false);
  const [historyInterval, setHistoryInterval] = useState(null);

  // WebSocket connection for real-time candle updates
  const { lastJsonMessage, readyState, sendJsonMessage } = useWebSocket(
    `${BINANCE_WSS_URL}/ws/btcusdt@kline_1m`,
    {
      shouldConnect: true,  // Always connect since we're using fixed symbol
      onOpen: () => {
        setWsConnected(true);
      },
      onClose: () => {
        console.log('WebSocket disconnected at:', new Date().toLocaleTimeString());
        setWsConnected(false);
      },
      onError: (error) => {
        console.error('WebSocket error:', error);
        setWsConnected(false);
      },
      onMessage: (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.e === 'kline') {
            const candle = data.k;
            const currentTime = new Date();
            const candleCloseTime = new Date(candle.t);
            const nextCandleTime = new Date(candle.t + 60000);
            
            setLastCandleTime(candleCloseTime);
            setNextCandleTime(nextCandleTime);
          }
        } catch (error) {
          console.error('Error processing WebSocket message:', error);
        }
      }
    }
  );

  useEffect(() => {
    if (selectedStrategy && selectedStrategy.symbol) {
      console.log('Selected strategy changed:', selectedStrategy.symbol);
    }
  }, [selectedStrategy]);

  useEffect(() => {
  }, [readyState, wsConnected, selectedStrategy]);

  const getUserId = () => {
    return localStorage.getItem('userId');
  };

  // Set up history fetching interval
  useEffect(() => {
    fetchTradeHistory();

    const interval = setInterval(fetchTradeHistory, 60000);
    setHistoryInterval(interval);

    return () => {
      if (historyInterval) {
        clearInterval(historyInterval);
      }
    };
  }, []);

  const startTrading = async () => {
    if (!selectedStrategy) return;

    try {
      setIsTrading(true);
      setError('');
      console.log('Starting trading at:', new Date().toLocaleTimeString());

      const requiredLength = getPatternLength(selectedStrategy.follow_candle);

      const response = await axios.get(`${API_URL}/klines`, {
        params: {
          symbol: 'BTCUSDT',
          interval: '1m',
          limit: requiredLength
        }
      });

      if (!response.data || response.data.length < requiredLength) {
        throw new Error('Could not get enough initial candles');
      }

      const latestCandles = response.data.map(kline => ({
        open: parseFloat(kline[1]),
        close: parseFloat(kline[4]),
        isGreen: parseFloat(kline[4]) > parseFloat(kline[1]),
        closeTime: new Date(kline[6])
      }));


      // Store the last candle time to avoid duplicate checks
      let lastProcessedCandleTime = latestCandles[latestCandles.length - 1].closeTime.getTime();

      // Use WebSocket data for updates
      const wsHandler = async (event) => {
        try {
        const data = JSON.parse(event.data);
          
          if (data.e === 'kline' && data.k.x) { // Only process completed candles
            const candle = data.k;
            const candleCloseTime = new Date(candle.T).getTime();

            // Prevent duplicate processing
            if (candleCloseTime <= lastProcessedCandleTime) {
              return;
            }
            console.log('Candle close time:', new Date(candleCloseTime).toLocaleTimeString());

            const response = await axios.get(`${API_URL}/klines`, {
              params: {
                symbol: 'BTCUSDT',
                interval: '1m',
                limit: requiredLength
              }
            });

            if (response.data && response.data.length >= requiredLength) {
              const latestCandles = response.data.map(kline => ({
                open: parseFloat(kline[1]),
                close: parseFloat(kline[4]),
                isGreen: parseFloat(kline[4]) > parseFloat(kline[1]),
                closeTime: new Date(kline[6])
              }));

              lastProcessedCandleTime = candleCloseTime;

              const currentPattern = latestCandles
                .map(candle => candle.isGreen ? 'x' : 'd')
                .join('-');


              if (currentPattern === selectedStrategy.follow_candle) {
                const lastCandle = latestCandles[latestCandles.length - 1];
                const tradeType = lastCandle.isGreen ? 'short' : 'long';
                await executeTrade(tradeType);
              }

              // Update trade history after pattern check
              await fetchTradeHistory();
            }
          }
        } catch (error) {
          console.error('Error processing WebSocket message:', error);
        }
      };

      // Add WebSocket message handler
      const ws = new WebSocket(`wss://stream.binance.com/ws/btcusdt@kline_1m`);
      ws.onmessage = wsHandler;
      ws.onclose = () => {
        setIsTrading(false);
      };

      // Store WebSocket reference for cleanup
      setTradingInterval(ws);
    } catch (error) {
      console.error('Error starting trading:', error);
      setError('Failed to start trading');
      setIsTrading(false);
    }
  };

  const stopTrading = async () => {
    console.log('Stopping trading');
    
    if (tradingInterval) {
      if (tradingInterval instanceof WebSocket) {
        tradingInterval.close();
      }
      setTradingInterval(null);
    }

    setIsTrading(false);
    capitalIndexRef.current = 0;
  };

  const handleStrategySelect = (strategy) => {
    console.log('Strategy selected:', strategy);
    
    setSelectedStrategy(strategy);
    setCapitalManagement(strategy.capital_management || '');
    setStopLoss(strategy.sl_tp || '');
    setShowDropdown(false);
    
    // Reset trading state when strategy changes
    if (isTrading) {
      stopTrading();
    }
    
    // Reset capital index
    capitalIndexRef.current = 0;
  };

  // Fetch strategies on component mount
  useEffect(() => {
    const initializeStrategies = async () => {
      try {
        setLoading(true);
        const userId = localStorage.getItem('userId');
        console.log('Fetching strategies for user:', userId);

        // Fetch default strategies first
        const defaultResponse = await axios.get(`${API_URL}/strategies/user/admin`);
        let allStrategies = [];
        
        if (defaultResponse.data.success) {
          const defaultStrategies = defaultResponse.data.data.map(s => ({
            ...s,
            isDefault: true
          }));
          allStrategies = [...defaultStrategies];
          console.log('Default strategies loaded:', defaultStrategies.length);
        }

        // Then fetch user strategies
        const userResponse = await axios.get(`${API_URL}/strategies/user/${userId}`);
        if (userResponse.data.success) {
          const userStrategies = userResponse.data.data;
          allStrategies = [...allStrategies, ...userStrategies];
          console.log('User strategies loaded:', userStrategies.length);
        }

        // Set strategies and select first one if available
        setStrategies(allStrategies);
        if (allStrategies.length > 0) {
          console.log('Auto-selecting first strategy:', allStrategies[0]);
          handleStrategySelect(allStrategies[0]);
        }

        setError('');
      } catch (error) {
        console.error('Error fetching strategies:', error);
        setError('Failed to load strategies');
      } finally {
        setLoading(false);
      }
    };

    initializeStrategies();
  }, []);

  // Monitor WebSocket connection
  useEffect(() => {
    const connectionStates = ['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED'];
    const currentState = connectionStates[readyState] || 'UNKNOWN';
    
    console.log('WebSocket Status:', {
      state: currentState,
      readyState,
      connected: wsConnected,
      selectedSymbol: selectedStrategy?.symbol
    });
  }, [readyState, wsConnected, selectedStrategy]);

  const formatDateTime = (dateString) => {
    const date = new Date(dateString);
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes} ${day}/${month}/${year}`;
  };

  const renderTradeRow = (trade, source) => (
    <tr className="border-b border-white/10">
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

  // Add this helper function to get capital amounts array
  const getCapitalAmounts = (capitalManagement) => {
    if (!capitalManagement) return [1]; // default fallback
    return capitalManagement.split('-').map(amount => parseFloat(amount));
  };

  // Modify calculateTradeAmount function
  const calculateTradeAmount = () => {
    const amounts = getCapitalAmounts(selectedStrategy.capital_management);
    const currentAmount = amounts[capitalIndexRef.current % amounts.length];
    
    return currentAmount;
  };

  // Add function to check pending orders
  const checkPendingOrders = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL2}/proxy/history-bo`, {
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

      if (response.data && Array.isArray(response.data.data)) {
        const hasPendingOrder = response.data.data.length > 0;
        console.log('Pending order check:', hasPendingOrder ? 'Has pending order' : 'No pending orders');
        return hasPendingOrder;
      }
      return false;
    } catch (error) {
      console.error('Error checking pending orders:', error);
      return false;
    }
  };

  // Modify executeTrade function to check for pending orders first
  const executeTrade = async (tradeType) => {
    try {
      const token = localStorage.getItem('token');
      const userId = localStorage.getItem('userId');
      const amount = calculateTradeAmount();
      
      const tradeData = {
        symbol: 'BTCUSDT',
        type: tradeType,
        amount: amount,
      };

      // Add 4-second delay before executing trade
      console.log('Preparing to execute trade, waiting 4 seconds...');
      await new Promise(resolve => setTimeout(resolve, 4000));

      const response = await axios.post(`${API_URL2}/proxy/trading-bo`, 
        tradeData,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.data.error === 0) {
        // Increment capital index after successful trade execution
        const amounts = getCapitalAmounts(selectedStrategy.capital_management);
        capitalIndexRef.current = (capitalIndexRef.current + 1) % amounts.length;

        const historyResponse = await axios.get(`${API_URL2}/proxy/history-bo`, {
          params: {
            status: 'pending',
            offset: 0,
            limit: 1
          },
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json'
          }
        });

        if (historyResponse.data.error === 0 && historyResponse.data.data && historyResponse.data.data.length > 0) {
          const pendingOrder = historyResponse.data.data[0];
          
          const orderData = {
            user_id: userId.toString(), 
            order_code: pendingOrder.order_code,
            type: tradeType,
            amount: amount,
            received_usdt: 0,
            session: pendingOrder.session,
            symbol: 'BTCUSDT',
            status: 'PENDING',
            bot: selectedStrategy.name,
          };


          const orderResponse = await axios.post(
            `${API_URL}/copy-ai-orders/user/${userId}`,
            orderData,
            {
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
              }
            }
          );

          if (orderResponse.data.error === 0) {
            console.log('✅ Trade executed and order created successfully');
            setPendingTrades(prev => [...prev, orderResponse.data.data]);
          }
        } else {
          setError('Failed to fetch order details');
        }
      }
    } catch (error) {
      setError(error.response?.data?.message || 'Failed to execute trade');
    }
  };

  // Add this helper function to get pattern length
  const getPatternLength = (pattern) => {
    return pattern.split('-').length;
  };

  // Add this function to calculate total profit
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

  // Modify fetchOrders function
  const fetchOrders = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');

      const response = await axios.get(`${API_URL}/copy-ai-orders/user/${getUserId()}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (response.data && response.data.data) {
        setHistory(response.data.data);
        const totalProfit = calculateTotalProfit(response.data.data);
        setCurrentProfit(totalProfit.toFixed(2));
        setError('');
      }
    } catch (error) {
      console.error('Error fetching orders:', error.response?.data || error);
      setError(error.response?.data?.message || 'Failed to fetch orders');
      
      if (error.response?.status === 401) {
        localStorage.removeItem('token');
        window.location.href = '/login';
      }
    } finally {
      setLoading(false);
    }
  };

  // Modify fetchTradeHistory function
  const fetchTradeHistory = async () => {
    try {
      const token = localStorage.getItem('token');
      const userId = localStorage.getItem('userId');
      
      const historyResponse = await axios.get(`${API_URL2}/proxy/history-bo`, {
        params: {
          status: 'completed',
          offset: 0,
          limit: 10
        },
        headers: {
          Authorization: `Bearer ${token}`,
          'Accept': 'application/json'
        }
      });

      if (!historyResponse.data) {
        console.error('No data received from history-bo');
        return;
      }

      const updateResponse = await axios.post(
        `${API_URL}/copy-ai-orders/update-completed/user/${userId}`,
        {
          completedOrders: historyResponse.data.data || []
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (updateResponse.data.error === 0) {
        const ordersResponse = await axios.get(
          `${API_URL}/copy-ai-orders/user/${userId}`,
          {
            headers: {
              Authorization: `Bearer ${token}`
            }
          }
        );

        if (ordersResponse.data.error === 0) {
          const trades = ordersResponse.data.data || [];
          setHistory(trades);
          // Clear pendingTrades that are now in history
          const pendingOrderCodes = trades
            .filter(trade => trade.status === 'PENDING')
            .map(trade => trade.order_code);
          setPendingTrades(prev => prev.filter(trade => 
            !trades.some(historyTrade => historyTrade.order_code === trade.order_code)
          ));
          const totalProfit = calculateTotalProfit(trades);
          setCurrentProfit(totalProfit.toFixed(2));
          setError('');
        } else {
          console.error('Error fetching orders:', ordersResponse.data);
          setError('Failed to fetch updated orders');
        }
      } else {
        console.error('Error updating orders:', updateResponse.data);
        setError('Failed to update order status');
      }
    } catch (error) {
      console.error('Error in fetchTradeHistory:', error.response?.data || error);
      if (error.response?.status === 401) {
        localStorage.removeItem('token');
        window.location.href = '/login';
      } else {
        setError(error.response?.data?.message || 'Failed to sync orders with trading history');
      }
    }
  };

  // Update component cleanup
  useEffect(() => {
    return () => {
      if (tradingInterval) {
        if (tradingInterval instanceof WebSocket) {
          tradingInterval.close();
        }
        setTradingInterval(null);
      }
      if (historyInterval) {
        clearInterval(historyInterval);
        setHistoryInterval(null);
      }
    };
  }, [tradingInterval, historyInterval]);

  // Add useEffect to fetch orders when component mounts
  useEffect(() => {
    fetchOrders();
  }, []);

  return (
    <div className="space-y-6">
      <div className="bg-[#0F1A2E] rounded-xl p-6">
        <h2 className="text-white text-lg font-medium mb-6">COPY THEO AI</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left Column */}
          <div className="space-y-4">
            <div className="relative">
              <label className="block text-white/70 text-sm mb-2">Chiến lược</label>
              <button
                type="button"
                onClick={() => setShowDropdown(!showDropdown)}
                className="w-full bg-[#0B1221] rounded-lg p-4 text-white text-sm border-0 focus:ring-1 focus:ring-[#00D88A] outline-none flex items-center justify-between"
              >
                <span>{selectedStrategy ? selectedStrategy.name : 'Chọn chiến lược'}</span>
                <FaChevronDown className={`transform transition-transform ${showDropdown ? 'rotate-180' : ''}`} />
              </button>
              
              {showDropdown && (
                <div className="absolute z-10 w-full mt-2 bg-[#0B1221] rounded-lg shadow-lg max-h-60 overflow-y-auto">
                  {strategies.map((strategy) => (
                    <button
                      key={strategy.id}
                      onClick={() => handleStrategySelect(strategy)}
                      className="w-full text-left px-4 py-3 text-white hover:bg-[#1A2A3F] transition-colors flex items-center justify-between"
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

          {/* Right Column */}
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

        {error && error !== 'Trading block busy, will try in next interval' && (
          <div className="mt-4 p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
            <p className="text-red-500 text-sm text-center">{error}</p>
          </div>
        )}
      </div>

      {/* Transaction History */}
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
                {[...pendingTrades, ...history]
                  .filter(trade => trade && trade.order_code && trade.createdAt) // Filter out invalid trades
                  .map(trade => renderTradeRow(trade, trade.status === 'PENDING' ? 'pending' : 'history'))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default CopyAi; 