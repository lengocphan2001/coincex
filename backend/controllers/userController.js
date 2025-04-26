const { pool } = require('../config/db');
const logger = require('../utils/logger');

// Save a new user
const saveUser = async (req, res) => {
    try {
        console.log('=== Save User Request ===');
        console.log('Headers:', req.headers);
        console.log('Raw Body:', req.body);
        
        // If the data is nested in a user object, extract it
        const userData = req.body.user || req.body;
        console.log('Processed userData:', userData);
        
        const { user_id, phone_number, nik_name, usdt, vndc, invite, ref_code, wallet_crypto, address_usdt, vip, level } = userData;
        
        console.log('Extracted fields:', {
            user_id,
            phone_number,
            nik_name,
            usdt,
            vndc,
            invite,
            ref_code,
            wallet_crypto,
            address_usdt,
            vip,
            level
        });
        
        if (!user_id) {
            console.log('Missing user_id in request');
            return res.status(400).json({
                success: false,
                message: 'user_id is required'
            });
        }

        // Check database connection
        const connection = await pool.getConnection();
        try {
            // Check if user already exists
            console.log('Checking if user exists:', user_id);
            const [existingUsers] = await connection.query(
                'SELECT user_id FROM users WHERE user_id = ?',
                [user_id]
            );
            console.log('Existing users found:', existingUsers);

            if (existingUsers.length > 0) {
                // Update existing user
                console.log('Updating existing user:', user_id);
                const [result] = await connection.query(
                    `UPDATE users SET 
                        phone_number = ?,
                        nik_name = ?,
                        usdt = ?,
                        vndc = ?,
                        invite = ?,
                        ref_code = ?,
                        wallet_crypto = ?,
                        address_usdt = ?,
                        vip = ?,
                        level = ?
                    WHERE user_id = ?`,
                    [
                        phone_number || '',
                        nik_name || '',
                        usdt || 0,
                        vndc || 0,
                        invite || '',
                        ref_code || '',
                        wallet_crypto || '',
                        address_usdt || '',
                        vip || 0,
                        level || 0,
                        user_id
                    ]
                );
                console.log('Update result:', result);

                return res.json({
                    success: true,
                    message: 'User updated successfully',
                    userId: user_id
                });
            }

            // Create new user
            console.log('Creating new user:', user_id);
            const [result] = await connection.query(
                `INSERT INTO users (user_id, phone_number, nik_name, usdt, vndc, invite, ref_code, 
                    wallet_crypto, address_usdt, vip, level) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    user_id,
                    phone_number || '',
                    nik_name || '',
                    usdt || 0,
                    vndc || 0,
                    invite || '',
                    ref_code || '',
                    wallet_crypto || '',
                    address_usdt || '',
                    vip || 0,
                    level || 0
                ]
            );
            console.log('Insert result:', result);

            res.json({
                success: true,
                message: 'User created successfully',
                userId: user_id
            });
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Detailed error:', error);
        logger.error('Error in saveUser:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to save user',
            error: error.message
        });
    }
};

// Get user by ID
const getUser = async (req, res) => {
    try {
        const { userId } = req.params;
        
        const [users] = await pool.query(
            'SELECT * FROM users WHERE user_id = ?',
            [userId]
        );

        if (users.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        res.json({
            success: true,
            user: users[0]
        });
    } catch (error) {
        logger.error('Error in getUser:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve user'
        });
    }
};

// Get all users
const getAllUsers = async (req, res) => {
    try {
        const { search } = req.query;
        let query = 'SELECT * FROM users';
        let params = [];
        if (search) {
        query += ' WHERE phone_number LIKE ? OR user_id LIKE ?';
        params = [`%${search}%`, `%${search}%`];
        }
        query += ' ORDER BY created_at DESC';
        const [users] = await pool.query(query, params);
        res.json({
        success: true,
        users
        });
    } catch (error) {
        logger.error('Error in getAllUsers:', error);
        res.status(500).json({
        success: false,
        message: 'Failed to retrieve users'
        });
    }
};
// Get user info
const getUserInfo = async (req, res) => {
    try {
        const userId = req.user.id;
        
        const [users] = await pool.query(
            'SELECT * FROM users WHERE user_id = ?',
            [userId]
        );

        if (users.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        res.json({
            success: true,
            user: users[0]
        });
    } catch (error) {
        logger.error('Error in getUserInfo:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve user info'
        });
    }
};

// Update user status
const updateUserStatus = async (req, res) => {
    try {
        const { userId } = req.params;
        const { is_active } = req.body;

        if (typeof is_active !== 'boolean') {
            return res.status(400).json({
                success: false,
                message: 'is_active must be a boolean value'
            });
        }

        const [result] = await pool.query(
            'UPDATE users SET is_active = ? WHERE user_id = ?',
            [is_active, userId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        res.json({
            success: true,
            message: 'User status updated successfully'
        });
    } catch (error) {
        logger.error('Error in updateUserStatus:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update user status'
        });
    }
};

// Check user access
const checkUserAccess = async (req, res) => {
    try {
        const { userId } = req.params;
        
        const [users] = await pool.query(
            'SELECT is_active FROM users WHERE user_id = ?',
            [userId]
        );

        if (users.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'User not found',
                data: { isActive: false }
            });
        }

        res.json({
            success: true,
            data: {
                isActive: users[0].is_active === 1 || users[0].is_active === true
            }
        });
    } catch (error) {
        logger.error('Error in checkUserAccess:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to check user access',
            data: { isActive: false }
        });
    }
};

const getUserStatus = async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const { userId } = req.params;
    
    const [users] = await connection.query(
      'SELECT status FROM users WHERE id = ?',
      [userId]
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      status: users[0].status
    });
  } catch (error) {
    console.error('Error getting user status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get user status'
    });
  } finally {
    connection.release();
  }
};

// Add or update unlimited activation status
const updateUnlimitedStatus = async (req, res) => {
  try {
    const { userId } = req.params;
    const { active_unlimitted } = req.body;
    if (typeof active_unlimitted === 'undefined') {
      return res.status(400).json({ success: false, message: 'Missing active_unlimitted value' });
    }
    const [result] = await pool.query(
      'UPDATE users SET active_unlimitted = ? WHERE user_id = ?',
      [active_unlimitted, userId]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    res.json({ success: true, message: 'Unlimited activation status updated' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update unlimited status', error: error.message });
  }
};

module.exports = {
    saveUser,
    getUser,
    getAllUsers,
    getUserInfo,
    updateUserStatus,
    checkUserAccess,
    getUserStatus,
    updateUnlimitedStatus
}; 