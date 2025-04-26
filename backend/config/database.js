const mysql = require('mysql2/promise');
const logger = require('../utils/logger');

const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'coincex',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Test the connection
pool.getConnection()
    .then(connection => {
        logger.info('Database connection established successfully');
        connection.release();
    })
    .catch(err => {
        logger.error('Error connecting to the database:', err);
    });

module.exports = pool; 