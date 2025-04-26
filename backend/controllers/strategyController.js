const Strategy = require('../models/Strategy');
const logger = require('../utils/logger');

// Get all strategies
const getAllStrategies = async (req, res) => {
    try {
        const strategies = await Strategy.findAll();
        res.json({
            success: true,
            data: strategies
        });
    } catch (error) {
        logger.error('Error in getAllStrategies:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch strategies'
        });
    }
};

// Get strategy by ID
const getStrategyById = async (req, res) => {
    try {
        const { id } = req.params;
        const strategy = await Strategy.findById(id);
        
        if (!strategy) {
            return res.status(404).json({
                success: false,
                message: 'Strategy not found'
            });
        }

        res.json({
            success: true,
            data: strategy
        });
    } catch (error) {
        logger.error('Error in getStrategyById:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch strategy'
        });
    }
};

// Get strategies for a specific user
const getUserStrategies = async (req, res) => {
    try {
        const { userId } = req.params;
        
        if (!userId) {
            return res.status(400).json({
                success: false,
                message: 'User ID is required'
            });
        }

        const strategies = await Strategy.findByUserId(userId);
        res.json({
            success: true,
            data: strategies || []
        });
    } catch (error) {
        logger.error('Error in getUserStrategies:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch user strategies'
        });
    }
};

// Create a new strategy
const createStrategy = async (req, res) => {
    try {
        console.log('Create Strategy Request Body:', req.body);
        const { name, user_id, capital_management, sl_tp, follow_candle } = req.body;
        
        if (!name || !user_id || !capital_management || !sl_tp || !follow_candle) {
            console.log('Missing fields:', { name, user_id, capital_management, sl_tp, follow_candle });
            return res.status(400).json({ 
                success: false, 
                message: 'Name, user_id, capital_management, sl_tp, and follow_candle are required' 
            });
        }

        const strategy = await Strategy.create({
            name,
            user_id,
            capital_management,
            sl_tp,
            follow_candle
        });

        res.status(201).json({
            success: true,
            data: strategy
        });
    } catch (error) {
        logger.error('Error in createStrategy:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create strategy'
        });
    }
};

// Update a strategy
const updateStrategy = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, capital_management, sl_tp, follow_candle } = req.body;
        
        if (!name && !capital_management && !sl_tp && !follow_candle) {
            return res.status(400).json({ 
                success: false, 
                message: 'At least one field must be provided for update' 
            });
        }

        const updatedStrategy = await Strategy.update(id, {
            name,
            capital_management,
            sl_tp,
            follow_candle
        });

        if (!updatedStrategy) {
            return res.status(404).json({ 
                success: false, 
                message: 'Strategy not found' 
            });
        }

        res.json({
            success: true,
            data: updatedStrategy
        });
    } catch (error) {
        logger.error('Error in updateStrategy:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update strategy'
        });
    }
};

// Delete a strategy
const deleteStrategy = async (req, res) => {
    try {
        const { id } = req.params;
        const deleted = await Strategy.delete(id);

        if (!deleted) {
            return res.status(404).json({ 
                success: false, 
                message: 'Strategy not found' 
            });
        }

        res.json({
            success: true,
            message: 'Strategy deleted successfully'
        });
    } catch (error) {
        logger.error('Error in deleteStrategy:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete strategy'
        });
    }
};

module.exports = {
    getAllStrategies,
    getStrategyById,
    getUserStrategies,
    createStrategy,
    updateStrategy,
    deleteStrategy
}; 