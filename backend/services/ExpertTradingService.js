const WebSocket = require('ws');
const axios = require('axios');
const logger = require('../utils/logger');
const pool = require('../config/database');

class ExpertTradingService {
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
    logger.info('ExpertTradingService initialized');
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
    let state = this.tradingStates.get(userId);
    if (!state) {
      state = {
        isTrading: false,
        bot: null,
        capitalIndex: 0,
        lastProcessedTime: null,
        isExecutingTrade: false,
        lastOrderStatus: null,
        consecutiveLosses: 0,
        userId: userId
      };
      this.tradingStates.set(userId, state);
      logger.info(`[STATE] Created new state for user ${userId}`);
    }
    logger.info(`[STATE] Current state for user ${userId}:`, {
      capitalIndex: state.capitalIndex,
      lastOrderStatus: state.lastOrderStatus,
      consecutiveLosses: state.consecutiveLosses,
      capitalManagement: state.bot?.capital_management
    });
    return state;
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
  async startTrading(userId, bot, token) {
    logger.info(`[START] Attempting to start trading for user ${userId}`);

    // Validate inputs
    if (!bot || !bot.name || !bot.follow_candle || !bot.capital_management) {
      logger.error(`[START] Invalid bot configuration for user ${userId}:`, bot);
      return { error: 1, message: 'Invalid bot configuration' };
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

      // Validate bot pattern
      const requiredLength = bot.follow_candle.split('-').length;
      if (requiredLength === 0) {
        logger.error(`[START] Invalid candle pattern for user ${userId}: ${bot.follow_candle}`);
        return { error: 1, message: 'Invalid candle pattern' };
      }

      // Update trading state
      state.bot = bot;
      state.isTrading = true;
      state.lastProcessedTime = null;
      state.capitalIndex = 0;
      state.isExecutingTrade = false;
      state.lastOrderStatus = null;
      state.consecutiveLosses = 0;

      // Save state
      this.saveState(state);
      logger.info(`[START] Trading state initialized for user ${userId} with bot ${bot.name}`);

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

  saveState(state) {
    if (!state || !state.userId) {
      logger.error('[STATE] Cannot save state: invalid state object or missing userId');
      return;
    }
    
    logger.info(`[STATE] Saving state for user ${state.userId}:`, {
      isTrading: state.isTrading,
      botName: state.bot?.name,
      capitalIndex: state.capitalIndex,
      lastOrderStatus: state.lastOrderStatus,
      consecutiveLosses: state.consecutiveLosses,
      capitalManagement: state.bot?.capital_management
    });
    
    this.tradingStates.set(state.userId, state);
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
      bot: null,
      capitalIndex: 0,
      lastProcessedTime: null,
      isExecutingTrade: false,
      lastOrderStatus: null,
      consecutiveLosses: 0
    });

    return { error: 0, message: 'Trading stopped successfully' };
  }

  // Process a candle and execute trades if pattern matches
  async processCandle(userId, candle) {
    const state = this.getTradingState(userId);
    if (!state.isTrading || !state.bot) {
      logger.debug(`[CANDLE] Skipping candle processing - trading not active for user ${userId}`);
      return;
    }

    if (state.isExecutingTrade) {
      logger.debug(`[CANDLE] Skipping candle processing - trade in progress for user ${userId}`);
      return;
    }

    const candleTime = new Date(candle.t).getTime();
    if (state.lastProcessedTime && candleTime <= state.lastProcessedTime) {
      logger.debug(`[CANDLE] Skipping already processed candle for user ${userId}`);
      return;
    }

    try {
      logger.info(`[CANDLE] Processing new candle for user ${userId} at ${new Date(candleTime).toISOString()}`);
      state.lastProcessedTime = candleTime;

      const requiredLength = state.bot.follow_candle.split('-').length;
      logger.info(`[CANDLE] Fetching ${requiredLength} candles for pattern matching`);

      const response = await axios.get('https://api.binance.com/api/v3/klines', {
        params: {
          symbol: 'BTCUSDT',
          interval: '1m',
          limit: requiredLength
        }
      });

      if (!response.data || response.data.length < requiredLength) {
        logger.warn(`[CANDLE] Insufficient candle data for user ${userId}`);
        return;
      }

      const latestCandles = response.data.map(kline => ({
        open: parseFloat(kline[1]),
        close: parseFloat(kline[4]),
        isGreen: parseFloat(kline[4]) > parseFloat(kline[1])
      }));

      const currentPattern = latestCandles
        .map(candle => candle.isGreen ? 'x' : 'd')
        .join('-');

      logger.info(`[CANDLE] Current pattern: ${currentPattern}, Target pattern: ${state.bot.follow_candle}`);

      if (currentPattern === state.bot.follow_candle) {
        logger.info(`[CANDLE] Pattern matched for user ${userId}! Executing trade...`);
        // Randomly select trade type
        const tradeType = Math.random() < 0.5 ? 'short' : 'long';
        logger.info(`[TRADE] Randomly selected trade type: ${tradeType} for user ${userId}`);
        await this.executeTrade(userId, tradeType);
      } else {
        logger.debug(`[CANDLE] Pattern did not match for user ${userId}`);
      }

      this.notifySubscribers(userId, {
        type: 'CANDLE_PROCESSED',
        data: { time: candleTime, pattern: currentPattern }
      });
    } catch (error) {
      logger.error(`[CANDLE] Error processing candle for user ${userId}:`, error);
    }
  }

  async hasPendingOrders(userId) {
    try {
      logger.info(`Checking pending orders for user ${userId}`);
      const token = this.getUserToken(userId);
      const response = await axios.get(`${this.TRADING_PROXY_URL}/proxy/history-bo`, {
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

      const hasPending = response.data?.data?.length > 0;
      logger.info(`Pending orders check for user ${userId}: ${hasPending}`);
      return hasPending;
    } catch (error) {
      logger.error(`Error checking pending orders for user ${userId}:`, error);
      return true;
    }
  }

  calculateTradeAmount(state) {
    const amounts = this.getCapitalAmounts(state.bot.capital_management);
    logger.info(`[AMOUNT] Capital amounts for user ${state.userId}: ${JSON.stringify(amounts)}, current index: ${state.capitalIndex}`);
    const amount = amounts[state.capitalIndex];
    logger.info(`[AMOUNT] Selected amount for user ${state.userId}: ${amount} at index ${state.capitalIndex}`);
    return amount;
  }

  getCapitalAmounts(capitalManagement) {
    if (!capitalManagement) return [1.00];
    // Parse amounts and ensure they are valid numbers
    const amounts = capitalManagement.split('-')
      .map(amount => {
        const parsed = parseFloat(amount);
        return isNaN(parsed) ? 1.00 : parsed;
      });
    return amounts;
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
        logger.info(`[ORDER] Found last completed order for user ${userId}:`, {
          status: lastOrder.status,
          amount: lastOrder.amount,
          type: lastOrder.type
        });
        return lastOrder;
      }
      logger.info(`[ORDER] No completed orders found for user ${userId}`);
      return null;
    } catch (error) {
      logger.error(`[ORDER] Error checking last completed order for user ${userId}:`, error);
      return null;
    }
  }

  updateCapitalIndex(state, orderStatus) {
    if (!state || !state.bot?.capital_management) {
      logger.error(`[CAPITAL] Invalid state or missing capital management for user ${state?.userId}`);
      return;
    }

    const amounts = this.getCapitalAmounts(state.bot.capital_management);
    logger.info(`[CAPITAL] Updating index - Current state:`, {
      userId: state.userId,
      currentIndex: state.capitalIndex,
      newStatus: orderStatus,
      previousStatus: state.lastOrderStatus,
      amounts: amounts
    });
    logger.info(`[CAPITAL] Amount lengths:`, {
      amountsLength: amounts.length,
    });
    if (orderStatus === 'WIN') {
      state.capitalIndex = 0;
      state.consecutiveLosses = 0;
      logger.info(`[CAPITAL] WIN - Reset index to 0 for user ${state.userId}`);
    } else if (orderStatus === 'LOSS') {
      if (state.capitalIndex >= amounts.length - 1) {
        logger.info(`[CAPITAL] LOSS - At max index ${state.capitalIndex}, maintaining position for user ${state.userId}`);
      } else {
        state.capitalIndex++;
        state.consecutiveLosses++;
        logger.info(`[CAPITAL] LOSS - Increased index to ${state.capitalIndex} for user ${state.userId}`);
      }
    }
    
    state.lastOrderStatus = orderStatus;
    // Save state immediately after updating
    this.saveState(state);
    
    logger.info(`[CAPITAL] Update complete:`, {
      userId: state.userId,
      newIndex: state.capitalIndex,
      newAmount: amounts[state.capitalIndex],
      status: orderStatus,
      consecutiveLosses: state.consecutiveLosses
    });
  }

  // Execute a trade
  async executeTrade(userId, tradeType) {
    logger.info(`[TRADE] Starting trade execution for user ${userId}, type: ${tradeType}`);
    const state = this.getTradingState(userId);
    
    if (!state.isTrading) {
      logger.info(`[TRADE] Trading is not active for user ${userId}`);
      return;
    }
    
    if (state.isExecutingTrade) {
      logger.info(`[TRADE] Already executing trade for user ${userId}`);
      return;
    }

    try {
      state.isExecutingTrade = true;
      await new Promise(resolve => setTimeout(resolve, 3000));

      // First check for pending orders
      const hasPending = await this.hasPendingOrders(userId);
      if (hasPending) {
        logger.info(`[TRADE] Skipping trade - pending order exists for user ${userId}`);
        state.isExecutingTrade = false;
        return;
      }

      // Then check last completed order and update capital index
      const lastOrder = await this.checkLastCompletedOrder(userId);
      if (lastOrder) {
        logger.info(`[TRADE] Processing last order - Previous status: ${state.lastOrderStatus}, New status: ${lastOrder.status}`);
        if (lastOrder.status !== state.lastOrderStatus) {
          logger.info(`[TRADE] Status changed from ${state.lastOrderStatus || 'none'} to ${lastOrder.status} - Updating capital index`);
          this.updateCapitalIndex(state, lastOrder.status);
          // Save state immediately after updating capital index
          this.saveState(state);
        }
      }

      // Get fresh state after potential update
      const amounts = this.getCapitalAmounts(state.bot.capital_management);
      logger.info(`[TRADE] Current state before trade - Index: ${state.capitalIndex}, Amounts: ${JSON.stringify(amounts)}`);
      
      const amount = this.calculateTradeAmount(state);
      logger.info(`[TRADE] Calculated trade amount: ${amount} USDT at index ${state.capitalIndex}`);

      const token = this.getUserToken(userId);
      const tradeData = {
        symbol: 'BTCUSDT',
        type: tradeType,
        amount: amount
      };

      logger.info(`[TRADE] Executing trade:`, tradeData);
      const response = await axios.post(
        `${this.TRADING_PROXY_URL}/proxy/trading-bo`,
        tradeData,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.data.error === 0) {
        const historyResponse = await axios.get(`${this.TRADING_PROXY_URL}/proxy/history-bo`, {
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

        if (historyResponse.data.error === 0 && historyResponse.data.data?.length > 0) {
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
            bot: state.bot.name
          };

          await axios.post(
            `${this.API_URL}/copy-expert-orders/user/${userId}`,
            orderData,
            {
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
              }
            }
          );
          
          this.notifySubscribers(userId, { type: 'NEW_TRADE', data: orderData });
        }
      }
    } catch (error) {
      logger.error(`[TRADE] Error executing trade:`, error);
      this.notifySubscribers(userId, { 
        type: 'ERROR', 
        error: 'Failed to execute trade. Please check your connection and try again.' 
      });
    } finally {
      state.isExecutingTrade = false;
      // Save state at the end of trade execution
      this.saveState(state);
    }
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
    if (!state.isTrading || !state.bot) return;

    try {
      // Check if we've already processed this candle
      if (state.lastProcessedTime && state.lastProcessedTime >= kline.t) {
        return;
      }

      // Format candle data
      const candle = {
        t: kline.t,
        o: parseFloat(kline.o),
        h: parseFloat(kline.h),
        l: parseFloat(kline.l),
        c: parseFloat(kline.c),
        v: parseFloat(kline.v)
      };

      // Process the candle
      await this.processCandle(userId, candle);

    } catch (error) {
      logger.error(`[CANDLE] Error processing candlestick for user ${userId}:`, error);
      this.notifySubscribers(userId, { type: 'ERROR', error: 'Error processing candlestick data' });
    }
  }
}

// Create singleton instance
const expertTradingService = new ExpertTradingService();
module.exports = expertTradingService;
