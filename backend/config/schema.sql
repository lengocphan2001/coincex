CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  phone_number VARCHAR(255),
  nik_name VARCHAR(255),
  usdt DECIMAL(20,8),
  vndc DECIMAL(20,8),
  invite VARCHAR(255),
  ref_code VARCHAR(255),
  wallet_crypto VARCHAR(255),
  address_usdt VARCHAR(255),
  vip INT,
  level INT,
  access_token VARCHAR(255),
  is_active BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  active_unlimitted TINYINT(1),
  UNIQUE KEY unique_user_id (user_id)
);

CREATE TABLE IF NOT EXISTS admins (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(255) NOT NULL,
  password VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  role ENUM('admin', 'super_admin') NOT NULL DEFAULT 'admin',
  is_active BOOLEAN DEFAULT TRUE,
  last_login TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_username (username),
  UNIQUE KEY unique_email (email)
);

CREATE TABLE IF NOT EXISTS admin_sessions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  admin_id INT NOT NULL,
  token VARCHAR(255) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE CASCADE
);

-- Create strategies table
CREATE TABLE IF NOT EXISTS strategies (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL,
  user_id VARCHAR(255) NOT NULL,
  follow_candle VARCHAR(255) NOT NULL,
  capital_management VARCHAR(255) NOT NULL,
  sl_tp VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS copy_ai_orders (
  id INT PRIMARY KEY AUTO_INCREMENT,
  order_code VARCHAR(255) UNIQUE NOT NULL,
  type VARCHAR(50) NOT NULL,
  amount FLOAT NOT NULL,
  received_usdt FLOAT DEFAULT 0,
  session BIGINT,
  open FLOAT,
  close FLOAT,
  symbol VARCHAR(50) NOT NULL,
  status VARCHAR(50) DEFAULT 'PENDING',
  bot VARCHAR(255) NOT NULL,
  user_id VARCHAR(255) NOT NULL,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);


-- Create copy_expert_orders table
CREATE TABLE IF NOT EXISTS copy_expert_orders (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id VARCHAR(255) NOT NULL,
    order_code VARCHAR(255) NOT NULL UNIQUE,
    type ENUM('long', 'short') NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    received_usdt DECIMAL(15,2) DEFAULT 0,
    session VARCHAR(255),
    symbol VARCHAR(50) DEFAULT 'BTCUSDT',
    status VARCHAR(50) DEFAULT 'PENDING',
    bot VARCHAR(255),
    open_price DECIMAL(15,2),
    close_price DECIMAL(15,2),
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_user_id (user_id),
    INDEX idx_order_code (order_code),
    INDEX idx_status (status)
);
