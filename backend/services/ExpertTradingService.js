const WebSocket = require('ws');
const axios = require('axios');
const logger = require('../utils/logger');

class ExpertTradingService {
  constructor() {
    this.tradingStates = new Map(); // userId -> trading state
    this.wsConnections = new Map(); // userId -> WebSocket connection
    this.subscribers = new Map(); // userId -> Set of WebSocket clients
    this.reconnectAttempts = new Map(); // userId -> number of reconnection attempts
    this.TRADING_PROXY_URL = process.env.TRADING_PROXY_URL || 'http://localhost:3001/api';
    this.API_URL = process.env.API_URL || 'http://localhost:5001/api';
    this.MAX_RECONNECT_ATTEMPTS = 5;
    this.INITIAL_RECONNECT_DELAY = 1000; // 1 second
    this.MAX_RECONNECT_DELAY = 30000; // 30 seconds
    this.userTokens = new Map(); // userId -> token
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
    if (!this.tradingStates.has(userId)) {
      this.tradingStates.set(userId, {
        isTrading: false,
        bot: null,
        capitalIndex: 0,
        lastProcessedTime: null,
        isExecutingTrade: false
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

      // Save state
      this.saveState(userId);
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

  saveState(userId) {
    const state = this.getTradingState(userId);
    logger.info(`[STATE] Saving state for user ${userId}:`, {
      isTrading: state.isTrading,
      botName: state.bot?.name,
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
      bot: null,
      capitalIndex: 0,
      lastProcessedTime: null,
      isExecutingTrade: false
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
        const lastCandle = latestCandles[latestCandles.length - 1];
        const tradeType = lastCandle.isGreen ? 'short' : 'long';
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
    return amounts[state.capitalIndex % amounts.length];
  }

  getCapitalAmounts(capitalManagement) {
    if (!capitalManagement) return [1];
    return capitalManagement.split('-').map(amount => parseFloat(amount));
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
      logger.info(`[TRADE] Checking pending orders for user ${userId}`);

      const hasPending = await this.hasPendingOrders(userId);
      if (hasPending) {
        logger.info(`[TRADE] Skipping trade - pending order exists for user ${userId}`);
        return;
      }

      const token = this.getUserToken(userId);
      const amount = this.calculateTradeAmount(state);
      logger.info(`[TRADE] Calculated trade amount for user ${userId}: ${amount}`);

      const tradeData = {
        symbol: 'BTCUSDT',
        type: tradeType,
        amount: amount
      };

      logger.info(`[TRADE] Preparing to execute trade for user ${userId}:`, tradeData);
      await new Promise(resolve => setTimeout(resolve, 4000));

      logger.info(`[TRADE] Sending trade request for user ${userId}`);
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

      logger.info(`[TRADE] Trade response for user ${userId}:`, response.data);

      if (response.data.error === 0) {
        logger.info(`[TRADE] Trade executed successfully for user ${userId}, fetching order details`);
        
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

        logger.info(`[TRADE] History response for user ${userId}:`, historyResponse.data);

        if (historyResponse.data.error === 0 && historyResponse.data.data?.length > 0) {
          const pendingOrder = historyResponse.data.data[0];
          logger.info(`[TRADE] Found pending order for user ${userId}:`, pendingOrder);
          
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

          logger.info(`[TRADE] Creating order record for user ${userId}:`, orderData);
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

          state.capitalIndex = (state.capitalIndex + 1) % this.getCapitalAmounts(state.bot.capital_management).length;
          logger.info(`[TRADE] Updated capital index for user ${userId} to ${state.capitalIndex}`);
          
          this.notifySubscribers(userId, { type: 'NEW_TRADE', data: orderData });
          logger.info(`[TRADE] Trade process completed successfully for user ${userId}`);
        } else {
          logger.warn(`[TRADE] No pending order found after trade execution for user ${userId}`);
        }
      } else {
        logger.error(`[TRADE] Trade execution failed for user ${userId}:`, response.data);
      }
    } catch (error) {
      logger.error(`[TRADE] Error executing trade for user ${userId}:`, error);
      this.notifySubscribers(userId, { 
        type: 'ERROR', 
        error: 'Failed to execute trade. Please check your connection and try again.' 
      });
    } finally {
      state.isExecutingTrade = false;
      logger.info(`[TRADE] Trade execution process ended for user ${userId}`);
    }
  }

  // Connect to WebSocket for a user
  async connectWebSocket(userId) {
    logger.info(`[WS] Attempting to connect WebSocket for user ${userId}`);
    
    // Close existing connection if any
    if (this.wsConnections.has(userId)) {
      this.wsConnections.get(userId).close();
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

      // Create new WebSocket connection
      const ws = new WebSocket(process.env.BINANCE_WSS_URL || 'wss://stream.binance.com:9443/ws/btcusdt@kline_1m');

      ws.on('open', () => {
        logger.info(`[WS] WebSocket connected for user ${userId}`);
        this.wsConnections.set(userId, ws);
        this.reconnectAttempts.set(userId, 0); // Reset attempts on successful connection
        this.notifySubscribers(userId, { type: 'WS_CONNECTED' });
      });

      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data);
          if (message.k) { // Kline/Candlestick data
            this.handleCandlestickData(userId, message.k);
          }
        } catch (error) {
          logger.error(`[WS] Error processing message for user ${userId}:`, error);
        }
      });

      ws.on('close', () => {
        logger.info(`[WS] WebSocket closed for user ${userId}`);
        this.wsConnections.delete(userId);
        this.notifySubscribers(userId, { type: 'WS_DISCONNECTED' });

        // Attempt to reconnect if still trading
        const state = this.getTradingState(userId);
        if (state.isTrading) {
          const attempts = (this.reconnectAttempts.get(userId) || 0) + 1;
          if (attempts <= this.MAX_RECONNECT_ATTEMPTS) {
            logger.info(`[WS] Attempting to reconnect (${attempts}/${this.MAX_RECONNECT_ATTEMPTS}) for user ${userId}`);
            this.reconnectAttempts.set(userId, attempts);
            this.connectWebSocket(userId);
          } else {
            logger.error(`[WS] Max reconnection attempts reached for user ${userId}`);
            this.stopTrading(userId);
          }
        }
      });

      ws.on('error', (error) => {
        logger.error(`[WS] WebSocket error for user ${userId}:`, error);
        this.notifySubscribers(userId, { type: 'ERROR', error: 'WebSocket connection error' });
      });

    } catch (error) {
      logger.error(`[WS] Error connecting WebSocket for user ${userId}:`, error);
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

      // Update last processed time
      state.lastProcessedTime = kline.t;
      this.saveState(userId);

      // Get the pattern from bot configuration
      const pattern = state.bot.follow_candle.split('-');
      const currentCandle = kline.c > kline.o ? 'u' : 'd';

      // Notify subscribers about candle processing
      this.notifySubscribers(userId, { 
        type: 'CANDLE_PROCESSED', 
        data: { 
          time: kline.t,
          pattern: currentCandle 
        } 
      });

      // Execute trade if pattern matches
      if (pattern.includes(currentCandle)) {
        const tradeType = currentCandle === 'u' ? 'long' : 'short';
        await this.executeTrade(userId, tradeType);
      }

    } catch (error) {
      logger.error(`[CANDLE] Error processing candlestick for user ${userId}:`, error);
      this.notifySubscribers(userId, { type: 'ERROR', error: 'Error processing candlestick data' });
    }
  }
}

// Create singleton instance
const expertTradingService = new ExpertTradingService();
module.exports = expertTradingService; 