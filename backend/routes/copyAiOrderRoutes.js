const express = require('express');
const router = express.Router();
const { createOrder, getUserOrders, updateOrderStatus, updateCompletedOrders } = require('../controllers/copyAiOrderController');
const { authenticateToken } = require('../middleware/auth');

// Get all orders
router.get('/', authenticateToken, getUserOrders);

// Create order
router.post('/', authenticateToken, createOrder);

// Update order status
router.patch('/:order_code', authenticateToken, updateOrderStatus);

// Update completed orders
router.post('/update-completed', authenticateToken, updateCompletedOrders);

module.exports = router; 