const pool = require('../config/database');
const logger = require('../utils/logger');

class Strategy {
  static async create(strategyData) {
    try {
      const [result] = await pool.query(
        'INSERT INTO strategies (name, user_id, capital_management, sl_tp, follow_candle) VALUES (?, ?, ?, ?, ?)',
        [
          strategyData.name,
          strategyData.user_id,
          strategyData.capital_management,
          strategyData.sl_tp,
          strategyData.follow_candle
        ]
      );
      return { success: true, id: result.insertId };
    } catch (error) {
      logger.error('Error creating strategy:', error);
      throw error;
    }
  }

  static async findAll() {
    try {
      const [strategies] = await pool.query(
        'SELECT * FROM strategies ORDER BY created_at DESC'
      );
      return strategies;
    } catch (error) {
      logger.error('Error in Strategy.findAll:', error);
      throw error;
    }
  }

  static async findByUserId(userId) {
    try {
      const [strategies] = await pool.query(
        'SELECT * FROM strategies WHERE user_id = ? ORDER BY created_at DESC',
        [userId]
      );
      return strategies;
    } catch (error) {
      logger.error('Error finding strategies by user ID:', error);
      throw error;
    }
  }

  static async findById(id) {
    try {
      const [strategies] = await pool.query(
        'SELECT * FROM strategies WHERE id = ? AND is_active = 1',
        [id]
      );
      return strategies[0];
    } catch (error) {
      logger.error('Error in Strategy.findById:', error);
      throw error;
    }
  }

  static async update(id, strategyData) {
    try {
      const [existing] = await pool.query(
        'SELECT * FROM strategies WHERE id = ?',
        [id]
      );

      if (existing.length === 0) {
        return null;
      }

      const updates = [];
      const values = [];
      
      if (strategyData.name) {
        updates.push('name = ?');
        values.push(strategyData.name);
      }
      if (strategyData.capital_management) {
        updates.push('capital_management = ?');
        values.push(strategyData.capital_management);
      }
      if (strategyData.sl_tp) {
        updates.push('sl_tp = ?');
        values.push(strategyData.sl_tp);
      }
      if (strategyData.follow_candle) {
        updates.push('follow_candle = ?');
        values.push(strategyData.follow_candle);
      }

      if (updates.length === 0) {
        return existing[0];
      }

      values.push(id);
      await pool.query(
        `UPDATE strategies SET ${updates.join(', ')} WHERE id = ?`,
        values
      );

      const [updated] = await pool.query(
        'SELECT * FROM strategies WHERE id = ?',
        [id]
      );
      return updated[0];
    } catch (error) {
      logger.error('Error in Strategy.update:', error);
      throw error;
    }
  }

  static async delete(id) {
    try {
      const [existing] = await pool.query(
        'SELECT * FROM strategies WHERE id = ?',
        [id]
      );

      if (existing.length === 0) {
        return false;
      }

      await pool.query('DELETE FROM strategies WHERE id = ?', [id]);
      return true;
    } catch (error) {
      logger.error('Error in Strategy.delete:', error);
      throw error;
    }
  }
}

module.exports = Strategy; 