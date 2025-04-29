import axios from 'axios';
import { BINANCE_WSS_URL } from '../config/constants';

const API_URL = process.env.REACT_APP_API_URL;
const API_URL2 = process.env.REACT_APP_API_URL2;

class TradingService {
  constructor() {
    this.isTrading = false;
    this.wsConnection = null;
    this.strategy = null;
    this.capitalIndex = 0;
    this.lastProcessedTime = null;
    this.isExecutingTrade = false;
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

  getPatternLength(pattern) {
    if (!pattern) return 0;
    return pattern.split('-').length;
  }

  getCapitalAmounts(capitalManagement) {
    if (!capitalManagement) return [1];
    return capitalManagement.split('-').map(amount => parseFloat(amount));
  }

  calculateTradeAmount() {
    const amounts = this.getCapitalAmounts(this.strategy.capital_management);
    return amounts[this.capitalIndex % amounts.length];
  }

  async checkLastCompletedOrder() {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL2}/proxy/history-bo`, {
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
        
        if (lastOrder.status === 'LOSS') {
          console.log('Last order was a loss, resetting capital index to 0');
          this.capitalIndex = 0;
        } else if (lastOrder.status === 'WIN') {
          const amounts = this.getCapitalAmounts(this.strategy.capital_management);
          this.capitalIndex = (this.capitalIndex + 1) % amounts.length;
        }
      }
    } catch (error) {
      console.error('Error checking last completed order:', error);
    }
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

      await this.checkLastCompletedOrder();

      const token = localStorage.getItem('token');
      const userId = localStorage.getItem('userId');
      const amount = this.calculateTradeAmount();

      const tradeData = {
        symbol: 'BTCUSDT',
        type: tradeType,
        amount: amount,
      };

      await new Promise(resolve => setTimeout(resolve, 2000));

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
            bot: this.strategy.name,
          };

          await axios.post(
            `${API_URL}/copy-ai-orders/user/${userId}`,
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
      strategy: this.strategy,
      capitalIndex: this.capitalIndex,
      lastProcessedTime: this.lastProcessedTime
    };
    localStorage.setItem('tradingServiceState', JSON.stringify(state));
  }

  restoreState() {
    try {
      const savedState = localStorage.getItem('tradingServiceState');
      if (savedState) {
        const state = JSON.parse(savedState);
        this.isTrading = state.isTrading;
        this.strategy = state.strategy;
        this.capitalIndex = state.capitalIndex;
        this.lastProcessedTime = state.lastProcessedTime;

        if (this.isTrading && this.strategy) {
          console.log('Restoring trading with strategy:', this.strategy.name);
          this.startTrading(this.strategy);
        }
      }
    } catch (error) {
      console.error('Error restoring trading state:', error);
    }
  }

  async startTrading(strategy) {
    if (!strategy) return;
    
    this.strategy = strategy;
    this.isTrading = true;
    this.saveState();

    try {
      const requiredLength = this.getPatternLength(strategy.follow_candle);
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

              console.log('Current pattern:', currentPattern, 'Target pattern:', strategy.follow_candle);

              if (currentPattern === strategy.follow_candle) {
                const tradeType = Math.random() < 0.5 ? 'short' : 'long';
                console.log('Pattern matched! Executing trade:', tradeType);
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
    console.log('Stopping trading service...');
    this.isTrading = false;
    
    if (this.wsConnection) {
      this.wsConnection.close();
      this.wsConnection = null;
    }

    this.capitalIndex = 0;
    this.lastProcessedTime = null;
    this.strategy = null;
    this.saveState();
    this.notifySubscribers({ type: 'TRADING_STOPPED' });
  }

  getStatus() {
    return {
      isTrading: this.isTrading,
      strategy: this.strategy,
      wsConnected: this.wsConnection !== null
    };
  }
}

// Create a singleton instance
const tradingService = new TradingService();
export default tradingService; 