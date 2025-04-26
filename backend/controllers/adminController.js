const Admin = require('../models/Admin');
const { auth, isSuperAdmin } = require('../middleware/auth');

const adminController = {
  async login(req, res) {
    try {
      const { username, password } = req.body;

      const admin = await Admin.findByUsername(username);
      if (!admin) {
        return res.status(401).json({
          success: false,
          message: 'Invalid credentials'
        });
      }

      const isPasswordValid = await Admin.verifyPassword(password, admin.password);
      if (!isPasswordValid) {
        return res.status(401).json({
          success: false,
          message: 'Invalid credentials'
        });
      }

      if (!admin.is_active) {
        return res.status(403).json({
          success: false,
          message: 'Admin account is deactivated'
        });
      }

      const token = Admin.generateToken(admin);
      await Admin.updateLastLogin(admin.id);

      res.json({
        success: true,
        data: {
          token,
          admin: {
            id: admin.id,
            username: admin.username,
            email: admin.email,
            role: admin.role
          }
        }
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({
        success: false,
        message: 'Error during login'
      });
    }
  },

  async createAdmin(req, res) {
    try {
      const { username, password, email, role } = req.body;

      const existingAdmin = await Admin.findByUsername(username);
      if (existingAdmin) {
        return res.status(400).json({
          success: false,
          message: 'Username already exists'
        });
      }

      const adminId = await Admin.create({ username, password, email, role });

      res.status(201).json({
        success: true,
        message: 'Admin created successfully',
        data: { id: adminId }
      });
    } catch (error) {
      console.error('Create admin error:', error);
      res.status(500).json({
        success: false,
        message: 'Error creating admin'
      });
    }
  },

  async getAdmins(req, res) {
    try {
      const admins = await Admin.findAll();
      res.json({
        success: true,
        data: admins.map(admin => ({
          id: admin.id,
          username: admin.username,
          email: admin.email,
          role: admin.role,
          is_active: admin.is_active,
          last_login: admin.last_login
        }))
      });
    } catch (error) {
      console.error('Get admins error:', error);
      res.status(500).json({
        success: false,
        message: 'Error getting admins'
      });
    }
  },

  async updateAdminStatus(req, res) {
    try {
      const { adminId } = req.params;
      const { is_active } = req.body;

      const admin = await Admin.findById(adminId);
      if (!admin) {
        return res.status(404).json({
          success: false,
          message: 'Admin not found'
        });
      }

      await Admin.updateStatus(adminId, is_active);

      res.json({
        success: true,
        message: 'Admin status updated successfully'
      });
    } catch (error) {
      console.error('Update admin status error:', error);
      res.status(500).json({
        success: false,
        message: 'Error updating admin status'
      });
    }
  },

  async logout(req, res) {
    try {
      const token = req.header('Authorization')?.replace('Bearer ', '');
      if (token) {
        await Admin.deleteSession(token);
      }
      res.json({
        success: true,
        message: 'Logged out successfully'
      });
    } catch (error) {
      console.error('Logout error:', error);
      res.status(500).json({
        success: false,
        message: 'Error during logout'
      });
    }
  }
};

module.exports = adminController; 