import React from 'react';
import astronautImage from '../assets/astronaut.png';

const ProfitCard = ({ title, amount, isPositive = true }) => (
  <div className="bg-[#0F1A2E] rounded-xl p-4 sm:p-6">
    <h3 className="text-white/70 text-[13px] sm:text-sm mb-2">{title}</h3>
    <p className={`text-lg sm:text-xl font-bold ${isPositive ? 'text-[#00D88A]' : 'text-red-500'}`}>
      {isPositive ? '+' : '-'}${Math.abs(parseFloat(amount)).toLocaleString()}
    </p>
  </div>
);

const Statistics = () => {
  const profitData = [
    { title: 'Lợi nhuận hiện nay', amount: '315,241.98' },
    { title: 'Lợi nhuận hiện nay', amount: '315,241.98' },
    { title: 'Lợi nhuận tuần này', amount: '-315,241.98', isPositive: false },
    { title: 'Lợi nhuận tuần trước', amount: '315,241.98' }
  ];

  const botFeatures = [
    'Tự động giao dịch',
    'Tự động Copy theo kinh của chuyên gia',
    'Tự động dừng giao dịch khi đạt lợi nhuận ấn định',
    'Tự động dừng giao dịch khi đạt mức lỗ chấp nhận'
  ];

  return (
    <div className="space-y-6 sm:space-y-8">
      <div>
        <h2 className="text-lg sm:text-xl font-bold text-white mb-3 sm:mb-4">Thống kê lợi nhuận</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {profitData.map((item, index) => (
            <ProfitCard
              key={index}
              title={item.title}
              amount={item.amount}
              isPositive={item.isPositive !== false}
            />
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-[13px] sm:text-base text-white/70 mb-3 sm:mb-4">
          Tham gia cộng đồng BOT <span className="text-[#00D88A]">COINCEX</span> của chúng tôi ngay hôm nay
        </h3>

        <div className="bg-[#0F1A2E] rounded-xl p-4 sm:p-6 flex flex-col sm:flex-row items-center sm:items-start gap-6 sm:gap-8">
          <div className="flex-1 w-full">
            <h3 className="text-white font-bold text-base sm:text-lg mb-3 sm:mb-4">Tính năng vượt trội của BOT</h3>
            <ul className="space-y-2 sm:space-y-3">
              {botFeatures.map((feature, index) => (
                <li key={index} className="flex items-center gap-2 text-[13px] sm:text-base text-white/70">
                  <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-[#00D88A] rounded-full flex-shrink-0" />
                  <span className="flex-1">{feature}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="w-[160px] sm:w-[200px] flex-shrink-0">
            <img 
              src={astronautImage} 
              alt="Astronaut" 
              className="w-full h-auto"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Statistics; 