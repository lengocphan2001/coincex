const express = require('express');
const router = express.Router();
const { getAllStrategies, getStrategyById, getUserStrategies, createStrategy, updateStrategy, deleteStrategy } = require('../controllers/strategyController');
const { authenticateToken } = require('../middleware/auth');

// Get all strategies
router.get('/', authenticateToken, getAllStrategies);

// Get user strategies
router.get('/user/:userId', authenticateToken, getUserStrategies);

// Create strategy
router.post('/', authenticateToken, createStrategy);

// Get strategy by ID
router.get('/:id', authenticateToken, getStrategyById);

// Update strategy
router.put('/:id', authenticateToken, updateStrategy);

// Delete strategy
router.delete('/:id', authenticateToken, deleteStrategy);

module.exports = router; 