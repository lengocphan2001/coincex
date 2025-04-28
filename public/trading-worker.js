// Trading Service Worker
let ws = null;
let isTrading = false;
let lastProcessedCandleTime = null;
let requiredLength = 0;
let selectedStrategy = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_DELAY = 5000; // 5 seconds

// Keep the Service Worker alive
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing...');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activated and ready to handle trading');
  event.waitUntil(clients.claim());
});

// Handle messages from the main thread
self.addEventListener('message', async (event) => {
  const { type, data } = event.data;
  console.log(`[Service Worker] Received message: ${type}`);

  switch (type) {
    case 'START_TRADING':
      console.log('[Service Worker] Starting trading with strategy:', data.name);
      startTrading(data);
      break;

    case 'STOP_TRADING':
      console.log('[Service Worker] Stopping trading');
      stopTrading();
      break;

    case 'CHECK_STATUS':
      console.log('[Service Worker] Checking status');
      sendStatusUpdate();
      break;
  }
});

// Start trading process
async function startTrading(strategy) {
  if (isTrading) {
    console.log('[Service Worker] Trading already in progress');
    return;
  }
  
  try {
    console.log('[Service Worker] Initializing trading...');
    isTrading = true;
    selectedStrategy = strategy;
    requiredLength = getPatternLength(strategy.follow_candle);
    reconnectAttempts = 0;
    
    connectWebSocket();
    
  } catch (error) {
    console.error('[Service Worker] Error starting trading:', error);
    stopTrading();
  }
}

// Connect to WebSocket with retry logic
function connectWebSocket() {
  console.log('[Service Worker] Connecting to WebSocket...');
  if (ws) {
    console.log('[Service Worker] Closing existing WebSocket connection');
    ws.close();
  }

  ws = new WebSocket('wss://stream.binance.com:9443/ws/btcusdt@kline_1m');

  ws.onopen = () => {
    console.log('[Service Worker] WebSocket connected successfully');
    reconnectAttempts = 0;
    notifyClients('WS_CONNECTED', true);
  };

  ws.onmessage = handleWebSocketMessage;
  
  ws.onerror = (error) => {
    console.error('[Service Worker] WebSocket error:', error);
    handleWebSocketError();
  };

  ws.onclose = () => {
    console.log('[Service Worker] WebSocket connection closed');
    handleWebSocketError();
  };
}

// Handle WebSocket errors and attempt reconnection
function handleWebSocketError() {
  if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
    reconnectAttempts++;
    console.log(`[Service Worker] Attempting to reconnect (${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})...`);
    
    setTimeout(() => {
      if (isTrading) {
        connectWebSocket();
      }
    }, RECONNECT_DELAY);
  } else {
    console.error('[Service Worker] Max reconnection attempts reached');
    stopTrading();
  }
}

// Stop trading process
function stopTrading() {
  console.log('[Service Worker] Stopping trading process...');
  if (ws) {
    ws.close();
    ws = null;
  }
  isTrading = false;
  lastProcessedCandleTime = null;
  reconnectAttempts = 0;
  
  notifyClients('TRADING_STOPPED');
}

// Handle WebSocket messages
async function handleWebSocketMessage(event) {
  try {
    const data = JSON.parse(event.data);
    
    if (data.e === 'kline' && data.k.x) { // Only process completed candles
      const candle = data.k;
      const candleCloseTime = new Date(candle.T).getTime();

      // Prevent duplicate processing
      if (lastProcessedCandleTime && candleCloseTime <= lastProcessedCandleTime) {
        return;
      }

      lastProcessedCandleTime = candleCloseTime;
      console.log(`[Service Worker] Processing new candle at ${new Date(candleCloseTime).toLocaleTimeString()}`);

      // Get latest candles
      const response = await fetch(`https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1m&limit=${requiredLength}`);
      const klines = await response.json();

      if (klines && klines.length >= requiredLength) {
        const latestCandles = klines.map(kline => ({
          open: parseFloat(kline[1]),
          close: parseFloat(kline[4]),
          isGreen: parseFloat(kline[4]) > parseFloat(kline[1]),
          closeTime: new Date(kline[6])
        }));

        const currentPattern = latestCandles
          .map(candle => candle.isGreen ? 'x' : 'd')
          .join('-');

        console.log(`[Service Worker] Current pattern: ${currentPattern}`);
        console.log(`[Service Worker] Target pattern: ${selectedStrategy.follow_candle}`);

        if (currentPattern === selectedStrategy.follow_candle) {
          const lastCandle = latestCandles[latestCandles.length - 1];
          const tradeType = lastCandle.isGreen ? 'short' : 'long';
          
          console.log(`[Service Worker] Pattern matched! Executing ${tradeType} trade`);
          
          notifyClients('EXECUTE_TRADE', { 
            tradeType,
            amount: calculateTradeAmount(),
            strategy: selectedStrategy
          });
        }
      }
    }
  } catch (error) {
    console.error('[Service Worker] Error processing WebSocket message:', error);
  }
}

// Helper functions
function getPatternLength(pattern) {
  return pattern.split('-').length;
}

function calculateTradeAmount() {
  if (!selectedStrategy || !selectedStrategy.capital_management) return 1;
  const amounts = selectedStrategy.capital_management.split('-').map(amount => parseFloat(amount));
  return amounts[0]; // For simplicity, always use first amount
}

// Helper function to notify all clients
async function notifyClients(type, data) {
  console.log(`[Service Worker] Notifying clients: ${type}`);
  const clients = await self.clients.matchAll();
  clients.forEach(client => {
    client.postMessage({ type, data });
  });
}

// Send current status to all clients
async function sendStatusUpdate() {
  console.log('[Service Worker] Sending status update');
  const clients = await self.clients.matchAll();
  clients.forEach(client => {
    client.postMessage({
      type: 'STATUS_UPDATE',
      data: {
        isTrading,
        wsConnected: ws && ws.readyState === WebSocket.OPEN,
        selectedStrategy,
        lastProcessedCandleTime
      }
    });
  });
} 