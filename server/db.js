require('dotenv').config();
const mysql = require('mysql2/promise');

const isProduction = process.env.NODE_ENV === 'production';

const poolConfig = {
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  charset: 'utf8mb4',
  timezone: '+00:00'
};

// Aiven requires SSL
if (isProduction || process.env.DB_HOST.includes('aivencloud.com')) {
  poolConfig.ssl = {
    rejectUnauthorized: false
  };
}

const pool = mysql.createPool(poolConfig);

// Test connection
(async () => {
  try {
    const connection = await pool.getConnection();
    console.log(`✅ Aiven MySQL connected to: ${process.env.DB_HOST}`);
    await connection.query('SELECT 1');
    connection.release();
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
  }
})();

module.exports = pool;