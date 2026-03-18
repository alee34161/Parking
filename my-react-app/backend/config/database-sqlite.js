import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create database file in backend directory
const dbPath = path.join(__dirname, '..', 'parking.db');
const db = new Database(dbPath, { verbose: console.log });


// Enable foreign keys
db.pragma('foreign_keys = ON');

// Helper function to execute queries (mimics MySQL2 interface)
export async function query(sql, params = []) {
  try {
    // Normalize SQL for SQLite
    sql = sql.replace(/\?/g, '?'); // SQLite uses ? for parameters
    
    if (sql.trim().toUpperCase().startsWith('SELECT') || 
        sql.trim().toUpperCase().startsWith('SHOW')) {
      // Return array of objects like MySQL
      return db.prepare(sql).all(...params);
    } else if (sql.trim().toUpperCase().startsWith('INSERT')) {
      const result = db.prepare(sql).run(...params);
      return [{ insertId: result.lastInsertRowid, affectedRows: result.changes }];
    } else {
      const result = db.prepare(sql).run(...params);
      return [{ affectedRows: result.changes }];
    }
  } catch (error) {
    console.error('Database query error:', error);
    console.error('SQL:', sql);
    console.error('Params:', params);
    throw error;
  }
}

// Helper function for transactions
export async function transaction(callback) {
  const trans = db.transaction(() => {
    return callback(db);
  });
  return trans();
}

export default db;
