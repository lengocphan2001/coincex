import React, { useState, useEffect } from 'react';
import { FaSearch, FaSpinner, FaUser, FaClock, FaCheck, FaTimes, FaPhone } from 'react-icons/fa';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
const API_URL = process.env.REACT_APP_API_URL;
const API_URL2 = process.env.REACT_APP_API_URL2;
const Members = () => {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [actionType, setActionType] = useState('');
  
  useEffect(() => {
    searchUsers();
  }, [navigate]);

  const searchUsers = async (searchValue) => {
    try {
      setLoading(true);
      setError('');
      const token = localStorage.getItem('adminToken');
      if (!token) return;
      const url = searchValue
        ? `${API_URL}/users?search=${encodeURIComponent(searchValue)}`
        : `${API_URL}/users`;
      const response = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data.success) {
        setUsers(response.data.users || []);
      } else {
        setUsers([]);
        setError('Không tìm thấy thành viên nào');
      }
    } catch (error) {
      setUsers([]);
      setError(error.response?.data?.message || 'Lỗi khi tìm kiếm thành viên');
    } finally {
      setLoading(false);
    }
  };

  const handleAuthError = () => {
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminData');
    navigate('/admin/login');
  };

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('adminToken');
      if (!token) {
        handleAuthError();
        return;
      }

      const response = await axios.get(`${API_URL}/users`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      if (response.data.success) {
        setUsers(response.data.users || []);
        setError('');
      } else {
        setError('Failed to fetch users');
      }
    } catch (error) {
      if (error.response?.status === 401 || error.response?.status === 403) {
        handleAuthError();
      } else {
        setError(error.response?.data?.message || 'Error fetching users');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      const token = localStorage.getItem('adminToken');
      if (!token) {
        handleAuthError();
        return;
      }

      const response = await axios.get(`${API_URL}/users?search=${searchQuery}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      if (response.data.success) {
        setUsers(response.data.users || []);
        setError('');
      } else {
        setError('Search failed');
      }
    } catch (error) {
      if (error.response?.status === 401 || error.response?.status === 403) {
        handleAuthError();
      } else {
        setError(error.response?.data?.message || 'Error searching users');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAction = (user_id, currentStatus) => {
    const token = localStorage.getItem('adminToken');
    const adminData = localStorage.getItem('adminData');

    if (!token || !adminData) {
      handleAuthError();
      return;
    }

    try {
      const admin = JSON.parse(adminData);
      if (admin.role !== 'super_admin') {
        setError('Super admin access required');
        return;
      }
      setSelectedUser(user_id);
      setActionType(currentStatus ? 'deactivate' : 'activate');
      setShowModal(true);
    } catch (error) {
      handleAuthError();
    }
  };

  const confirmAction = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('adminToken');
      const adminData = localStorage.getItem('adminData');

      if (!token || !adminData) {
        handleAuthError();
        return;
      }

      const admin = JSON.parse(adminData);
      if (admin.role !== 'super_admin') {
        setError('Super admin access required');
        setShowModal(false);
        setSelectedUser(null);
        setActionType('');
        return;
      }

      const newStatus = actionType === 'activate';
      const response = await axios.put(
        `${API_URL}/users/${selectedUser}/status`,
        { is_active: newStatus },
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      if (response.data.success) {
        setUsers(users.map(user => 
          user.user_id === selectedUser 
            ? { ...user, is_active: newStatus }
            : user
        ));
        setError('');
      } else {
        setError('Failed to update user status');
      }
    } catch (error) {
      if (error.response?.status === 401 || error.response?.status === 403) {
        handleAuthError();
      } else {
        setError(error.response?.data?.message || 'Error updating user status');
      }
    } finally {
      setLoading(false);
      setShowModal(false);
      setSelectedUser(null);
      setActionType('');
    }
  };

  return (
    <div className="space-y-6 p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-bold text-white">User Management</h1>
        <div className="w-full sm:w-auto">
          <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm kiếm user..."
                className="w-full px-4 py-3 bg-[#2C2C2C] border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#00DC82] focus:border-transparent transition-colors duration-200 pl-10"
              />
              <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            </div>
            <button 
              type="submit"
              className="px-6 py-3 bg-[#00DC82] text-white rounded-lg hover:bg-[#00b86c] transition-all duration-200 hover:shadow-lg hover:shadow-[#00DC82]/20 whitespace-nowrap"
            >
              Tìm kiếm
            </button>
          </form>
        </div>
      </div>

      {error && (
        <div className="bg-red-900/20 text-red-400 p-4 rounded-lg">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="bg-[#1E1E1E] rounded-lg overflow-hidden shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-[#2C2C2C]">
              <tr>
                <th className="px-4 sm:px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  <div className="flex items-center gap-2">
                    <FaPhone className="text-gray-400" />
                    <span className="hidden sm:inline">Số điện thoại</span>
                  </div>
                </th>
                <th className="px-4 sm:px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  <div className="flex items-center gap-2">
                    <FaClock className="text-gray-400" />
                    <span className="hidden sm:inline">Thời gian tạo</span>
                  </div>
                </th>
                <th className="px-4 sm:px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  <div className="flex items-center gap-2">
                    <FaCheck className="text-gray-400" />
                    <span className="hidden sm:inline">Trạng thái</span>
                  </div>
                </th>
                <th className="px-4 sm:px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  <div className="flex items-center gap-2">
                    <FaTimes className="text-gray-400" />
                    <span className="hidden sm:inline">Duyệt/Hủy</span>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {loading ? (
                <tr>
                  <td colSpan="4" className="px-6 py-8 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <FaSpinner className="animate-spin h-8 w-8 text-[#00DC82]" />
                      <span className="text-gray-400">Đang tải dữ liệu...</span>
                    </div>
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan="4" className="px-6 py-8 text-center text-gray-400">
                    Không có thành viên nào
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user.user_id} className="hover:bg-[#2C2C2C] transition-colors duration-150">
                    <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-white">
                      <div className="flex items-center gap-2">
                        <FaUser className="text-gray-400 sm:hidden" />
                        {user.phone_number}
                      </div>
                    </td>
                    <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-white">
                      <div className="flex items-center gap-2">
                        <FaClock className="text-gray-400 sm:hidden" />
                        {new Date(user.created_at).toLocaleString()}
                      </div>
                    </td>
                    <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm">
                      <div className="flex items-center gap-2">
                        <FaCheck className={`sm:hidden ${user.is_active ? 'text-green-400' : 'text-gray-400'}`} />
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                          user.is_active 
                            ? 'bg-green-900/30 text-green-400'
                            : 'bg-gray-800 text-gray-400'
                        }`}>
                          {user.is_active ? 'Đã kích hoạt' : 'Chưa kích hoạt'}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm">
                      <div className="flex items-center gap-2">
                        <FaTimes className="text-gray-400 sm:hidden" />
                        <button
                          onClick={() => handleAction(user.user_id, user.is_active)}
                          className={`${
                            user.is_active 
                              ? 'text-red-400 hover:text-red-300'
                              : 'text-[#00DC82] hover:text-[#00b86c]'
                          } transition-colors duration-200`}
                        >
                          {user.is_active ? 'Hủy kích hoạt' : 'Duyệt'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1E1E1E] rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
            <h3 className="text-xl font-bold text-white mb-4">
              Xác nhận {actionType === 'activate' ? 'kích hoạt' : 'hủy kích hoạt'} user
            </h3>
            <p className="text-gray-300 mb-6">
              Bạn có chắc chắn muốn {actionType === 'activate' ? 'kích hoạt' : 'hủy kích hoạt'} user {selectedUser}?
            </p>
            <div className="flex flex-col sm:flex-row justify-end gap-3 sm:space-x-4">
              <button
                onClick={() => {
                  setShowModal(false);
                  setSelectedUser(null);
                  setActionType('');
                }}
                className="px-4 py-2 text-gray-300 hover:text-white transition-colors duration-200 rounded-lg border border-gray-700 hover:border-gray-600"
              >
                Hủy
              </button>
              <button
                onClick={confirmAction}
                className={`px-4 py-2 rounded-lg ${
                  actionType === 'activate'
                    ? 'bg-[#00DC82] hover:bg-[#00b86c]'
                    : 'bg-red-500 hover:bg-red-600'
                } text-white transition-colors duration-200`}
              >
                Xác nhận
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Members; 