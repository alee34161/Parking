import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

// AWS Aurora MySQL connection pool
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  // SSL/TLS for secure connection to Aurora
  ssl: process.env.DB_SSL === 'false' ? false : {
    rejectUnauthorized: true
  }
});

// Test database connection (async - won't block import)
(async () => {
  try {
    const connection = await pool.getConnection();
    console.log('✅ Successfully connected to MySQL/Aurora database');
    connection.release();
  } catch (err) {
    console.error('❌ MySQL/Aurora connection failed:', err.message);
    console.error('Make sure your .env has correct DB_HOST, DB_USER, DB_PASSWORD, DB_NAME');
  }
})();

// Helper function to execute queries safely
export async function query(sql, params = []) {
  try {
    const [results] = await pool.execute(sql, params);
    return results;
  } catch (error) {
    console.error('Database query error:', error);
    throw error;
  }
}

// Helper function for transactions
export async function transaction(callback) {
  const connection = await pool.getConnection();
  await connection.beginTransaction();
  
  try {
    const result = await callback(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export default pool;
