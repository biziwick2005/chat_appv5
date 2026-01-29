require('dotenv').config();
const mysql = require('mysql2/promise');

console.log('🔌 Initializing database connection...');

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  ssl: process.env.NODE_ENV === 'production'
    ? { rejectUnauthorized: false }
    : false
});

(async () => {
  try {
    const conn = await pool.getConnection();
    await conn.query('SELECT 1');
    conn.release();
    console.log('✅ Database connected');
  } catch (err) {
    console.error('❌ Database connection failed');
    console.error(err.message);
    process.exit(1);
  }
})();

module.exports = pool;
