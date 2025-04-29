require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { pool } = require('./config/db');
const userController = require('./controllers/userController');
const adminController = require('./controllers/adminController');
const copyAiOrderController = require('./controllers/copyAiOrderController');
const strategyController = require('./controllers/strategyController');
const expertController = require('./controllers/expertController');
const { authenticateToken, isSuperAdmin } = require('./middleware/auth');
const bcrypt = require('bcryptjs');
const axios = require('axios');
const WebSocket = require('ws');
const CopyExpertOrder = require('./models/CopyExpertOrder');
const expressWs = require('express-ws');
const copyAIRoutes = require('./routes/copyAIRoutes');
const copyAIController = require('./controllers/copyAIController');

const app = express();
const PORT = process.env.PORT || 5001;

// Add WebSocket support to app
expressWs(app);

// Store last candles in memory
let lastCandles = {};
let wsConnections = {};

// Function to initialize WebSocket connection for a symbol
function initializeWebSocket(symbol, interval) {
  const streamName = `${symbol.toLowerCase()}@kline_${interval}`;
  const ws = new WebSocket(`wss://stream.binance.com:9443/ws/${streamName}`);

  ws.on('message', (data) => {
    const kline = JSON.parse(data);
    if (kline.e === 'kline') {
      const candle = {
        open: parseFloat(kline.k.o),
        high: parseFloat(kline.k.h),
        low: parseFloat(kline.k.l),
        close: parseFloat(kline.k.c),
        volume: parseFloat(kline.k.v),
        timestamp: kline.k.t,
        symbol: kline.s,
        interval: kline.k.i,
        isClosed: kline.k.x
      };

      const key = `${symbol}_${interval}`;
      if (!lastCandles[key]) {
        lastCandles[key] = [];
      }

      // Update or add the candle
      if (candle.isClosed) {
        lastCandles[key].push(candle);
        // Keep only last 10 candles
        if (lastCandles[key].length > 10) {
          lastCandles[key].shift();
        }
      } else {
        // Update current candle
        const currentIndex = lastCandles[key].length - 1;
        if (currentIndex >= 0) {
          lastCandles[key][currentIndex] = candle;
        } else {
          lastCandles[key].push(candle);
        }
      }
    }
  });

  ws.on('error', (error) => {
    console.error(`WebSocket error for ${symbol}:`, error);
    // Attempt to reconnect after 5 seconds
    setTimeout(() => {
      initializeWebSocket(symbol, interval);
    }, 5000);
  });

  ws.on('close', () => {
    console.log(`WebSocket closed for ${symbol}`);
    // Attempt to reconnect after 5 seconds
    setTimeout(() => {
      initializeWebSocket(symbol, interval);
    }, 5000);
  });

  return ws;
}

// Initialize WebSocket connections for default symbols
const defaultSymbols = ['BTCUSDT'];
const defaultInterval = '1m';

defaultSymbols.forEach(symbol => {
  const key = `${symbol}_${defaultInterval}`;
  wsConnections[key] = initializeWebSocket(symbol, defaultInterval);
});

// Basic request logging - add this BEFORE other middleware
app.use((req, res, next) => {
  console.log('\n=== Incoming Request ===');
  console.log(`Time: ${new Date().toISOString()}`);
  console.log(`Method: ${req.method}`);
  console.log(`URL: ${req.url}`);
  console.log('Headers:', req.headers);
  next();
});

// Add CORS middleware
const allowedOrigins = [
  'http://localhost:3000',
  'https://mon88.click',
  'https://www.mon88.click'
];

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
  }
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  next();
});

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Initialize database
async function initializeDatabase() {
  let connection;
  try {
    connection = await pool.getConnection();
    
    const schemaPath = path.join(__dirname, 'config', 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    
    // Split the schema into individual statements
    const statements = schema.split(';').filter(statement => statement.trim());
    
    // Execute each statement
    for (const statement of statements) {
      if (statement.trim()) {
        await connection.query(statement);
      }
    }
    
    // Check if default admin exists
    const [admins] = await connection.query('SELECT * FROM admins WHERE username = ?', ['admin']);
    
    if (admins.length === 0) {
      // Create default admin
      const hashedPassword = await bcrypt.hash('admin123', 10);
      await connection.query(
        'INSERT INTO admins (username, password, email, role) VALUES (?, ?, ?, ?)',
        ['admin', hashedPassword, 'admin@coincex.com', 'super_admin']
      );
      console.log('Default admin account created');
    }

    // Check if default strategies exist
    const [strategies] = await connection.query('SELECT * FROM strategies WHERE name LIKE ?', ['Fibo mặc định%']);
    
    if (strategies.length === 0) {
      // Create default strategies
      const defaultStrategies = [
        {
          name: 'Fibo mặc định 1.0',
          user_id: 'admin',
          follow_candle: 'd-d-x',
          capital_management: '0.1-0.2-0.4-0.8-1.6',
          sl_tp: '10/10'
        },
        {
          name: 'Fibo mặc định 1.1',
          user_id: 'admin',
          follow_candle: 'x-d-d-x',
          capital_management: '0.2-0.4-0.8-1.6-3.2',
          sl_tp: '20/20'
        },
        {
          name: 'Fibo mặc định 1.2',
          user_id: 'admin',
          follow_candle: 'd-x-d-x',
          capital_management: '0.3-0.6-1.2-2.4-4.8',
          sl_tp: '30/30'
        }
      ];

      for (const strategy of defaultStrategies) {
        await connection.query(
          'INSERT INTO strategies (name, user_id, follow_candle, capital_management, sl_tp) VALUES (?, ?, ?, ?, ?)',
          [strategy.name, strategy.user_id, strategy.follow_candle, strategy.capital_management, strategy.sl_tp]
        );
      }
      console.log('Default strategies created');
    }
    
    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Error initializing database:', error);
    process.exit(1);
  } finally {
    if (connection) {
      connection.release();
    }
  }
}

// User routes
app.post('/api/save-user', userController.saveUser);
app.get('/api/users/:userId', userController.getUser);
app.get('/api/users/:userId/access', userController.checkUserAccess);
app.get('/api/users', userController.getAllUsers);
app.get('/api/user-info', userController.getUserInfo);
app.get('/api/users/:userId/status', userController.getUserStatus);
app.put('/api/users/:userId/status', authenticateToken, isSuperAdmin, userController.updateUserStatus);
app.put('/api/users/:userId/unlimited-status', authenticateToken, isSuperAdmin, userController.updateUnlimitedStatus);

// Admin routes
app.post('/api/admin/login', adminController.login);
app.post('/api/admin/logout', authenticateToken, adminController.logout);
app.post('/api/admin', authenticateToken, isSuperAdmin, adminController.createAdmin);
app.get('/api/admin', authenticateToken, isSuperAdmin, adminController.getAdmins);
app.put('/api/admin/:adminId/status', authenticateToken, isSuperAdmin, adminController.updateAdminStatus);

// Strategy routes
app.get('/api/strategies', strategyController.getAllStrategies);
app.get('/api/strategies/user/:userId', strategyController.getUserStrategies);
app.post('/api/strategies', strategyController.createStrategy);
app.put('/api/strategies/:id', strategyController.updateStrategy);
app.delete('/api/strategies/:id', strategyController.deleteStrategy);

// Expert routes
app.post('/api/copy-expert-orders/user/:userId', expertController.createCopyExpertOrder);
app.get('/api/copy-expert-orders/user/:userId', expertController.getUserCopyExpertOrders);
app.patch('/api/copy-expert-orders/:order_code/user/:userId', expertController.updateOrderStatus);
app.post('/api/copy-expert-orders/update-completed/user/:userId', expertController.updateCompletedOrders);
app.get('/api/copy-expert-orders', authenticateToken, isSuperAdmin, expertController.getAllCopyExpertOrders);

// New Expert Trading WebSocket routes
app.get('/api/expert/users/:userId/state', expertController.getTradingState);
app.post('/api/expert/users/:userId/start', expertController.startTrading);
app.post('/api/expert/users/:userId/stop', expertController.stopTrading);
app.ws('/api/expert/users/:userId/ws', expertController.handleWebSocketConnection);

// Copy AI Order routes
app.get('/api/copy-ai-orders/user/:userId', copyAiOrderController.getUserOrders);
app.post('/api/copy-ai-orders/user/:userId', copyAiOrderController.createOrder);
app.patch('/api/copy-ai-orders/:order_code/user/:userId', copyAiOrderController.updateOrderStatus);
app.post('/api/copy-ai-orders/update-completed/user/:userId', copyAiOrderController.updateCompletedOrders);

// Proxy routes for Binance API
app.get('/api/proxy/candles', async (req, res) => {
  try {
    const { symbol, interval, limit } = req.query;
    
    // Validate required parameters
    if (!symbol || !interval) {
      return res.status(400).json({
        success: false,
        message: 'Symbol and interval are required'
      });
    }

    // Get candles from Binance
    const response = await axios.get('https://api.binance.com/api/v3/klines', {
      params: {
        symbol: symbol.toUpperCase(),
        interval,
        limit: limit || 100
      }
    });

    // Transform Binance response to match our format
    const candles = response.data.map(candle => ({
      timestamp: candle[0],
      open: candle[1],
      high: candle[2],
      low: candle[3],
      close: candle[4],
      volume: candle[5],
      closeTime: candle[6]
    }));

    res.json({
      success: true,
      data: candles
    });
  } catch (error) {
    console.error('Error fetching candles:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch candle data',
      error: error.message
    });
  }
});

// Start server
initializeDatabase().then(() => {
  app.listen(PORT, () => {
    console.log('\n=== Server Started ===');
    console.log(`Time: ${new Date().toISOString()}`);
    console.log(`Server running on port ${PORT}`);
    console.log(`API URL: http://localhost:${PORT}`);
    console.log('===================\n');
  });
}).catch(error => {
  console.error('Failed to start server:', error);
  process.exit(1);
}); 