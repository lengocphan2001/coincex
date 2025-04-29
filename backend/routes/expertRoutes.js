const express = require('express');
const router = express.Router();
const expertController = require('../controllers/expertController');
const authMiddleware = require('../middleware/authMiddleware');
const expressWs = require('express-ws');

// Add WebSocket support to router
expressWs(router);

// Protect all routes
router.use(authMiddleware);

// Trading state management
router.get('/users/:userId/state', expertController.getTradingState);
router.post('/users/:userId/start', expertController.startTrading);
router.post('/users/:userId/stop', expertController.stopTrading);

// WebSocket endpoint for real-time updates
router.ws('/users/:userId/ws', expertController.handleWebSocketConnection);

// Order management
router.get('/users/:userId/orders', expertController.getUserCopyExpertOrders);
router.post('/users/:userId/orders', expertController.createCopyExpertOrder);
router.post('/users/:userId/orders/:order_code/status', expertController.updateOrderStatus);
router.post('/users/:userId/orders/completed', expertController.updateCompletedOrders);

// Admin routes
router.get('/orders', expertController.getAllCopyExpertOrders);

module.exports = router; 