import BetterSqlite3 from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🧪 Testing SQLite database connection...\n');

try {
  const dbPath = path.join(__dirname, '..', 'parking.db');
  console.log('Database path:', dbPath);
  
  const db = new BetterSqlite3(dbPath);
  console.log('✅ Successfully opened database\n');
  
  // Test query
  const lots = db.prepare('SELECT * FROM parking_lots').all();
  console.log(`Found ${lots.length} parking lots:`);
  lots.forEach(lot => {
    console.log(`  - ${lot.name} (${lot.total_spots} spots)`);
  });
  
  console.log('\n✅ Database is working correctly!');
  console.log('The server should be able to connect.\n');
  
  db.close();
  
} catch (error) {
  console.error('❌ Database test failed:', error.message);
  console.error('\nTroubleshooting:');
  console.error('1. Make sure you ran: npm run init-db-sqlite');
  console.error('2. Check that parking.db exists in the backend folder');
  console.error('3. Try deleting parking.db and running init-db-sqlite again');
}
