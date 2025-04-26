-- Create experts table
CREATE TABLE IF NOT EXISTS experts (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL,
    win_rate DECIMAL(5,2) DEFAULT 0,
    capital_management VARCHAR(255),
    sl_tp VARCHAR(255),
    status ENUM('ACTIVE', 'INACTIVE') DEFAULT 'ACTIVE',
    last_trade_type ENUM('long', 'short'),
    last_trade_time TIMESTAMP,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Create copy_expert_orders table
CREATE TABLE IF NOT EXISTS copy_expert_orders (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id VARCHAR(255) NOT NULL,
    expert_id INT,
    order_code VARCHAR(255) NOT NULL UNIQUE,
    type ENUM('long', 'short') NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    received_usdt DECIMAL(15,2) DEFAULT 0,
    session VARCHAR(255),
    symbol VARCHAR(50) DEFAULT 'BTCUSDT',
    status ENUM('PENDING', 'WIN', 'LOSS') DEFAULT 'PENDING',
    bot VARCHAR(255),
    open_price DECIMAL(15,2),
    close_price DECIMAL(15,2),
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (expert_id) REFERENCES experts(id),
    INDEX idx_user_id (user_id),
    INDEX idx_order_code (order_code),
    INDEX idx_status (status)
);

-- Insert some sample expert data
INSERT INTO experts (name, win_rate, capital_management, sl_tp, status) VALUES
('John Smith', 85.50, '1-2-4-8', '30/60', 'ACTIVE'),
('Sarah Wilson', 78.20, '1-3-9', '25/50', 'ACTIVE'),
('Michael Chen', 82.30, '1-2-3', '35/70', 'ACTIVE'); 