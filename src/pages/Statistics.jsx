import React, { useEffect, useState } from 'react';
import axios from 'axios';
import astronautImage from '../assets/astronaut.png';

const API_URL = process.env.REACT_APP_API_URL;

const ProfitCard = ({ title, amount, isPositive = true }) => (
  <div className="bg-[#0F1A2E] rounded-xl p-4 sm:p-6">
    <h3 className="text-white/70 text-[13px] sm:text-sm mb-2">{title}</h3>
    <p className={`text-lg sm:text-xl font-bold ${isPositive ? 'text-[#00D88A]' : 'text-red-500'}`}>
      {isPositive ? '+' : '-'}${Math.abs(parseFloat(amount)).toLocaleString()}
    </p>
  </div>
);

// Helper to calculate profit like CopyAI/CopyExpert
const calculateTotalProfit = (trades) => {
  return trades.reduce((total, trade) => {
    if (trade.status === 'LOSS') {
      return total - parseFloat(trade.amount);
    } else if (trade.status === 'WIN') {
      return total + (parseFloat(trade.received_usdt) - parseFloat(trade.amount));
    }
    return total;
  }, 0);
};

// Helper to filter trades by date
const isSameDay = (date1, date2) => {
  return date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate();
};
const isSameWeek = (date1, date2) => {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  const startOfWeek = (d) => {
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
    return new Date(d.setDate(diff));
  };
  return startOfWeek(d1).getTime() === startOfWeek(d2).getTime() && d1.getFullYear() === d2.getFullYear();
};
const isLastWeek = (date, now) => {
  const d = new Date(date);
  const n = new Date(now);
  const startOfThisWeek = new Date(n);
  const day = n.getDay();
  const diff = n.getDate() - day + (day === 0 ? -6 : 1);
  startOfThisWeek.setDate(diff);
  const startOfLastWeek = new Date(startOfThisWeek);
  startOfLastWeek.setDate(startOfThisWeek.getDate() - 7);
  const endOfLastWeek = new Date(startOfThisWeek);
  endOfLastWeek.setDate(startOfThisWeek.getDate() - 1);
  return d >= startOfLastWeek && d <= endOfLastWeek;
};

const Statistics = () => {
  const [profitData, setProfitData] = useState([
    { title: 'Lợi nhuận hiện nay', amount: '0' },
    { title: 'Lợi nhuận hôm nay', amount: '0' },
    { title: 'Lợi nhuận tuần này', amount: '0' },
    { title: 'Lợi nhuận tuần trước', amount: '0' }
  ]);

  useEffect(() => {
    const fetchAllTrades = async () => {
      try {
        const token = localStorage.getItem('token');
        const userId = localStorage.getItem('userId');
        const [aiRes, expertRes] = await Promise.all([
          axios.get(`${API_URL}/copy-ai-orders/user/${userId}`, { headers: { Authorization: `Bearer ${token}` } }),
          axios.get(`${API_URL}/copy-expert-orders/user/${userId}`, { headers: { Authorization: `Bearer ${token}` } })
        ]);
        const allTrades = [...(aiRes.data.data || []), ...(expertRes.data.data || [])];
        const now = new Date();
        // Today
        const todayTrades = allTrades.filter(trade => trade.createdAt && isSameDay(new Date(trade.createdAt), now));
        // This week
        const weekTrades = allTrades.filter(trade => trade.createdAt && isSameWeek(new Date(trade.createdAt), now));
        // Last week
        const lastWeekTrades = allTrades.filter(trade => trade.createdAt && isLastWeek(new Date(trade.createdAt), now));
        // All time
        const totalProfit = calculateTotalProfit(allTrades);
        const todayProfit = calculateTotalProfit(todayTrades);
        const weekProfit = calculateTotalProfit(weekTrades);
        const lastWeekProfit = calculateTotalProfit(lastWeekTrades);
        setProfitData([
          { title: 'Lợi nhuận hiện nay', amount: totalProfit.toFixed(2), isPositive: totalProfit >= 0 },
          { title: 'Lợi nhuận hôm nay', amount: todayProfit.toFixed(2), isPositive: todayProfit >= 0 },
          { title: 'Lợi nhuận tuần này', amount: weekProfit.toFixed(2), isPositive: weekProfit >= 0 },
          { title: 'Lợi nhuận tuần trước', amount: lastWeekProfit.toFixed(2), isPositive: lastWeekProfit >= 0 }
        ]);
      } catch (err) {
        // fallback to zero
        setProfitData([
          { title: 'Lợi nhuận hiện nay', amount: '0' },
          { title: 'Lợi nhuận hôm nay', amount: '0' },
          { title: 'Lợi nhuận tuần này', amount: '0' },
          { title: 'Lợi nhuận tuần trước', amount: '0' }
        ]);
      }
    };
    fetchAllTrades();
  }, []);

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