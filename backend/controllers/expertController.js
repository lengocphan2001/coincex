const CopyExpertOrder = require('../models/CopyExpertOrder');
const logger = require('../utils/logger');

class ExpertController {
  // Create new copy expert order
  static async createCopyExpertOrder(req, res) {
    try {
      const orderData = {
        ...req.body,
        user_id: req.params.userId
      };

      const result = await CopyExpertOrder.create(orderData);

      res.json({
        error: 0,
        message: 'Order created successfully',
        data: result
      });
    } catch (error) {
      logger.error('Error creating order:', error);
      res.status(500).json({
        error: 1,
        message: 'Failed to create order'
      });
    }
  }

  // Get user's copy expert orders
  static async getUserCopyExpertOrders(req, res) {
    try {
      const { status, offset = 0, limit = 10 } = req.query;
      const userId = req.params.userId;

      const orders = await CopyExpertOrder.findByUserId(userId, status, offset, limit);

      res.json({
        error: 0,
        data: orders
      });
    } catch (error) {
      logger.error('Error fetching orders:', error);
      res.status(500).json({
        error: 1,
        message: 'Failed to fetch orders'
      });
    }
  }

  // Update order status
  static async updateOrderStatus(req, res) {
    try {
      const { order_code } = req.params;
      const updateData = req.body;

      const order = await CopyExpertOrder.findByOrderCode(order_code);
      if (!order) {
        return res.status(404).json({
          error: 1,
          message: 'Order not found'
        });
      }

      if (order.user_id !== req.params.userId) {
        return res.status(403).json({
          error: 1,
          message: 'Not authorized to update this order'
        });
      }

      const updatedOrder = await CopyExpertOrder.updateStatus(order_code, updateData);

      res.json({
        error: 0,
        message: 'Order updated successfully',
        data: updatedOrder
      });
    } catch (error) {
      logger.error('Error updating order:', error);
      res.status(500).json({
        error: 1,
        message: 'Failed to update order'
      });
    }
  }

  // Update completed orders
  static async updateCompletedOrders(req, res) {
    try {
      const { completedOrders } = req.body;
      if (!completedOrders || !Array.isArray(completedOrders)) {
        return res.status(400).json({
          error: 1,
          message: "Invalid completed orders data"
        });
      }

      const result = await CopyExpertOrder.updateCompletedOrders(req.params.userId, completedOrders);

      return res.json({
        error: 0,
        message: `Updated ${result.total_updated} orders`,
        data: result
      });
    } catch (error) {
      logger.error('Error in updateCompletedOrders:', error);
      return res.status(500).json({
        error: 1,
        message: "Failed to update completed orders",
        details: error.message
      });
    }
  }

  // Admin: Get all copy expert orders
  static async getAllCopyExpertOrders(req, res) {
    try {
      const { status, search, offset = 0, limit = 20 } = req.query;
      const result = await CopyExpertOrder.findAll({ status, search, offset, limit });
      res.json({ error: 0, data: result });
    } catch (error) {
      logger.error('Error fetching all copy expert orders:', error);
      res.status(500).json({ error: 1, message: 'Failed to fetch orders' });
    }
  }
}

module.exports = ExpertController; 