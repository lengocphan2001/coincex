import axios from 'axios';
import { BINANCE_WSS_URL } from '../config/constants';

const API_URL = process.env.REACT_APP_API_URL;
const API_URL2 = process.env.REACT_APP_API_URL2;

class ExpertTradingService {
  constructor() {
    this.isTrading = false;
    this.wsConnection = null;
    this.bot = null;
    this.lastProcessedTime = null;
    this.isExecutingTrade = false;
    this.capitalIndex = 0;
    this.subscribers = new Set();
    
    // Restore trading state on service initialization
    this.restoreState();
  }

  subscribe(callback) {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  notifySubscribers(data) {
    this.subscribers.forEach(callback => callback(data));
  }

  getCapitalAmounts(capitalManagement) {
    if (!capitalManagement) return [1];
    return capitalManagement.split('-').map(amount => parseFloat(amount));
  }

  calculateTradeAmount() {
    const amounts = this.getCapitalAmounts(this.bot.capital_management);
    return amounts[this.capitalIndex % amounts.length];
  }

  async hasPendingOrders() {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL2}/proxy/history-bo`, {
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

      return response.data?.data?.length > 0;
    } catch (error) {
      console.error('Error checking pending orders:', error);
      return true;
    }
  }

  async executeTrade(tradeType) {
    if (this.isExecutingTrade) return;

    try {
      this.isExecutingTrade = true;

      const hasPending = await this.hasPendingOrders();
      if (hasPending) {
        console.log('Skipping trade - pending order exists');
        return;
      }

      const token = localStorage.getItem('token');
      const userId = localStorage.getItem('userId');
      const amount = this.calculateTradeAmount();

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
        const amounts = this.getCapitalAmounts(this.bot.capital_management);
        this.capitalIndex = (this.capitalIndex + 1) % amounts.length;

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
            bot: this.bot.name,
          };

          await axios.post(
            `${API_URL}/copy-expert-orders/user/${userId}`,
            orderData,
            {
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
              }
            }
          );

          this.notifySubscribers({ type: 'NEW_TRADE', data: orderData });
        }
      }
    } catch (error) {
      console.error('Trade execution error:', error);
    } finally {
      this.isExecutingTrade = false;
    }
  }

  saveState() {
    const state = {
      isTrading: this.isTrading,
      bot: this.bot,
      lastProcessedTime: this.lastProcessedTime,
      capitalIndex: this.capitalIndex
    };
    localStorage.setItem('expertTradingServiceState', JSON.stringify(state));
  }

  restoreState() {
    try {
      const savedState = localStorage.getItem('expertTradingServiceState');
      if (savedState) {
        const state = JSON.parse(savedState);
        this.isTrading = state.isTrading;
        this.bot = state.bot;
        this.lastProcessedTime = state.lastProcessedTime;
        this.capitalIndex = state.capitalIndex || 0;

        if (this.isTrading && this.bot) {
          console.log('Restoring trading with bot:', this.bot.name);
          this.startTrading(this.bot);
        }
      }
    } catch (error) {
      console.error('Error restoring trading state:', error);
    }
  }

  async startTrading(bot) {
    if (!bot) return;
    
    this.bot = bot;
    this.isTrading = true;
    this.saveState();

    try {
      const requiredLength = this.bot.follow_candle.split('-').length;
      if (requiredLength === 0) return;

      // Close existing connection if any
      if (this.wsConnection) {
        this.wsConnection.close();
        this.wsConnection = null;
        // Add delay before creating new connection
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // Add connection timeout and retry mechanism
      let connectionAttempts = 0;
      const maxAttempts = 5;
      const connectWebSocket = () => {
        if (!this.isTrading) return;
        
        if (connectionAttempts >= maxAttempts) {
          console.error('Max reconnection attempts reached');
          this.stopTrading();
          return;
        }

        this.wsConnection = new WebSocket(`${BINANCE_WSS_URL}/ws/btcusdt@kline_1m`);
        
        this.wsConnection.onopen = () => {
          console.log('WebSocket connected at:', new Date().toLocaleTimeString());
          connectionAttempts = 0; // Reset attempts on successful connection
          this.notifySubscribers({ type: 'WS_CONNECTED' });
        };

        this.wsConnection.onmessage = async (event) => {
          if (!this.isTrading) return;

          try {
            const data = JSON.parse(event.data);
            
            if (data.e === 'kline' && data.k.x) {
              const candle = data.k;
              const candleTime = new Date(candle.t).getTime();

              if (this.lastProcessedTime && candleTime <= this.lastProcessedTime) {
                return;
              }

              console.log('Processing candle at:', new Date(candleTime).toLocaleTimeString());
              this.lastProcessedTime = candleTime;

              const response = await axios.get(`https://api.binance.com/api/v3/klines`, {
                params: {
                  symbol: 'BTCUSDT',
                  interval: '1m',
                  limit: requiredLength
                }
              });

              if (!response.data || response.data.length < requiredLength) return;

              const latestCandles = response.data.map(kline => ({
                open: parseFloat(kline[1]),
                close: parseFloat(kline[4]),
                isGreen: parseFloat(kline[4]) > parseFloat(kline[1]),
                closeTime: new Date(kline[6])
              }));

              const currentPattern = latestCandles
                .map(candle => candle.isGreen ? 'x' : 'd')
                .join('-');

              console.log('Current pattern:', currentPattern, 'Target pattern:', this.bot.follow_candle);

              if (currentPattern === this.bot.follow_candle) {
                const lastCandle = latestCandles[latestCandles.length - 1];
                const tradeType = lastCandle.isGreen ? 'short' : 'long';
                await this.executeTrade(tradeType);
              }

              this.notifySubscribers({ type: 'CANDLE_PROCESSED', data: { time: candleTime, pattern: currentPattern } });
            }
          } catch (error) {
            console.error('Error processing WebSocket message:', error);
          }
        };

        this.wsConnection.onclose = (event) => {
          console.log('WebSocket disconnected at:', new Date().toLocaleTimeString());
          this.notifySubscribers({ type: 'WS_DISCONNECTED' });
          
          if (this.isTrading && !event.wasClean) {
            connectionAttempts++;
            console.log(`Attempting to reconnect... (Attempt ${connectionAttempts}/${maxAttempts})`);
            // Exponential backoff for reconnection
            setTimeout(() => {
              if (this.isTrading) {
                connectWebSocket();
              }
            }, Math.min(1000 * Math.pow(2, connectionAttempts), 30000));
          }
        };

        this.wsConnection.onerror = (error) => {
          console.error('WebSocket error:', error);
        };
      };

      connectWebSocket();

    } catch (error) {
      console.error('Error starting trading:', error);
      this.notifySubscribers({ type: 'ERROR', error: 'Failed to start trading' });
    }
  }

  stopTrading() {
    console.log('Stopping expert trading service...');
    this.isTrading = false;
    
    if (this.wsConnection) {
      this.wsConnection.close();
      this.wsConnection = null;
    }

    this.lastProcessedTime = null;
    this.bot = null;
    this.capitalIndex = 0;
    this.saveState();
    this.notifySubscribers({ type: 'TRADING_STOPPED' });
  }

  getStatus() {
    return {
      isTrading: this.isTrading,
      bot: this.bot,
      wsConnected: this.wsConnection !== null
    };
  }
}

// Create a singleton instance
const expertTradingService = new ExpertTradingService();
export default expertTradingService; 