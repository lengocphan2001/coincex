const express = require('express');
const router = express.Router();
const copyAIController = require('../controllers/copyAIController');

// Trading state management
router.get('/users/:userId/state', copyAIController.getTradingState);
router.post('/users/:userId/start', copyAIController.startTrading);
router.post('/users/:userId/stop', copyAIController.stopTrading);

module.exports = router; 