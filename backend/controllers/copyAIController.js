const logger = require('../utils/logger');
const copyAITradingService = require('../services/CopyAITradingService');

// Map to store trading states for users
const tradingStates = new Map();

// Map to store WebSocket connections
const wsConnections = new Map();

// Function to update trading state and notify WebSocket clients
const updateTradingState = (userId, newState) => {
  tradingStates.set(userId, newState);
  const ws = wsConnections.get(userId);
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({
      type: 'STATE_UPDATE',
      data: newState
    }));
  }
};

// Get current trading state
const getTradingState = async (req, res) => {
  try {
    const { userId } = req.params;
    const state = copyAITradingService.getTradingState(userId);
    res.json({ error: 0, data: state });
  } catch (error) {
    logger.error('Error getting trading state:', error);
    res.status(500).json({ error: 1, message: 'Internal server error' });
  }
};

// Start trading
const startTrading = async (req, res) => {
  try {
    const { userId } = req.params;
    const { strategy } = req.body;
    const token = req.headers.authorization?.split(' ')[1];

    const result = await copyAITradingService.startTrading(userId, strategy, token);
    res.json(result);
  } catch (error) {
    logger.error('Error starting trading:', error);
    res.status(500).json({ error: 1, message: 'Internal server error' });
  }
};

// Stop trading
const stopTrading = async (req, res) => {
  try {
    const { userId } = req.params;
    const result = copyAITradingService.stopTrading(userId);
    res.json(result);
  } catch (error) {
    logger.error('Error stopping trading:', error);
    res.status(500).json({ error: 1, message: 'Internal server error' });
  }
};

// Handle WebSocket connection
const handleWebSocketConnection = (ws, req) => {
  const { userId } = req.params;
  copyAITradingService.subscribe(userId, ws);
};

// Background trading process
const startBackgroundTrading = async (userId, strategy) => {
  const state = tradingStates.get(userId);
  if (!state || !state.isTrading) return;

  try {
    // Get AI prediction
    const prediction = await getAIPrediction(strategy);
    
    if (prediction) {
      // Execute trade based on prediction
      await executeTrade(userId, prediction, strategy);
      
      // Notify client
      const ws = wsConnections.get(userId);
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'NEW_TRADE',
          data: prediction
        }));
      }
    }

    // Schedule next prediction
    setTimeout(() => startBackgroundTrading(userId, strategy), 60000); // Check every minute
  } catch (error) {
    logger.error('Error in background trading:', error);
    const ws = wsConnections.get(userId);
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'ERROR',
        error: 'Error executing trade'
      }));
    }
  }
};

// Get AI prediction
const getAIPrediction = async (strategy) => {
  try {
    // Implement AI prediction logic here
    // This should analyze market data and return trade signals
    // For now, returning a mock prediction
    return {
      symbol: 'BTCUSDT',
      type: Math.random() > 0.5 ? 'long' : 'short',
      amount: 10,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    logger.error('Error getting AI prediction:', error);
    return null;
  }
};

// Execute trade
const executeTrade = async (userId, prediction, strategy) => {
  try {
    const { symbol, type, amount } = prediction;
    
    // Insert trade record
    await pool.query(
      'INSERT INTO trades (user_id, symbol, type, amount, status, strategy) VALUES (?, ?, ?, ?, ?, ?)',
      [userId, symbol, type, amount, 'PENDING', JSON.stringify(strategy)]
    );

    // Implement actual trading logic here
    // This should connect to your trading platform API
    
    logger.info(`Trade executed for user ${userId}: ${type} ${amount} ${symbol}`);
  } catch (error) {
    logger.error('Error executing trade:', error);
    throw error;
  }
};

module.exports = {
  getTradingState,
  startTrading,
  stopTrading,
  handleWebSocketConnection
}; 