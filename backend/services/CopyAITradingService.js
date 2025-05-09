const WebSocket = require('ws');
const axios = require('axios');
const logger = require('../utils/logger');
const pool = require('../config/database');

class CopyAITradingService {
  constructor() {
    this.tradingStates = new Map(); // userId -> trading state
    this.wsConnections = new Map(); // userId -> WebSocket connection
    this.subscribers = new Map(); // userId -> Set of WebSocket clients
    this.reconnectAttempts = new Map(); // userId -> number of reconnection attempts
    this.TRADING_PROXY_URL = process.env.TRADING_PROXY_URL || 'https://mon88.click/api';
    this.API_URL = process.env.API_URL || 'https://mon88.click/api';
    this.MAX_RECONNECT_ATTEMPTS = 10; // Increased from 5 to 10
    this.INITIAL_RECONNECT_DELAY = 1000; // 1 second
    this.MAX_RECONNECT_DELAY = 30000; // 30 seconds
    this.userTokens = new Map(); // userId -> token
    this.pendingOrdersCache = new Map(); // Cache for pending orders
    this.lastOrderCheckTime = new Map(); // Track last order check time
    this.ORDER_CHECK_INTERVAL = 5000; // Check orders every 5 seconds
    this.wsReconnectTimers = new Map(); // Track reconnection timers
    logger.info('CopyAITradingService initialized');
  }

  // Set token for a user
  setUserToken(userId, token) {
    this.userTokens.set(userId, token);
    logger.info(`Token set for user ${userId}`);
  }

  // Get token for a user
  getUserToken(userId) {
    const token = this.userTokens.get(userId);
    if (!token) {
      logger.error(`No token available for user ${userId}`);
      throw new Error('No token available for user');
    }
    return token;
  }

  // Get or create trading state for a user
  getTradingState(userId) {
    if (!this.tradingStates.has(userId)) {
      this.tradingStates.set(userId, {
        isTrading: false,
        strategy: null,
        capitalIndex: 0,
        lastProcessedTime: null,
        isExecutingTrade: false,
        lastOrderStatus: null,
        consecutiveLosses: 0,
        firstTrade: true // Add flag for first trade
      });
    }
    return this.tradingStates.get(userId);
  }

  // Update trading state and notify subscribers
  updateTradingState(userId, updates) {
    const state = this.getTradingState(userId);
    Object.assign(state, updates);
    this.notifySubscribers(userId, { type: 'STATE_UPDATE', data: state });
  }

  // Subscribe a client to trading updates
  subscribe(userId, ws) {
    if (!this.subscribers.has(userId)) {
      this.subscribers.set(userId, new Set());
    }
    this.subscribers.get(userId).add(ws);

    // Send initial state
    const state = this.getTradingState(userId);
    ws.send(JSON.stringify({ type: 'STATE_UPDATE', data: state }));

    // Handle client disconnect
    ws.on('close', () => {
      this.subscribers.get(userId).delete(ws);
    });
  }

  // Notify all subscribers for a user
  notifySubscribers(userId, message) {
    const subs = this.subscribers.get(userId);
    if (subs) {
      const payload = JSON.stringify(message);
      subs.forEach(ws => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(payload);
        }
      });
    }
  }

  // Start trading for a user
  async startTrading(userId, strategy, token) {
    logger.info(`[START] Attempting to start trading for user ${userId}`);

    // Validate inputs
    if (!strategy || !strategy.name || !strategy.parameters) {
      logger.error(`[START] Invalid strategy configuration for user ${userId}:`, strategy);
      return { error: 1, message: 'Invalid strategy configuration' };
    }

    if (!token) {
      logger.error(`[START] No token provided for user ${userId}`);
      return { error: 1, message: 'Authentication token required' };
    }

    try {
      // Store token for future use
      this.setUserToken(userId, token);
      logger.info(`[START] Token set for user ${userId}`);

      // Initialize trading state
      const state = this.getTradingState(userId);
      if (state.isTrading) {
        logger.info(`[START] Trading already in progress for user ${userId}`);
        return { error: 1, message: 'Trading already in progress' };
      }

      // Log strategy parameters for debugging
      logger.info(`[START] Strategy parameters:`, {
        name: strategy.name,
        parameters: strategy.parameters,
        capitalManagement: strategy.parameters.capitalManagement,
        capital_management: strategy.parameters.capital_management
      });

      // Validate strategy pattern
      const pattern = strategy.parameters.follow_candle;
      if (!pattern || typeof pattern !== 'string' || !pattern.match(/^[xd](-[xd])*$/)) {
        logger.error(`[START] Invalid pattern for user ${userId}: ${pattern}`);
        return { error: 1, message: 'Invalid pattern format. Pattern must be in the format: x-d-x or similar' };
      }

      // Update trading state with reset capitalIndex
      state.strategy = strategy;
      state.isTrading = true;
      state.lastProcessedTime = null;
      state.capitalIndex = 0;
      state.consecutiveLosses = 0;
      state.isExecutingTrade = false;
      state.lastOrderStatus = null;
      state.firstTrade = true; // Set first trade flag to true

      // Save state
      this.saveState(userId);
      logger.info(`[START] Trading state initialized for user ${userId} with strategy ${strategy.name}`);

      // Start WebSocket connection
      await this.connectWebSocket(userId);
      logger.info(`[START] Trading started successfully for user ${userId}`);

      return { error: 0, message: 'Trading started successfully' };

    } catch (error) {
      logger.error(`[START] Error starting trading for user ${userId}:`, error);
      this.stopTrading(userId);
      return { error: 1, message: 'Failed to start trading: ' + (error.message || 'Unknown error') };
    }
  }

  saveState(userId) {
    const state = this.getTradingState(userId);
    logger.info(`[STATE] Saving state for user ${userId}:`, {
      isTrading: state.isTrading,
      strategyName: state.strategy?.name,
      capitalIndex: state.capitalIndex
    });
  }

  // Stop trading for a user
  stopTrading(userId) {
    const connection = this.wsConnections.get(userId);
    if (connection) {
      connection.close();
      this.wsConnections.delete(userId);
    }

    // Reset reconnection attempts
    this.reconnectAttempts.delete(userId);

    this.updateTradingState(userId, {
      isTrading: false,
      strategy: null,
      capitalIndex: 0,
      lastProcessedTime: null,
      isExecutingTrade: false
    });

    return { error: 0, message: 'Trading stopped successfully' };
  }

  // Process a candle and execute trades if pattern matches
  async processCandle(userId, candle) {
    const state = this.getTradingState(userId);
    if (!state.isTrading || !state.strategy) {
      logger.debug(`[CANDLE] Skipping candle processing - trading not active for user ${userId}`);
      return;
    }

    if (state.isExecutingTrade) {
      logger.debug(`[CANDLE] Skipping candle processing - trade in progress for user ${userId}`);
      return;
    }

    const candleTime = new Date(candle.t).getTime();
    
    // Only skip if it's exactly the same timestamp, allow updates to the current candle
    if (state.lastProcessedTime && candleTime < state.lastProcessedTime) {
      logger.debug(`[CANDLE] Skipping older candle for user ${userId}`);
      return;
    }

    try {
      logger.info(`[CANDLE] Processing candle for user ${userId} at ${new Date(candleTime).toISOString()}`);
      
      // Update the last processed time only after successful processing
      const response = await axios.get('https://api.binance.com/api/v3/klines', {
        params: {
          symbol: 'BTCUSDT',
          interval: '1m',
          limit: 5
        }
      });

      if (!response.data || response.data.length < 5) {
        logger.warn(`[CANDLE] Insufficient candle data for user ${userId}`);
        return;
      }

      const latestCandles = response.data.map(kline => ({
        open: parseFloat(kline[1]),
        close: parseFloat(kline[4]),
        isGreen: parseFloat(kline[4]) > parseFloat(kline[1])
      }));

      // Get AI prediction based on candles
      const prediction = await this.getAIPrediction(state.strategy, latestCandles);
      if (state.strategy.parameters.follow_candle === '') {
        const tradeType = Math.random() < 0.5 ? 'short' : 'long';
        await this.executeTrade(userId, tradeType);
      }
      else if (prediction) {
        const tradeType = Math.random() < 0.5 ? 'short' : 'long';
        await this.executeTrade(userId, tradeType);
      }

      // Only update lastProcessedTime after successful processing
      state.lastProcessedTime = candleTime;
      this.saveState(userId);

      this.notifySubscribers(userId, {
        type: 'CANDLE_PROCESSED',
        data: { time: candleTime }
      });
    } catch (error) {
      logger.error(`[CANDLE] Error processing candle for user ${userId}:`, error);
    }
  }

  // Optimize order fetching with caching
  async fetchOrders(userId, type = 'all') {
    const token = this.getUserToken(userId);
    const now = Date.now();

    try {
      logger.info(`[ORDERS] Fetching ${type} orders for user ${userId}`);
      const [pendingResponse, completedResponse] = await Promise.all([
        axios.get(`${this.TRADING_PROXY_URL}/proxy/history-bo`, {
          params: { status: 'pending', offset: 0, limit: 10 },
          headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' }
        }),
        type === 'all' ? axios.get(`${this.TRADING_PROXY_URL}/proxy/history-bo`, {
          params: { status: 'completed', offset: 0, limit: 10 },
          headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' }
        }) : Promise.resolve({ data: { data: [] } })
      ]);

      const pendingOrders = pendingResponse.data?.data || [];
      this.pendingOrdersCache.set(userId, pendingOrders);
      this.lastOrderCheckTime.set(userId, now);

      logger.info(`[ORDERS] Fetched orders for user ${userId}: ${pendingOrders.length} pending, ${completedResponse.data?.data?.length || 0} completed`);

      return {
        pending: pendingOrders,
        completed: completedResponse.data?.data || []
      };
    } catch (error) {
      logger.error(`[ORDERS] Error fetching orders for user ${userId}:`, error);
      throw error;
    }
  }

  async hasPendingOrders(userId) {
    try {
      const { pending } = await this.fetchOrders(userId, 'pending');
      const hasPending = pending.length > 0;
      logger.info(`[ORDERS] Pending orders check for user ${userId}: ${hasPending}`);
      return hasPending;
    } catch (error) {
      logger.error(`[ORDERS] Error checking pending orders for user ${userId}:`, error);
      return true; // Assume there are pending orders on error to prevent new trades
    }
  }

  getCapitalAmounts(state) {
    if (!state || !state.strategy?.parameters) {
      logger.warn('[CAPITAL] Invalid state or missing parameters, using default [1]');
      return [1];
    }

    const capitalManagement = state.strategy.parameters.capitalManagement || state.strategy.parameters.capital_management;

    if (!capitalManagement || typeof capitalManagement !== 'string') {
      logger.warn('[CAPITAL] Invalid capital management string, using default [1]');
      return [1];
    }

    try {
      // Parse and validate amounts
      const amounts = capitalManagement.split('-')
        .map(amount => {
          const parsed = parseFloat(amount.trim());
          if (isNaN(parsed) || parsed <= 0) {
            throw new Error(`Invalid amount: ${amount}`);
          }
          return parsed;
        });

      if (amounts.length === 0) {
        logger.warn('[CAPITAL] No valid amounts found in capital management string, using default [1]');
        return [1];
      }

      logger.info('[CAPITAL] Parsed amounts:', amounts);
      return amounts;
    } catch (error) {
      logger.error('[CAPITAL] Error parsing capital management:', error);
      return [1];
    }
  }

  calculateTradeAmount(state) {
    if (!state || !state.strategy?.parameters) {
      logger.warn('[AMOUNT] No strategy parameters found, using default amount 1');
      return 1;
    }

    const amounts = this.getCapitalAmounts(state);

    const amount = amounts[state.capitalIndex % amounts.length];
    

    return amount;
  }

  // Get AI prediction
  async getAIPrediction(strategy, candles) {
    try {
      // Get pattern from follow_candle parameter
      const pattern = strategy.parameters.follow_candle;
      if (!pattern) {
        logger.error('Missing follow_candle pattern in strategy parameters');
        return null;
      }

      // Convert candles to pattern format (x for green, d for red)
      const currentPattern = candles
        .slice(-pattern.split('-').length)
        .map(candle => candle.isGreen ? 'x' : 'd')
        .join('-');

      logger.info(`Comparing patterns - Current: ${currentPattern}, Target: ${pattern}`);

      if (currentPattern === pattern) {
        const lastCandle = candles[candles.length - 1];
        return {
          type: lastCandle.isGreen ? 'short' : 'long',
          symbol: 'BTCUSDT'
        };
      }
      
      return null;
    } catch (error) {
      logger.error('Error getting AI prediction:', error);
      return null;
    }
  }

  async executeTrade(userId, tradeType) {
    const state = this.getTradingState(userId);
    
    if (!state.isTrading || state.isExecutingTrade) {
      logger.info(`[TRADE] Skipping trade - ${!state.isTrading ? 'trading not active' : 'trade in progress'} for user ${userId}`);
      return;
    }

    const baseIndex = state.capitalIndex;
    const baseConsecutiveLosses = state.consecutiveLosses;
    try {
      state.isExecutingTrade = true;

      await new Promise(resolve => setTimeout(resolve, 3000));

      const lastOrder = await this.checkLastCompletedOrder(userId);
      
      // Only update capital index if it's not the first trade
      if (!state.firstTrade) {
        this.updateCapitalIndex(state, lastOrder?.status);
      } else {
        // For first trade, keep capitalIndex at 0
        state.capitalIndex = 0;
        state.firstTrade = false; // Set first trade flag to false after first trade
      }
      
      const hasPending = await this.hasPendingOrders(userId);
      if (hasPending) {
        logger.info(`[TRADE] Skipping trade - pending order exists for user ${userId}`);
        return;
      }

      const token = this.getUserToken(userId);
      const amount = this.calculateTradeAmount(state);
      
      const tradeData = {
        symbol: 'BTCUSDT',
        type: tradeType,
        amount: amount
      };

      const tradeResponse = await axios.post(
        `${this.TRADING_PROXY_URL}/proxy/trading-bo`,
        tradeData,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (tradeResponse.data.error === 0) {
        const { pending } = await this.fetchOrders(userId, 'pending');
        const latestOrder = pending[0];

        if (latestOrder) {
          const orderData = {
            user_id: userId.toString(),
            order_code: latestOrder.order_code,
            type: tradeType,
            amount: amount,
            received_usdt: 0,
            session: latestOrder.session,
            symbol: 'BTCUSDT',
            status: 'PENDING',
            strategy: state.strategy.name,
            bot: state.strategy.name,
            createdAt: new Date().toISOString()
          };

          // Create order in database immediately
          const createOrderResponse = await axios.post(
            `${this.API_URL}/copy-ai-orders/user/${userId}`,
            orderData,
            {
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
              }
            }
          );

          if (createOrderResponse.data.error === 0) {
            // Notify subscribers about the new trade
            this.notifySubscribers(userId, { 
              type: 'NEW_TRADE', 
              data: orderData 
            });

            // Start monitoring the order status
            this.monitorOrderStatus(userId, latestOrder.order_code);
          }
        }
      } else {
        state.capitalIndex = baseIndex;
        state.consecutiveLosses = baseConsecutiveLosses;
        this.notifySubscribers(userId, { 
          type: 'ERROR', 
          error: 'Trade execution failed. Please check your connection and try again.' 
        });
      }
    } catch (error) {
      state.capitalIndex = baseIndex;
      state.consecutiveLosses = baseConsecutiveLosses;
      logger.error(`[TRADE] Error executing trade for user ${userId}:`, error);
      this.notifySubscribers(userId, { 
        type: 'ERROR', 
        error: 'Failed to execute trade. Please check your connection and try again.' 
      });
    } finally {
      state.isExecutingTrade = false;
    }
  }

  // Add new method to monitor order status
  async monitorOrderStatus(userId, orderCode) {
    const token = this.getUserToken(userId);
    const checkInterval = 5000; // Check every 5 seconds
    const maxAttempts = 12; // Maximum 1 minute of checking

    let attempts = 0;
    const checkOrder = async () => {
      try {
        const response = await axios.get(`${this.TRADING_PROXY_URL}/proxy/history-bo`, {
          params: {
            order_code: orderCode,
            status: 'completed'
          },
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json'
          }
        });

        if (response.data?.data?.length > 0) {
          const completedOrder = response.data.data[0];
          
          // Update the order in database immediately
          await axios.post(
            `${this.API_URL}/copy-ai-orders/update-completed/user/${userId}`,
            { completedOrders: [completedOrder] },
            {
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
              }
            }
          );

          // Notify subscribers about the order completion
          this.notifySubscribers(userId, {
            type: 'ORDER_COMPLETED',
            data: completedOrder
          });

          logger.info(`[ORDER] Order completed and updated for user ${userId}:`, completedOrder);
          return true;
        }

        attempts++;
        if (attempts < maxAttempts) {
          setTimeout(checkOrder, checkInterval);
        }
      } catch (error) {
        logger.error(`[ORDER] Error monitoring order status for user ${userId}:`, error);
        attempts++;
        if (attempts < maxAttempts) {
          setTimeout(checkOrder, checkInterval);
        }
      }
    };

    checkOrder();
  }

  async checkLastCompletedOrder(userId) {
    try {
      const token = this.getUserToken(userId);
      const response = await axios.get(`${this.TRADING_PROXY_URL}/proxy/history-bo`, {
        params: {
          status: 'completed',
          offset: 0,
          limit: 1
        },
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        }
      });

      if (response.data?.data?.length > 0) {
        const lastOrder = response.data.data[0];
        
        // Update the order in database immediately
        await axios.post(
          `${this.API_URL}/copy-ai-orders/update-completed/user/${userId}`,
          { completedOrders: [lastOrder] },
          {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          }
        );

        // Get the updated order details
        const updatedOrderResponse = await axios.get(
          `${this.API_URL}/copy-ai-orders/user/${userId}`,
          {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          }
        );

        if (updatedOrderResponse.data.error === 0) {
          const updatedOrders = updatedOrderResponse.data.data || [];
          const completedOrder = updatedOrders.find(order => order.order_code === lastOrder.order_code);
          
          if (completedOrder) {
            // Notify subscribers about the order completion
            this.notifySubscribers(userId, {
              type: 'ORDER_COMPLETED',
              data: completedOrder
            });

            logger.info(`[ORDER] Order completed and updated for user ${userId}:`, completedOrder);
          }
        }

        return lastOrder;
      }
      return null;
    } catch (error) {
      logger.error(`[ORDER] Error checking last completed order for user ${userId}:`, error);
      return null;
    }
  }

  updateCapitalIndex(state, orderStatus) {
    if (!state || !state.strategy?.parameters) {
      return;
    }
    const amounts = this.getCapitalAmounts(state);
    if (orderStatus === 'LOSS') {
        state.capitalIndex++;
        state.consecutiveLosses++;
    } else if (orderStatus === 'WIN') {
      state.capitalIndex = 0;
      state.consecutiveLosses = 0;
    }

    state.lastOrderStatus = orderStatus;
    this.saveState(state.userId);
  }

  // Connect to WebSocket for a user
  async connectWebSocket(userId) {
    logger.info(`[WS] Attempting to connect WebSocket for user ${userId}`);
    
    // Clear any existing reconnect timer
    if (this.wsReconnectTimers.has(userId)) {
      clearTimeout(this.wsReconnectTimers.get(userId));
      this.wsReconnectTimers.delete(userId);
    }

    // Close existing connection if any
    if (this.wsConnections.has(userId)) {
      const existingWs = this.wsConnections.get(userId);
      if (existingWs.readyState === WebSocket.OPEN) {
        existingWs.close();
      }
      this.wsConnections.delete(userId);
    }

    try {
      const token = this.getUserToken(userId);
      if (!token) {
        logger.error(`[WS] No token available for user ${userId}`);
        throw new Error('Authentication token required');
      }

      // Calculate reconnect delay with exponential backoff
      const attempts = this.reconnectAttempts.get(userId) || 0;
      const delay = Math.min(
        this.INITIAL_RECONNECT_DELAY * Math.pow(2, attempts),
        this.MAX_RECONNECT_DELAY
      );

      // Wait before attempting to reconnect
      if (attempts > 0) {
        logger.info(`[WS] Waiting ${delay}ms before reconnecting for user ${userId}`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }

      // Create new WebSocket connection with proper error handling
      const wsUrl = process.env.BINANCE_WSS_URL || 'wss://stream.binance.com:9443/ws/btcusdt@kline_1m';
      const ws = new WebSocket(wsUrl, {
        handshakeTimeout: 10000, // 10 seconds timeout for initial connection
        maxPayload: 1024 * 1024, // 1MB max payload
      });

      // Set a connection timeout
      const connectionTimeout = setTimeout(() => {
        if (ws.readyState !== WebSocket.OPEN) {
          logger.error(`[WS] Connection timeout for user ${userId}`);
          ws.terminate();
        }
      }, 10000);

      ws.on('open', () => {
        logger.info(`[WS] WebSocket connected for user ${userId}`);
        clearTimeout(connectionTimeout);
        this.wsConnections.set(userId, ws);
        this.reconnectAttempts.set(userId, 0); // Reset attempts on successful connection
        this.notifySubscribers(userId, { type: 'WS_CONNECTED' });

        // Send subscription message for kline data
        const subscribeMsg = {
          method: 'SUBSCRIBE',
          params: ['btcusdt@kline_1m'],
          id: 1
        };
        ws.send(JSON.stringify(subscribeMsg));
      });

      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          if (message.k) { // Kline/Candlestick data
            this.handleCandlestickData(userId, message.k);
          }
        } catch (error) {
          logger.error(`[WS] Error processing message for user ${userId}:`, error);
        }
      });

      ws.on('close', (code, reason) => {
        logger.info(`[WS] WebSocket closed for user ${userId}. Code: ${code}, Reason: ${reason}`);
        clearTimeout(connectionTimeout);
        this.wsConnections.delete(userId);
        this.notifySubscribers(userId, { type: 'WS_DISCONNECTED' });

        // Attempt to reconnect if still trading
        const state = this.getTradingState(userId);
        if (state.isTrading) {
          const attempts = (this.reconnectAttempts.get(userId) || 0) + 1;
          if (attempts <= this.MAX_RECONNECT_ATTEMPTS) {
            logger.info(`[WS] Scheduling reconnect (${attempts}/${this.MAX_RECONNECT_ATTEMPTS}) for user ${userId}`);
            this.reconnectAttempts.set(userId, attempts);
            
            // Schedule reconnection with exponential backoff
            const reconnectTimer = setTimeout(() => {
              this.connectWebSocket(userId);
            }, Math.min(1000 * Math.pow(2, attempts), this.MAX_RECONNECT_DELAY));
            
            this.wsReconnectTimers.set(userId, reconnectTimer);
          } else {
            logger.error(`[WS] Max reconnection attempts reached for user ${userId}`);
            this.stopTrading(userId);
            this.notifySubscribers(userId, { 
              type: 'ERROR', 
              error: 'Maximum reconnection attempts reached. Trading has been stopped.' 
            });
          }
        }
      });

      ws.on('error', (error) => {
        logger.error(`[WS] WebSocket error for user ${userId}:`, error);
        clearTimeout(connectionTimeout);
        this.notifySubscribers(userId, { 
          type: 'ERROR', 
          error: 'WebSocket connection error. Attempting to reconnect...' 
        });
        
        // Force close and trigger reconnect
        ws.terminate();
      });

      // Add ping/pong to keep connection alive
      const pingInterval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.ping();
        } else {
          clearInterval(pingInterval);
        }
      }, 30000);

      ws.on('pong', () => {
        // Connection is alive
        logger.debug(`[WS] Received pong from server for user ${userId}`);
      });

      // Clean up interval on close
      ws.on('close', () => {
        clearInterval(pingInterval);
      });

    } catch (error) {
      logger.error(`[WS] Error connecting WebSocket for user ${userId}:`, error);
      this.notifySubscribers(userId, { 
        type: 'ERROR', 
        error: 'Failed to establish WebSocket connection. Will retry...' 
      });
      throw error;
    }
  }

  // Handle candlestick data
  async handleCandlestickData(userId, kline) {
    const state = this.getTradingState(userId);
    if (!state.isTrading || !state.strategy) return;

    try {
      // Check if we've already processed this candle
      if (state.lastProcessedTime && state.lastProcessedTime >= kline.t) {
        return;
      }

      // Update last processed time
      state.lastProcessedTime = kline.t;
      this.saveState(userId);

      // Process candle
      await this.processCandle(userId, {
        t: kline.t,
        o: kline.o,
        h: kline.h,
        l: kline.l,
        c: kline.c,
        v: kline.v
      });

    } catch (error) {
      logger.error(`[CANDLE] Error processing candlestick for user ${userId}:`, error);
      this.notifySubscribers(userId, { type: 'ERROR', error: 'Error processing candlestick data' });
    }
  }
}

// Create singleton instance
const copyAITradingService = new CopyAITradingService();
module.exports = copyAITradingService; 