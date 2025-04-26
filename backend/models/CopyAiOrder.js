const pool = require('../config/database');
const logger = require('../utils/logger');

class CopyAiOrder {
  static async create(orderData) {
    try {
      const [result] = await pool.query(
        `INSERT INTO copy_ai_orders 
        (order_code, type, amount, received_usdt, session, symbol, status, bot, user_id) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          orderData.order_code,
          orderData.type,
          orderData.amount,
          orderData.received_usdt || 0,
          orderData.session,
          orderData.symbol,
          orderData.status || 'PENDING',
          orderData.bot,
          orderData.user_id
        ]
      );
      return { success: true, id: result.insertId };
    } catch (error) {
      logger.error('Error creating copy AI order:', error);
      throw error;
    }
  }

  static async findByUserId(userId, status = null, offset = 0, limit = 10) {
    try {
      let query = 'SELECT * FROM copy_ai_orders WHERE user_id = ?';
      const values = [userId];

      if (status) {
        query += ' AND status = ?';
        values.push(status);
      }

      query += ' ORDER BY createdAt DESC LIMIT ? OFFSET ?';
      values.push(parseInt(limit,), parseInt(offset));

      const [orders] = await pool.query(query, values);
      return orders;
    } catch (error) {
      logger.error('Error finding copy AI orders by user ID:', error);
      throw error;
    }
  }

  static async findByOrderCode(orderCode) {
    try {
      const [orders] = await pool.query(
        'SELECT * FROM copy_ai_orders WHERE order_code = ? LIMIT 1',
        [orderCode]
      );
      return orders[0];
    } catch (error) {
      logger.error('Error finding copy AI order by order code:', error);
      throw error;
    }
  }

  static async updateStatus(orderCode, data) {
    try {
      const [existing] = await pool.query(
        'SELECT * FROM copy_ai_orders WHERE order_code = ?',
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
      if (data.open) {
        updates.push('open = ?');
        values.push(data.open);
      }
      if (data.close) {
        updates.push('close = ?');
        values.push(data.close);
      }

      if (updates.length === 0) {
        return existing[0];
      }

      values.push(orderCode);
      await pool.query(
        `UPDATE copy_ai_orders SET ${updates.join(', ')}, updatedAt = CURRENT_TIMESTAMP WHERE order_code = ?`,
        values
      );

      const [updated] = await pool.query(
        'SELECT * FROM copy_ai_orders WHERE order_code = ?',
        [orderCode]
      );
      return updated[0];
    } catch (error) {
      logger.error('Error updating copy AI order status:', error);
      throw error;
    }
  }
}

module.exports = CopyAiOrder; 