import React, { useState, useEffect } from 'react';
import { FaSearch, FaClock, FaCheck, FaTimes, FaSpinner, FaPhone } from 'react-icons/fa';
import axios from 'axios';
import AdminLayout from '../components/AdminLayout';
const API_URL = process.env.REACT_APP_API_URL;
const API_URL2 = process.env.REACT_APP_API_URL2;
const Activation30Days = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [actionType, setActionType] = useState('');

  useEffect(() => {
    searchUsers();
    // eslint-disable-next-line
  }, []);

  // After users are fetched, check for expired and deactivate if needed
  useEffect(() => {
    if (!users || users.length === 0) return;
    users.forEach(async (user) => {
      const activationDate = new Date(user.updated_at);
      const expiryDateObj = new Date(activationDate.getTime() + 30 * 24 * 60 * 60 * 1000);
      const expired = new Date() > expiryDateObj;
      if (expired && user.is_active) {
        try {
          const token = localStorage.getItem('adminToken');
          await axios.put(
            `${API_URL}/users/${user.user_id}/status`,
            { is_active: false },
            {
              headers: { Authorization: `Bearer ${token}` }
            }
          );
        } catch (err) {
          // Optionally handle error
        }
      }
    });
  }, [users]);

  const searchUsers = async (searchValue) => {
    try {
      setLoading(true);
      setError('');
      const token = localStorage.getItem('adminToken');
      if (!token) return;
      const url = searchValue
        ? `http://localhost:5001/api/users?search=${encodeURIComponent(searchValue)}`
        : 'http://localhost:5001/api/users';
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

  const handleSearch = async (e) => {
    e.preventDefault();
    searchUsers(search)
  };

  const formatDateTime = (dateString) => {
    const date = new Date(dateString);
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes} ${day}/${month}/${year}`;
  };

  // Helper to calculate days remaining
  const getDaysRemaining = (expiryDateObj) => {
    if (!expiryDateObj) return null;
    const now = new Date();
    const diff = expiryDateObj - now;
    if (diff <= 0) return null;
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  return (
    <div className="space-y-6 p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <span className="bg-[#00DC82] text-white px-4 py-2 rounded-full font-semibold text-sm">
          Số gói 30 ngày <span className="ml-1">{users.length}</span>
        </span>
        <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
          <div className="relative flex-1">
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
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

      {error && (
        <div className="bg-red-900/20 text-red-400 p-4 rounded-lg">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="bg-[#1E1E1E] rounded-lg overflow-hidden shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px]">
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
                    <span className="hidden sm:inline">Thời gian kích hoạt</span>
                  </div>
                </th>
                <th className="px-4 sm:px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  <div className="flex items-center gap-2">
                    <FaTimes className="text-gray-400" />
                    <span className="hidden sm:inline">Hết hạn</span>
                  </div>
                </th>
                <th className="px-4 sm:px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  <div className="flex items-center gap-2">
                    <FaCheck className="text-gray-400" />
                    <span className="hidden sm:inline">Duyệt/ Hủy</span>
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
                users.map((user, idx) => {
                  // Activation time is updated_at
                  const activationDate = new Date(user.updated_at);
                  const activationTime = formatDateTime(user.updated_at);
                  // Expiry is 30 days after updated_at
                  const expiryDateObj = new Date(activationDate.getTime() + 30 * 24 * 60 * 60 * 1000);
                  const expired = new Date() > expiryDateObj;
                  return (
                    <tr key={user.user_id || idx} className="hover:bg-[#2C2C2C] transition-colors duration-150">
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-white">{user.phone_number || user.username}</td>
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-white">{activationTime}</td>
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm">
                        <div className="flex items-center gap-2">
                          <FaCheck className={`sm:hidden ${expired ? 'text-red-400' : 'text-green-400'}`} />
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${expired || user.is_active === 0
                              ? 'bg-red-900/30 text-red-400'
                              : 'bg-green-900/30 text-green-400'
                            }`}>
                            {(expired || user.is_active === 0) ? 'Hết hạn' : `Còn hạn${getDaysRemaining(expiryDateObj) ? ` (${getDaysRemaining(expiryDateObj)} ngày)` : ''}`}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm">
                        <button
                          disabled={!expired && user.is_active}
                          className="text-[#00DC82] hover:text-[#00b86c] font-semibold transition-colors duration-200"
                          onClick={() => {
                            setSelectedUser(user.user_id);
                            setActionType('activate');
                            setShowModal(true);
                          }}
                        >
                          Kích hoạt lại
                        </button>
                      </td>
                    </tr>
                  );
                })
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
              Xác nhận kích hoạt lại thành viên 30 ngày
            </h3>
            <p className="text-gray-300 mb-6">
              Bạn có chắc chắn muốn kích hoạt lại thành viên {selectedUser}?
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
                onClick={async () => {
                  setLoading(true);
                  try {
                    const token = localStorage.getItem('adminToken');
                    await axios.put(
                      `http://localhost:5001/api/users/${selectedUser}/status`,
                      { is_active: true },
                      { headers: { Authorization: `Bearer ${token}` } }
                    );
                    setUsers(users.map(u =>
                      u.user_id === selectedUser
                        ? { ...u, is_active: true }
                        : u
                    ));
                    setShowModal(false);
                    setSelectedUser(null);
                    setActionType('');
                  } catch (err) {
                    setError('Failed to activate user');
                  } finally {
                    setLoading(false);
                  }
                }}
                className="px-4 py-2 rounded-lg bg-[#00DC82] hover:bg-[#00b86c] text-white transition-colors duration-200"
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

export default Activation30Days; 