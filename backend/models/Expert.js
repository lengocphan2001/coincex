const db = require('../config/database');

class Expert {
  static async findAll() {
    try {
      const [experts] = await db.execute(
        'SELECT * FROM experts ORDER BY createdAt DESC'
      );
      return experts;
    } catch (error) {
      throw new Error(`Error fetching experts: ${error.message}`);
    }
  }

  static async getLastTrade(expertId) {
    try {
      const [trades] = await db.execute(
        'SELECT * FROM expert_trades WHERE expert_id = ? ORDER BY createdAt DESC LIMIT 1',
        [expertId]
      );
      return trades[0] || null;
    } catch (error) {
      throw new Error(`Error fetching last trade: ${error.message}`);
    }
  }

  static async findById(expertId) {
    try {
      const [experts] = await db.execute(
        'SELECT * FROM experts WHERE id = ?',
        [expertId]
      );
      return experts[0] || null;
    } catch (error) {
      throw new Error(`Error fetching expert: ${error.message}`);
    }
  }

  static async updateLastTrade(id, tradeType) {
    try {
      await db.execute(
        'UPDATE experts SET last_trade_type = ?, last_trade_time = CURRENT_TIMESTAMP WHERE id = ?',
        [tradeType, id]
      );
      return true;
    } catch (error) {
      throw error;
    }
  }

  static async updateWinRate(id, isWin) {
    try {
      // Get current win count and total trades
      const [stats] = await db.execute(
        'SELECT win_rate FROM experts WHERE id = ?',
        [id]
      );
      
      if (stats.length === 0) return false;

      // Update win rate
      const currentWinRate = parseFloat(stats[0].win_rate) || 0;
      const newWinRate = isWin ? currentWinRate + 0.1 : Math.max(0, currentWinRate - 0.1);

      await db.execute(
        'UPDATE experts SET win_rate = ? WHERE id = ?',
        [newWinRate.toFixed(2), id]
      );

      return true;
    } catch (error) {
      throw error;
    }
  }
}

module.exports = Expert; 