const CopyAiOrder = require('../models/CopyAiOrder');
const logger = require('../utils/logger');

const createOrder = async (req, res) => {
  try {
    const orderData = {
      ...req.body,
      user_id: req.params.userId
    };

    const result = await CopyAiOrder.create(orderData);

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
};

const getUserOrders = async (req, res) => {
  try {
    const { status, offset = 0, limit = 10 } = req.query;
    const userId = req.params.userId;

    const orders = await CopyAiOrder.findByUserId(userId, status, offset, limit);

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
};

const updateOrderStatus = async (req, res) => {
  try {
    const { order_code } = req.params;
    const updateData = req.body;

    const order = await CopyAiOrder.findByOrderCode(order_code);
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

    const updatedOrder = await CopyAiOrder.updateStatus(order_code, updateData);

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
};

const updateCompletedOrders = async (req, res) => {
  try {
    const { completedOrders } = req.body;
    if (!completedOrders || !Array.isArray(completedOrders)) {
      return res.status(400).json({
        error: 1,
        message: "Invalid completed orders data"
      });
    }

    const updateResults = [];
    for (const order of completedOrders) {
      try {
        const existingOrder = await CopyAiOrder.findByOrderCode(order.order_code);
        
        if (existingOrder && existingOrder.user_id !== req.params.userId) {
          updateResults.push({
            order_code: order.order_code,
            status: 'failed',
            error: 'Not authorized to update this order'
          });
          continue;
        }

        const updateData = {
          status: order.status,
          received_usdt: order.received_usdt,
          open: order.open,
          close: order.close
        };

        const updatedOrder = await CopyAiOrder.updateStatus(order.order_code, updateData);
        
        updateResults.push({
          order_code: order.order_code,
          status: 'updated',
          data: updatedOrder
        });
      } catch (error) {
        logger.error(`Error updating order ${order.order_code}:`, error);
        updateResults.push({
          order_code: order.order_code,
          status: 'failed',
          error: error.message
        });
      }
    }

    return res.json({
      error: 0,
      message: `Updated ${updateResults.filter(r => r.status === 'updated').length} orders`,
      data: {
        total_updated: updateResults.filter(r => r.status === 'updated').length,
        total_failed: updateResults.filter(r => r.status === 'failed').length,
        details: updateResults
      }
    });
  } catch (error) {
    logger.error('Error in updateCompletedOrders:', error);
    return res.status(500).json({
      error: 1,
      message: "Failed to update completed orders",
      details: error.message
    });
  }
};

module.exports = {
  createOrder,
  getUserOrders,
  updateOrderStatus,
  updateCompletedOrders
}; 