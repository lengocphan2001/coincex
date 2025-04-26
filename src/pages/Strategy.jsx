import React, { useState, useEffect } from 'react';
import { FaEdit, FaTrash } from 'react-icons/fa';
import { IoMdClose } from 'react-icons/io';
import axios from 'axios';
const API_URL = process.env.REACT_APP_API_URL;
const API_URL2 = process.env.REACT_APP_API_URL2;

const Modal = ({ isOpen, onClose, children }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose}></div>
      <div className="relative bg-[#0F1A2E] rounded-xl p-6 w-full max-w-2xl m-4">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-white/70 hover:text-white"
        >
          <IoMdClose className="w-6 h-6" />
        </button>
        {children}
      </div>
    </div>
  );
};

const DeleteConfirmationModal = ({ isOpen, onClose, onConfirm, strategyName }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose}></div>
      <div className="relative bg-[#0F1A2E] rounded-xl p-6 w-full max-w-md m-4">
        <h3 className="text-xl font-medium text-white mb-4">Xác nhận xóa</h3>
        <p className="text-white/70 mb-6">
          Bạn có chắc chắn muốn xóa chiến lược "{strategyName}" không? 
          Hành động này không thể hoàn tác.
        </p>
        <div className="flex justify-end gap-4">
          <button
            onClick={onClose}
            className="px-6 py-3 rounded-lg text-white/70 hover:text-white transition-colors"
          >
            Hủy
          </button>
          <button
            onClick={onConfirm}
            className="px-6 py-3 rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors"
          >
            Xóa
          </button>
        </div>
      </div>
    </div>
  );
};

const StrategyCard = ({ 
  strategy, 
  isRunning, 
  onSettingsClick, 
  onActionClick, 
  onEditClick,
  onDeleteClick 
}) => {
  const userId = localStorage.getItem('userId');
  const isOwner = strategy.user_id === userId;

  return (
    <div className="flex items-center justify-between bg-[#0F1A2E] rounded-lg p-4">
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="text-white">{strategy.name}</span>
          {strategy.isDefault && (
            <span className="text-xs text-[#00D88A] px-2 py-1 rounded-full border border-[#00D88A]">
              Mặc định
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-3">
        {!strategy.isDefault && isOwner && (
          <>
            <button
              onClick={() => onEditClick(strategy)}
              className="p-2 text-white/70 hover:text-[#00D88A] transition-colors"
            >
              <FaEdit className="w-5 h-5" />
            </button>
            <button
              onClick={() => onDeleteClick(strategy)}
              className="p-2 text-white/70 hover:text-red-500 transition-colors"
            >
              <FaTrash className="w-5 h-5" />
            </button>
          </>
        )}
        <button
          onClick={onActionClick}
          className={`px-6 py-2 rounded-lg text-white ${
            isRunning ? 'bg-[#00D88A]' : 'bg-[#00D88A]'
          }`}
        >
          {isRunning ? 'Đang chạy' : 'Chạy thôi nào'}
        </button>
      </div>
    </div>
  );
};

const Strategy = () => {
  const [strategies, setStrategies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [strategyName, setStrategyName] = useState('');
  const [sequence, setSequence] = useState('');
  const [capitalManagement, setCapitalManagement] = useState('');
  const [stopLoss, setStopLoss] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStrategy, setEditingStrategy] = useState(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState({
    isOpen: false,
    strategy: null
  });

  const fetchAllStrategies = async () => {
    try {
      const userId = localStorage.getItem('userId');
      // Fetch default strategies (admin's strategies)
      const defaultResponse = await axios.get(`${API_URL}/strategies/user/admin`);
      
      const defaultStrategies = defaultResponse.data.success ? defaultResponse.data.data.map(s => ({...s, isDefault: true})) : [];
      
      // Fetch user's strategies
      const userResponse = await axios.get(`${API_URL}/strategies/user/${userId}`);
      const userStrategies = userResponse.data.success ? userResponse.data.data : [];
      
      // Combine both, with default strategies first
      return [...defaultStrategies, ...userStrategies];
    } catch (error) {
      console.error('Error fetching strategies:', error);
      throw error;
    }
  };

  useEffect(() => {
    const initializeStrategies = async () => {
      try {
        const allStrategies = await fetchAllStrategies();
        setStrategies(allStrategies);
      } catch (error) {
        console.error('Error initializing strategies:', error);
        setError('Failed to load strategies');
      } finally {
        setLoading(false);
      }
    };

    initializeStrategies();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const userId = localStorage.getItem('userId');
      const data = {
        name: strategyName,
        user_id: userId,
        follow_candle: sequence,
        capital_management: capitalManagement,
        sl_tp: stopLoss
      };

      await axios.post(`${API_URL}/strategies`, data);
      
      // Reset form
      setStrategyName('');
      setSequence('');
      setCapitalManagement('');
      setStopLoss('');
      
      // Refresh strategies list
      const allStrategies = await fetchAllStrategies();
      setStrategies(allStrategies);
      
    } catch (error) {
      console.error('Error creating strategy:', error);
      setError('Failed to create strategy');
    }
  };

  const handleDelete = async (strategyId) => {
    try {
      const response = await axios.delete(`${API_URL}/strategies/${strategyId}`);
      if (response.data.success) {
        setDeleteConfirmation({ isOpen: false, strategy: null });
        const allStrategies = await fetchAllStrategies();
        setStrategies(allStrategies);
      } else {
        setError(response.data.message || 'Failed to delete strategy');
      }
    } catch (error) {
      console.error('Error deleting strategy:', error);
      setError(error.response?.data?.message || 'Failed to delete strategy');
    }
  };

  const handleEdit = (strategy) => {
    setEditingStrategy(strategy);
    setStrategyName(strategy.name);
    setSequence(strategy.follow_candle);
    setCapitalManagement(strategy.capital_management);
    setStopLoss(strategy.sl_tp);
    setIsModalOpen(true);
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    try {
      const data = {
        name: strategyName,
        follow_candle: sequence,
        capital_management: capitalManagement,
        sl_tp: stopLoss
      };

      await axios.put(`${API_URL}/strategies/${editingStrategy.id}`, data);
      
      // Reset form and close modal
      setStrategyName('');
      setSequence('');
      setCapitalManagement('');
      setStopLoss('');
      setEditingStrategy(null);
      setIsModalOpen(false);
      
      // Refresh strategies list
      const allStrategies = await fetchAllStrategies();
      setStrategies(allStrategies);
      
    } catch (error) {
      console.error('Error updating strategy:', error);
      setError('Failed to update strategy');
    }
  };

  const openDeleteConfirmation = (strategy) => {
    if (!strategy || !strategy.id) {
      console.error('Invalid strategy:', strategy);
      setError('Cannot delete this strategy');
      return;
    }
    setDeleteConfirmation({
      isOpen: true,
      strategy: strategy
    });
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#00DC82]"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-[#0F1A2E] rounded-xl p-6">
        <h2 className="text-white text-lg font-medium mb-6">TẠO CHIẾN LƯỢC CHO BẠN</h2>
        
        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left Column */}
            <div className="space-y-4">
              <div>
                <label className="block text-white/70 text-sm mb-2">Đặt tên chiến lược</label>
                <input
                  type="text"
                  value={strategyName}
                  onChange={(e) => setStrategyName(e.target.value)}
                  className="w-full bg-[#0B1221] rounded-lg p-4 text-white text-sm border-0 focus:ring-1 focus:ring-[#00D88A] outline-none"
                  placeholder="Fibo mặc định 1.0"
                  required
                />
              </div>
              
              <div>
                <label className="block text-white/70 text-sm mb-2">Quản lý vốn</label>
                <input
                  type="text"
                  value={capitalManagement}
                  onChange={(e) => setCapitalManagement(e.target.value)}
                  className="w-full bg-[#0B1221] rounded-lg p-4 text-white text-sm border-0 focus:ring-1 focus:ring-[#00D88A] outline-none"
                  placeholder="Ví dụ : 0.1-0.2-0.4-0.8-1.6"
                  required
                />
              </div>
            </div>

            {/* Right Column */}
            <div className="space-y-4">
              <div>
                <label className="block text-white/70 text-sm mb-2">Theo nến</label>
                <input
                  type="text"
                  value={sequence}
                  onChange={(e) => setSequence(e.target.value)}
                  className="w-full bg-[#0B1221] rounded-lg p-4 text-white text-sm border-0 focus:ring-1 focus:ring-[#00D88A] outline-none"
                  placeholder="d-d-x-d-x-d-x"
                  required
                />
              </div>
              
              <div>
                <label className="block text-white/70 text-sm mb-2">Dừng lỗ & Chốt lỗ</label>
                <input
                  type="text"
                  value={stopLoss}
                  onChange={(e) => setStopLoss(e.target.value)}
                  className="w-full bg-[#0B1221] rounded-lg p-4 text-white text-sm border-0 focus:ring-1 focus:ring-[#00D88A] outline-none"
                  placeholder="SL/TP"
                  required
                />
              </div>
            </div>
          </div>

          <div className="mt-6 flex justify-center">
            <button 
              type="submit" 
              className="bg-[#00D88A] text-white px-8 py-3 rounded-lg hover:bg-opacity-90 transition-colors"
            >
              Hoàn thành
            </button>
          </div>
        </form>
      </div>

      {/* Strategy List */}
      <div className="bg-[#0F1A2E] rounded-xl p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-white text-lg font-medium">Danh sách các chiến lược đã tạo</h2>
        </div>
        
        {error && (
          <div className="text-red-500 text-sm mb-4">{error}</div>
        )}

        <div className="space-y-4">
          {strategies.map((strategy) => (
            <StrategyCard
              key={strategy.id}
              strategy={strategy}
              isRunning={false}
              onSettingsClick={() => {}}
              onActionClick={() => {}}
              onEditClick={handleEdit}
              onDeleteClick={openDeleteConfirmation}
            />
          ))}
        </div>
      </div>

      {/* Edit Strategy Modal */}
      <Modal isOpen={isModalOpen} onClose={() => {
        setIsModalOpen(false);
        setEditingStrategy(null);
        setStrategyName('');
        setSequence('');
        setCapitalManagement('');
        setStopLoss('');
      }}>
        <div className="text-white">
          <h2 className="text-xl font-medium mb-6">Chỉnh sửa chiến lược</h2>
          <form onSubmit={handleUpdate}>
            <div className="space-y-4">
              <div>
                <label className="block text-white/70 text-sm mb-2">Tên chiến lược</label>
                <input
                  type="text"
                  value={strategyName}
                  onChange={(e) => setStrategyName(e.target.value)}
                  className="w-full bg-[#0B1221] rounded-lg p-4 text-white text-sm border-0 focus:ring-1 focus:ring-[#00D88A] outline-none"
                  required
                />
              </div>
              
              <div>
                <label className="block text-white/70 text-sm mb-2">Theo nến</label>
                <input
                  type="text"
                  value={sequence}
                  onChange={(e) => setSequence(e.target.value)}
                  className="w-full bg-[#0B1221] rounded-lg p-4 text-white text-sm border-0 focus:ring-1 focus:ring-[#00D88A] outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-white/70 text-sm mb-2">Quản lý vốn</label>
                <input
                  type="text"
                  value={capitalManagement}
                  onChange={(e) => setCapitalManagement(e.target.value)}
                  className="w-full bg-[#0B1221] rounded-lg p-4 text-white text-sm border-0 focus:ring-1 focus:ring-[#00D88A] outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-white/70 text-sm mb-2">Dừng lỗ & Chốt lỗ</label>
                <input
                  type="text"
                  value={stopLoss}
                  onChange={(e) => setStopLoss(e.target.value)}
                  className="w-full bg-[#0B1221] rounded-lg p-4 text-white text-sm border-0 focus:ring-1 focus:ring-[#00D88A] outline-none"
                  required
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-4">
              <button
                type="button"
                onClick={() => {
                  setIsModalOpen(false);
                  setEditingStrategy(null);
                  setStrategyName('');
                  setSequence('');
                  setCapitalManagement('');
                  setStopLoss('');
                }}
                className="px-6 py-3 rounded-lg text-white/70 hover:text-white transition-colors"
              >
                Hủy
              </button>
              <button
                type="submit"
                className="bg-[#00D88A] text-white px-6 py-3 rounded-lg hover:bg-opacity-90 transition-colors"
              >
                Cập nhật
              </button>
            </div>
          </form>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <DeleteConfirmationModal
        isOpen={deleteConfirmation.isOpen}
        onClose={() => setDeleteConfirmation({ isOpen: false, strategy: null })}
        onConfirm={() => deleteConfirmation.strategy && handleDelete(deleteConfirmation.strategy.id)}
        strategyName={deleteConfirmation.strategy?.name}
      />
    </div>
  );
};

export default Strategy; 