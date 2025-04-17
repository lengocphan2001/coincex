import React, { useState } from 'react';
import { FaPlay } from 'react-icons/fa';

const TransactionRow = ({ time, bot, type, amount, status, profit }) => {
  const isProfit = profit && parseFloat(profit) > 0;
  const isPending = status === 'Chờ xử lý';
  
  return (
    <tr className="border-t border-[#0F1A2E]">
      <td className="py-4 px-4">
        <div className="text-white/70 text-sm flex flex-col">
          <div>{time.split(' ')[0]}</div>
          <div>{time.split(' ')[1]}</div>
        </div>
      </td>
      <td className="py-4 px-4 text-sm text-white/70">{bot}</td>
      <td className="py-4 px-4">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-yellow-400"></span>
          <span className="text-sm text-white/70">{type}</span>
        </div>
      </td>
      <td className="py-4 px-4 text-sm text-white/70">{amount}$</td>
      <td className="py-4 px-4 text-sm">
        {isPending ? (
          <span className="text-yellow-400">{status}</span>
        ) : (
          <span className="text-white/70">{status}</span>
        )}
      </td>
      <td className="py-4 px-4">
        {isPending ? (
          <div className="w-6 h-6 rounded-full border-2 border-yellow-400 border-t-transparent animate-spin"></div>
        ) : (
          <span className={`text-sm ${isProfit ? 'text-[#00D88A]' : 'text-red-500'}`}>
            {isProfit ? '+' : ''}{profit}$
          </span>
        )}
      </td>
    </tr>
  );
};

const CopyExpert = () => {
  const [expert, setExpert] = useState('');
  const [capitalManagement, setCapitalManagement] = useState('0.1-0.2');
  const [stopLoss, setStopLoss] = useState('SL/TP');

  const transactions = [
    { time: '03:42 16/04/2023', bot: 'Chuyên gia', type: 'LONG', amount: '100', status: 'Chờ xử lý' },
    { time: '03:42 16/04/2023', bot: 'Chuyên gia', type: 'LONG', amount: '100', status: 'Hoàn tất', profit: '195' },
    { time: '03:42 16/04/2023', bot: 'Chuyên gia', type: 'LONG', amount: '100', status: 'Hoàn tất', profit: '-100' },
    { time: '03:42 16/04/2023', bot: 'Chuyên gia', type: 'LONG', amount: '100', status: 'Hoàn tất', profit: '195' },
    { time: '03:42 16/04/2023', bot: 'Chuyên gia', type: 'LONG', amount: '100', status: 'Hoàn tất', profit: '195' },
  ];

  return (
    <div className="space-y-6">
      <div className="bg-[#0F1A2E] rounded-xl p-6">
        <h2 className="text-white text-lg font-medium mb-6">COPY THEO CHUYÊN GIA</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left Column */}
          <div className="space-y-4">
            <div>
              <label className="block text-white/70 text-sm mb-2">Chiến lược</label>
              <input
                type="text"
                value={expert}
                onChange={(e) => setExpert(e.target.value)}
                className="w-full bg-[#0B1221] rounded-lg p-4 text-white text-sm border-0 focus:ring-1 focus:ring-[#00D88A] outline-none"
                placeholder="Chọn chuyên gia"
              />
            </div>
            
            <div>
              <label className="block text-white/70 text-sm mb-2">Quản lý vốn</label>
              <input
                type="text"
                value={capitalManagement}
                onChange={(e) => setCapitalManagement(e.target.value)}
                className="w-full bg-[#0B1221] rounded-lg p-4 text-white text-sm border-0 focus:ring-1 focus:ring-[#00D88A] outline-none"
                placeholder="Nhập tỷ lệ quản lý vốn"
              />
            </div>
          </div>

          {/* Right Column */}
          <div className="space-y-4">
            <div>
              <label className="block text-white/70 text-sm mb-2">Lợi nhuận hiện tại</label>
              <div className="bg-[#0B1221] rounded-lg p-4">
                <h3 className="text-[#00D88A] text-xl font-bold">314,87$</h3>
              </div>
            </div>
            
            <div>
              <label className="block text-white/70 text-sm mb-2">Dừng lỗ & Chốt lỗ</label>
              <input
                type="text"
                value={stopLoss}
                onChange={(e) => setStopLoss(e.target.value)}
                className="w-full bg-[#0B1221] rounded-lg p-4 text-[#00D88A] text-sm border-0 focus:ring-1 focus:ring-[#00D88A] outline-none"
                placeholder="Nhập SL/TP"
              />
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-center">
          <button className="bg-[#00D88A] text-white px-8 py-3 rounded-lg flex items-center gap-2 hover:bg-opacity-90 transition-colors">
            <FaPlay className="w-4 h-4" />
            <span>Bắt đầu chạy</span>
          </button>
        </div>
      </div>

      {/* Transaction History */}
      <div className="bg-[#0F1A2E] rounded-xl p-6">
        <h2 className="text-white text-lg font-medium mb-6">Lịch sử giao dịch</h2>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-sm text-white/70">
                <th className="py-4 px-4">Time</th>
                <th className="py-4 px-4">BOT</th>
                <th className="py-4 px-4">Loại</th>
                <th className="py-4 px-4">Khối lượng</th>
                <th className="py-4 px-4">Tình trạng</th>
                <th className="py-4 px-4">Kết quả</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((transaction, index) => (
                <TransactionRow key={index} {...transaction} />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default CopyExpert; 