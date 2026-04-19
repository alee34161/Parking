import dotenv from 'dotenv';
dotenv.config();

// Check if using SQLite or MySQL
const USE_SQLITE = process.env.USE_SQLITE === 'true' || !process.env.DB_HOST;

let query, transaction, db;

if (USE_SQLITE) {
  try {
    const dbModule = await import('./database-sqlite.js');
    query = dbModule.query;
    transaction = dbModule.transaction;
    db = dbModule.default;
  } catch (error) {
    console.error('Error loading SQLite: ', error.message);
    process.exit(1);
  }
} else {
  try {
    const dbModule = await import('./database-mysql.js');
    query = dbModule.query;
    transaction = dbModule.transaction;
    db = dbModule.default;
  } catch (error) {
    console.error('Error loading MySQL/Aurora: ', error.message);
    process.exit(1);
  }
}

export { query, transaction };
export default db;
