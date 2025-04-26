const { pool } = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

class Admin {
  static async create({ username, password, email, role = 'admin' }) {
    try {
      const hashedPassword = await bcrypt.hash(password, 10);
      const [result] = await pool.query(
        'INSERT INTO admins (username, password, email, role) VALUES (?, ?, ?, ?)',
        [username, hashedPassword, email, role]
      );
      return result.insertId;
    } catch (error) {
      console.error('Error creating admin:', error);
      throw error;
    }
  }

  static async findByUsername(username) {
    try {
      const [rows] = await pool.query(
        'SELECT * FROM admins WHERE username = ?',
        [username]
      );
      return rows[0];
    } catch (error) {
      console.error('Error finding admin by username:', error);
      throw error;
    }
  }

  static async findById(id) {
    try {
      const [rows] = await pool.query(
        'SELECT * FROM admins WHERE id = ?',
        [id]
      );
      return rows[0];
    } catch (error) {
      console.error('Error finding admin by id:', error);
      throw error;
    }
  }

  static async updateLastLogin(id) {
    try {
      await pool.query(
        'UPDATE admins SET last_login = CURRENT_TIMESTAMP WHERE id = ?',
        [id]
      );
    } catch (error) {
      console.error('Error updating last login:', error);
      throw error;
    }
  }

  static async createSession(adminId, token, expiresAt) {
    try {
      await pool.query(
        'INSERT INTO admin_sessions (admin_id, token, expires_at) VALUES (?, ?, ?)',
        [adminId, token, expiresAt]
      );
    } catch (error) {
      console.error('Error creating session:', error);
      throw error;
    }
  }

  static async findSessionByToken(token) {
    try {
      const [rows] = await pool.query(
        'SELECT * FROM admin_sessions WHERE token = ? AND expires_at > CURRENT_TIMESTAMP',
        [token]
      );
      return rows[0];
    } catch (error) {
      console.error('Error finding session by token:', error);
      throw error;
    }
  }

  static async deleteSession(token) {
    try {
      await pool.query(
        'DELETE FROM admin_sessions WHERE token = ?',
        [token]
      );
    } catch (error) {
      console.error('Error deleting session:', error);
      throw error;
    }
  }

  static async deleteExpiredSessions() {
    try {
      await pool.query(
        'DELETE FROM admin_sessions WHERE expires_at <= CURRENT_TIMESTAMP'
      );
    } catch (error) {
      console.error('Error deleting expired sessions:', error);
      throw error;
    }
  }

  static async verifyPassword(plainPassword, hashedPassword) {
    return bcrypt.compare(plainPassword, hashedPassword);
  }

  static generateToken(admin) {
    return jwt.sign(
      { id: admin.id, username: admin.username, role: admin.role },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '24h' }
    );
  }
}

module.exports = Admin; 