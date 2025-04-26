const { pool } = require('../config/db');

class User {
  static async createOrUpdate(userData) {
    try {
      const [result] = await pool.query(`
        INSERT INTO users (
          user_id, phone_number, nik_name, usdt, vndc, invite, 
          ref_code, wallet_crypto, address_usdt, vip, level, access_token, is_active
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          phone_number = VALUES(phone_number),
          nik_name = VALUES(nik_name),
          usdt = VALUES(usdt),
          vndc = VALUES(vndc),
          invite = VALUES(invite),
          ref_code = VALUES(ref_code),
          wallet_crypto = VALUES(wallet_crypto),
          address_usdt = VALUES(address_usdt),
          vip = VALUES(vip),
          level = VALUES(level),
          access_token = VALUES(access_token),
          updated_at = CURRENT_TIMESTAMP
      `, [
        userData.user_id,
        userData.phone_number,
        userData.nik_name,
        userData.usdt,
        userData.vndc,
        userData.invite,
        userData.ref_code,
        userData.wallet_crypto,
        userData.address_usdt,
        userData.vip,
        userData.level,
        userData.access_token,
        false // Set is_active to false by default
      ]);

      return result;
    } catch (error) {
      console.error('Error creating/updating user:', error);
      throw error;
    }
  }

  static async updateStatus(userId, isActive) {
    try {
      const [result] = await pool.query(
        'UPDATE users SET is_active = ? WHERE user_id = ?',
        [isActive, userId]
      );
      return result;
    } catch (error) {
      console.error('Error updating user status:', error);
      throw error;
    }
  }

  static async findByUserId(userId) {
    try {
      const [rows] = await pool.query(
        'SELECT * FROM users WHERE user_id = ?',
        [userId]
      );
      if (rows[0]) {
        // Convert is_active to boolean
        rows[0].is_active = Boolean(rows[0].is_active);
      }
      return rows[0];
    } catch (error) {
      console.error('Error finding user by ID:', error);
      throw error;
    }
  }

  static async findAll() {
    try {
      const [rows] = await pool.query('SELECT * FROM users');
      // Convert is_active to boolean for all users
      return rows.map(user => ({
        ...user,
        is_active: Boolean(user.is_active)
      }));
    } catch (error) {
      console.error('Error finding all users:', error);
      throw error;
    }
  }
}

module.exports = User; 