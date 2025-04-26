import React, { useEffect, useState } from 'react';
import axios from 'axios';
import AdminLayout from '../components/AdminLayout';
import { FaSearch, FaSpinner, FaCheck, FaTimes } from 'react-icons/fa';

const STATUSES = ['ALL', 'PENDING', 'WIN', 'LOSS'];
const PAGE_SIZE = 20;
const API_URL = process.env.REACT_APP_API_URL;
const API_URL2 = process.env.REACT_APP_API_URL2;
const CopyExpertManagement = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [actionType, setActionType] = useState('');

  const getAdminToken = () => localStorage.getItem('adminToken');

  const fetchOrders = async () => {
    setLoading(true);
    setError('');
    try {
      const params = {
        offset: (page - 1) * PAGE_SIZE,
        limit: PAGE_SIZE,
      };
      if (statusFilter !== 'ALL') params.status = statusFilter;
      if (searchQuery) params.search = searchQuery;
      const response = await axios.get(`${API_URL}/copy-expert-orders`, {
        params,
        headers: {
          Authorization: `Bearer ${getAdminToken()}`,
        },
      });
      if (response.data && response.data.data) {
        setOrders(response.data.data.orders || response.data.data);
        setTotal(response.data.data.total || response.data.data.length || 0);
      } else {
        setOrders([]);
        setTotal(0);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch orders');
      setOrders([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
    // eslint-disable-next-line
  }, [statusFilter, page]);

  const handleStatusChange = (e) => {
    setStatusFilter(e.target.value);
    setPage(1);
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    setPage(1);
    fetchOrders();
  };

  const handleAction = (order, type) => {
    setSelectedOrder(order);
    setActionType(type);
    setShowModal(true);
  };

  const confirmAction = async () => {
    if (!selectedOrder) return;
    try {
      setLoading(true);
      await axios.patch(
        `${API_URL}/copy-expert-orders/${selectedOrder.order_code}/admin`,
        { status: actionType },
        {
          headers: {
            Authorization: `Bearer ${getAdminToken()}`,
            'Content-Type': 'application/json',
          },
        }
      );
      setShowModal(false);
      setSelectedOrder(null);
      setActionType('');
      fetchOrders();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update order status');
    } finally {
      setLoading(false);
    }
  };

  const renderTable = () => (
    <div className="bg-[#1E1E1E] rounded-lg overflow-hidden shadow-lg">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-[#2C2C2C]">
            <tr>
              <th className="px-4 sm:px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Mã giao dịch</th>
              <th className="px-4 sm:px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">ID người dùng</th>
              <th className="px-4 sm:px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Tên chuyên gia</th>
              <th className="px-4 sm:px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Loại</th>
              <th className="px-4 sm:px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Khối lượng</th>
              <th className="px-4 sm:px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Trạng thái</th>
              <th className="px-4 sm:px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Ngày tạo</th>
              {/* <th className="px-4 sm:px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Action</th> */}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {loading ? (
              <tr>
                <td colSpan="8" className="px-6 py-8 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <FaSpinner className="animate-spin h-8 w-8 text-[#00DC82]" />
                    <span className="text-gray-400">Đang tải dữ liệu...</span>
                  </div>
                </td>
              </tr>
            ) : orders.length === 0 ? (
              <tr>
                <td colSpan="8" className="px-6 py-8 text-center text-gray-400">
                  Không có giao dịch nào
                </td>
              </tr>
            ) : (
              orders.map((order) => (
                <tr key={order.order_code} className="hover:bg-[#2C2C2C] transition-colors duration-150">
                  <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-white">{order.order_code}</td>
                  <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-white">{order.user_id}</td>
                  <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-white">{order.bot}</td>
                  <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-white">{order.type}</td>
                  <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-white">{order.amount}</td>
                  <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${order.status === 'WIN'
                        ? 'bg-green-900/30 text-green-400'
                        : order.status === 'LOSS'
                          ? 'bg-red-900/30 text-red-400'
                          : 'bg-yellow-900/30 text-yellow-400'
                      }`}>
                      {order.status}
                    </span>
                  </td>
                  <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-white">{order.createdAt ? new Date(order.createdAt).toLocaleString() : '-'}</td>
                  
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderPagination = () => {
    const totalPages = Math.ceil(total / PAGE_SIZE);
    if (totalPages <= 1) return null;
    return (
      <div className="flex justify-center items-center mt-4 space-x-2">
        <button
          className="px-3 py-1 bg-gray-700 text-white rounded disabled:opacity-50"
          onClick={() => setPage(page - 1)}
          disabled={page === 1}
        >Prev</button>
        <span className="text-white">Page {page} of {totalPages}</span>
        <button
          className="px-3 py-1 bg-gray-700 text-white rounded disabled:opacity-50"
          onClick={() => setPage(page + 1)}
          disabled={page === totalPages}
        >Next</button>
      </div>
    );
  };

  return (
    <div className="space-y-6 p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-bold text-white">Quản lý chuyên gia</h1>
        <div className="w-full sm:w-auto flex flex-col sm:flex-row gap-4">
          <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm kiếm bằng mã giao dịch hoặc ID người dùng..."
                className="w-fit px-4 py-3 bg-[#2C2C2C] border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#00DC82] focus:border-transparent transition-colors duration-200 pl-10"
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
          <div>
            <label className="text-white mr-2">Trạng thái:</label>
            <select
              value={statusFilter}
              onChange={handleStatusChange}
              className="bg-[#2C2C2C] text-white px-3 py-2 rounded border border-gray-700"
            >
              {STATUSES.map(status => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-900/20 text-red-400 p-4 rounded-lg">
          {error}
        </div>
      )}

      {renderTable()}
      {renderPagination()}

      {/* Confirmation Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1E1E1E] rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
            <h3 className="text-xl font-bold text-white mb-4">
              Đồng ý {actionType === 'WIN' ? 'đổi thành WIN' : 'đổi thành LOSS'}
            </h3>
            <p className="text-gray-300 mb-6">
              Bạn có chắc <span className="font-bold text-white">{selectedOrder?.order_code}</span> as <span className="font-bold text-white">{actionType}</span>?
            </p>
            <div className="flex flex-col sm:flex-row justify-end gap-3 sm:space-x-4">
              <button
                onClick={() => {
                  setShowModal(false);
                  setSelectedOrder(null);
                  setActionType('');
                }}
                className="px-4 py-2 text-gray-300 hover:text-white transition-colors duration-200 rounded-lg border border-gray-700 hover:border-gray-600"
              >
                Hủy
              </button>
              <button
                onClick={confirmAction}
                className={`px-4 py-2 rounded-lg ${actionType === 'WIN'
                    ? 'bg-[#00DC82] hover:bg-[#00b86c]'
                    : 'bg-red-500 hover:bg-red-600'
                  } text-white transition-colors duration-200`}
              >
                Đồng ý
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CopyExpertManagement; 