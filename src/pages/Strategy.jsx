import React, { useState } from 'react';
import { FaCog } from 'react-icons/fa';

const StrategyCard = ({ name, isRunning, onSettingsClick, onActionClick }) => {
  return (
    <div className="flex items-center justify-between bg-[#0F1A2E] rounded-lg p-4">
      <span className="text-white">{name}</span>
      <div className="flex items-center gap-3">
        <button
          onClick={onSettingsClick}
          className="p-2 text-white/70 hover:text-white transition-colors"
        >
          <FaCog className="w-5 h-5" />
        </button>
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
  const [strategyName, setStrategyName] = useState('');
  const [sequence, setSequence] = useState('');
  const [capitalManagement, setCapitalManagement] = useState('');
  const [stopLoss, setStopLoss] = useState('');

  const strategies = [
    { name: 'Fibo mặc định 1.0', isRunning: false },
    { name: 'Fibo mặc định 1.1', isRunning: false },
    { name: 'Fibo mặc định 1.2', isRunning: true },
  ];

  return (
    <div className="space-y-6">
      <div className="bg-[#0F1A2E] rounded-xl p-6">
        <h2 className="text-white text-lg font-medium mb-6">TẠO CHIẾN LƯỢC CHO BẠN</h2>
        
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
              />
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-center">
          <button className="bg-[#00D88A] text-white px-8 py-3 rounded-lg hover:bg-opacity-90 transition-colors">
            Hoàn thành
          </button>
        </div>
      </div>

      {/* Strategy List */}
      <div className="bg-[#0F1A2E] rounded-xl p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-white text-lg font-medium">Danh sách các chiến lược đã tạo</h2>
          <button className="text-[#00D88A] text-sm hover:underline">
            Xoá danh sách
          </button>
        </div>
        
        <div className="space-y-4">
          {strategies.map((strategy, index) => (
            <StrategyCard
              key={index}
              name={strategy.name}
              isRunning={strategy.isRunning}
              onSettingsClick={() => {}}
              onActionClick={() => {}}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default Strategy; 