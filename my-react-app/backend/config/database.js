import dotenv from 'dotenv';
dotenv.config();

// Check if using SQLite or MySQL
const USE_SQLITE = process.env.USE_SQLITE === 'true' || !process.env.DB_HOST;

let query, transaction, db;

if (USE_SQLITE) {
  console.log('📦 Using SQLite database');
  try {
    // Import SQLite configuration dynamically
    const dbModule = await import('./database-sqlite.js');
    query = dbModule.query;
    transaction = dbModule.transaction;
    db = dbModule.default;
  } catch (error) {
    console.error('❌ Failed to load SQLite database module:', error.message);
    console.error('Make sure better-sqlite3 is installed: npm install better-sqlite3');
    console.error('And that parking.db exists: npm run init-db-sqlite');
    process.exit(1);
  }
} else {
  console.log('☁️  Using MySQL/Aurora database');
  try {
    // Import MySQL configuration dynamically
    const dbModule = await import('./database-mysql.js');
    query = dbModule.query;
    transaction = dbModule.transaction;
    db = dbModule.default;
  } catch (error) {
    console.error('❌ Failed to load MySQL database module:', error.message);
    console.error('Check your .env file has correct DB_HOST, DB_USER, DB_PASSWORD');
    process.exit(1);
  }
}

// Re-export the functions and default export
export { query, transaction };
export default db;
