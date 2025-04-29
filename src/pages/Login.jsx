import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import tradingImage from '../assets/login-background.png';
import tradingImageLeft from '../assets/login-background-left.png';
import tradingImageRight from '../assets/login-background-right.png';
import telegramIcon from '../assets/telegram-icon.png';
import logo from '../assets/logo.png';
const API_URL = process.env.REACT_APP_API_URL;
const API_URL2 = process.env.REACT_APP_API_URL2;
const Login = () => {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const message = searchParams.get('message');
    if (message === 'pending') {
      setError('Your account is pending approval. Please wait for administrator approval to access the dashboard.');
    }
  }, [location]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await axios.post(`${API_URL2}/proxy/login`, {
        username: phoneNumber,
        password: password,
        auth_type: 'phone'
      });
      
      if (response.data.error === 0) {
        // If login successful, save user data to our backend
        console.log(response.data.data.user);
        const saveResponse = await axios.post(`${API_URL}/save-user`, {
          user: response.data.data.user,
          accessToken: response.data.data.accessToken
        });

        if (saveResponse.data.success) {
          localStorage.setItem('userId', response.data.data.user.user_id);
          localStorage.setItem('token', response.data.data.accessToken);
          navigate('/statistics');
        } else {
          setError('Failed to save user information');
        }
      } else {
        setError(response.data.message || 'Login failed');
      }
    } catch (error) {
      console.error('Login error:', error);
      setError(error.response?.data?.message || 'An error occurred during login');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="fixed top-8 left-8 z-50">
        <img src={logo} alt="Coincex Logo" className="w-[180px] h-auto" />
      </div>
      
      <div className="min-h-screen bg-[#0B1221] flex items-center justify-center p-4">
        <div className="w-full max-w-[1200px] grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
          <div className="hidden md:block relative pl-[150px] mx-auto">
            <img
              src={tradingImage}
              alt="Trading Interface"
              className="max-w-full w-auto h-auto"
            />
            <img
              src={tradingImageLeft}
              alt="Trading Interface Left"
              className="absolute left-[155px] top-1/3 -translate-y-1/2 w-[100px] z-1 lg:w-[120px]"
            />
            <img
              src={tradingImageRight}
              alt="Trading Interface Right"
              className="absolute -right-[-20px] -bottom-[-120px] w-[160px] lg:w-[180px]"
            />
          </div>

          <div className="bg-white rounded-[20px] p-4 sm:p-6 md:p-8 w-full max-w-[560px] mx-auto">
            <div className="mb-4 sm:mb-6">
              <h1 className="text-[22px] sm:text-[28px] font-bold">
                BOT COPY TRADE <span className="text-[#00D88A]">COINCEX</span>
              </h1>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500 rounded-lg">
                <p className="text-red-500 text-sm">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
              <div>
                <input
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="Số điện thoại"
                  className="w-full h-[45px] sm:h-[52px] px-3 sm:px-4 rounded-[10px] bg-[#F5F5F5] border-none focus:ring-2 focus:ring-[#00D88A] outline-none text-[14px] sm:text-[15px]"
                  disabled={loading}
                  required
                />
              </div>

              <div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mật khẩu"
                  className="w-full h-[45px] sm:h-[52px] px-3 sm:px-4 rounded-[10px] bg-[#F5F5F5] border-none focus:ring-2 focus:ring-[#00D88A] outline-none text-[14px] sm:text-[15px]"
                  disabled={loading}
                  required
                />
              </div>

              <button
                type="submit"
                className={`w-full h-[45px] sm:h-[52px] bg-[#00D88A] text-white rounded-[10px] font-medium transition-colors text-[14px] sm:text-[15px] ${
                  loading ? 'opacity-70 cursor-not-allowed' : 'hover:bg-opacity-90'
                }`}
                disabled={loading}
              >
                {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
              </button>
            </form>

            <div className="mt-4 sm:mt-6 flex flex-col sm:flex-row justify-between text-[13px] sm:text-[15px] text-[#64748B] gap-4 sm:gap-0">
              <div className="flex flex-col items-start gap-2">
                <span className="font-bold">Tham gia cộng đồng tại đây ?</span>
                <div className="flex items-center gap-2">
                  <img src={telegramIcon} alt="Telegram" className="w-[15px]" />
                  <a href="https://t.me/bitluxuryy" target="_blank" rel="noopener noreferrer" className="text-[#229ED9] hover:underline">Telegram</a>
                </div>
              </div>
              <div className="flex gap-2 items-start">
                <span className="font-bold">Đăng ký tài khoản ?</span>
                <a href="https://t.me/mrsbit96" target="_blank" rel="noopener noreferrer" className="text-[#00D88A] hover:underline font-medium">
                  Tại đây
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login; 