import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function initializeSQLite() {
  try {
    console.log('Initializing SQLite database');

    const dbPath = path.join(__dirname, '../parking.db');

    if (fs.existsSync(dbPath)) {
      console.log('Removing existing database');
      fs.unlinkSync(dbPath);
    }

    const db = new Database(dbPath);
    console.log('reated database at:', dbPath);

    const schemaPath = path.join(__dirname, '../database/schema-sqlite.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');

    console.log('Executing schema statements from schema-sqlite.sql');
    db.exec(schema);

    console.log('Database initialized successfully');
    console.log('');
    console.log('Verifying data');

    const lots = db.prepare('SELECT * FROM parking_lots').all();
    console.log(`Found ${lots.length} parking lots`);

    lots.forEach(lot => {
      console.log(`   - ${lot.name} (${lot.total_spots} spots)`);
    });

    db.close();
    console.log('');
    console.log('Setup complete');
    process.exit(0);
  } catch (error) {
    console.error('Database initialization failed:', error);
    process.exit(1);
  }
}

initializeSQLite();