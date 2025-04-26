const db = require('../config/database');
const logger = require('../utils/logger');

class CopyExpertOrder {
  static async create(orderData) {
    try {
      const [result] = await db.query(
        `INSERT INTO copy_expert_orders 
        (order_code, type, amount, received_usdt, session, symbol, status, bot, user_id) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          orderData.order_code,
          orderData.type,
          orderData.amount,
          orderData.received_usdt || 0,
          orderData.session,
          orderData.symbol || 'BTCUSDT',
          orderData.status || 'PENDING',
          orderData.bot,
          orderData.user_id
        ]
      );
      return { success: true, id: result.insertId };
    } catch (error) {
      logger.error('Error creating copy expert order:', error);
      throw error;
    }
  }

  static async findByUserId(userId, status = null, offset = 0, limit = 10) {
    try {
      let query = 'SELECT * FROM copy_expert_orders WHERE user_id = ?';
      const values = [userId];

      if (status) {
        query += ' AND status = ?';
        values.push(status);
      }

      query += ' ORDER BY createdAt DESC LIMIT ? OFFSET ?';
      values.push(parseInt(limit,), parseInt(offset));

      const [orders] = await db.query(query, values);
      return orders;
    } catch (error) {
      logger.error('Error finding copy expert orders by user ID:', error);
      throw error;
    }
  }

  static async findByOrderCode(orderCode) {
    try {
      const [orders] = await db.query(
        'SELECT * FROM copy_expert_orders WHERE order_code = ? LIMIT 1',
        [orderCode]
      );
      return orders[0];
    } catch (error) {
      logger.error('Error finding copy expert order by order code:', error);
      throw error;
    }
  }

  static async updateStatus(orderCode, data) {
    try {
      const [existing] = await db.query(
        'SELECT * FROM copy_expert_orders WHERE order_code = ?',
        [orderCode]
      );

      if (existing.length === 0) {
        return null;
      }

      const updates = [];
      const values = [];
      
      if (data.status) {
        updates.push('status = ?');
        values.push(data.status);
      }
      if (data.received_usdt !== undefined) {
        updates.push('received_usdt = ?');
        values.push(data.received_usdt);
      }
      if (data.open_price) {
        updates.push('open_price = ?');
        values.push(data.open_price);
      }
      if (data.close_price) {
        updates.push('close_price = ?');
        values.push(data.close_price);
      }

      if (updates.length === 0) {
        return existing[0];
      }

      values.push(orderCode);
      await db.query(
        `UPDATE copy_expert_orders SET ${updates.join(', ')}, updatedAt = CURRENT_TIMESTAMP WHERE order_code = ?`,
        values
      );

      const [updated] = await db.query(
        'SELECT * FROM copy_expert_orders WHERE order_code = ?',
        [orderCode]
      );
      return updated[0];
    } catch (error) {
      logger.error('Error updating copy expert order status:', error);
      throw error;
    }
  }

  static async updateCompletedOrders(userId, completedOrders) {
    try {
      const updateResults = [];
      
      for (const order of completedOrders) {
        try {
          const existingOrder = await this.findByOrderCode(order.order_code);
          
          if (!existingOrder) {
            updateResults.push({
              order_code: order.order_code,
              status: 'failed',
              error: 'Order not found'
            });
            continue;
          }

          if (existingOrder.user_id !== userId) {
            updateResults.push({
              order_code: order.order_code,
              status: 'failed',
              error: 'Not authorized'
            });
            continue;
          }

          const updateData = {
            status: order.status,
            received_usdt: order.received_usdt,
            open_price: order.open,
            close_price: order.close
          };

          const updatedOrder = await this.updateStatus(order.order_code, updateData);
          
          if (updatedOrder) {
            updateResults.push({
              order_code: order.order_code,
              status: 'updated',
              data: updatedOrder
            });
          }
        } catch (error) {
          logger.error(`Error updating order ${order.order_code}:`, error);
          updateResults.push({
            order_code: order.order_code,
            status: 'failed',
            error: error.message
          });
        }
      }

      return {
        total_updated: updateResults.filter(r => r.status === 'updated').length,
        total_failed: updateResults.filter(r => r.status === 'failed').length,
        details: updateResults
      };
    } catch (error) {
      logger.error('Error updating completed orders:', error);
      throw error;
    }
  }

  // Admin: Get all orders with filters
  static async findAll({ status, search, offset = 0, limit = 20 }) {
    try {
      let query = 'SELECT SQL_CALC_FOUND_ROWS * FROM copy_expert_orders WHERE 1=1';
      const values = [];
      if (status && status !== 'ALL') {
        query += ' AND status = ?';
        values.push(status);
      }
      if (search) {
        query += ' AND (order_code LIKE ? OR user_id LIKE ?)';
        values.push(`%${search}%`, `%${search}%`);
      }
      query += ' ORDER BY createdAt DESC LIMIT ? OFFSET ?';
      values.push(parseInt(limit, 10), parseInt(offset, 10));
      const [orders] = await db.query(query, values);
      const [[{ 'FOUND_ROWS()': total }]] = await db.query('SELECT FOUND_ROWS()');
      return { orders, total };
    } catch (error) {
      logger.error('Error finding all copy expert orders:', error);
      throw error;
    }
  }
}

module.exports = CopyExpertOrder; 