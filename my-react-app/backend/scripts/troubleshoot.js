import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🔍 Troubleshooting Backend Setup...\n');

// Check .env file
const envPath = path.join(__dirname, '..', '.env');
console.log('1. Checking .env file...');
if (fs.existsSync(envPath)) {
  console.log('   ✅ .env file exists');
  dotenv.config();
  
  const requiredVars = ['FRONTEND_URL', 'ADMIN_API_KEY'];
  const missingVars = requiredVars.filter(v => !process.env[v]);
  
  if (missingVars.length > 0) {
    console.log('   ⚠️  Missing environment variables:', missingVars.join(', '));
  } else {
    console.log('   ✅ All required environment variables present');
  }
  
  console.log('   USE_SQLITE:', process.env.USE_SQLITE || 'not set (will default to SQLite)');
  
  if (process.env.USE_SQLITE === 'true' || !process.env.DB_HOST) {
    console.log('   📦 Configured for SQLite');
  } else {
    console.log('   ☁️  Configured for MySQL/Aurora');
    console.log('   DB_HOST:', process.env.DB_HOST || 'NOT SET');
  }
} else {
  console.log('   ❌ .env file NOT FOUND!');
  console.log('   👉 Run: cp env.example .env');
  process.exit(1);
}

// Check database file (if SQLite)
if (process.env.USE_SQLITE === 'true' || !process.env.DB_HOST) {
  console.log('\n2. Checking SQLite database...');
  const dbPath = path.join(__dirname, '..', 'parking.db');
  
  if (fs.existsSync(dbPath)) {
    console.log('   ✅ parking.db exists');
    const stats = fs.statSync(dbPath);
    console.log('   Size:', (stats.size / 1024).toFixed(2), 'KB');
    
    // Try to open and query
    try {
      const Database = (await import('better-sqlite3')).default;
      const db = new Database(dbPath);
      
      const lots = db.prepare('SELECT COUNT(*) as count FROM parking_lots').get();
      console.log('   ✅ Database accessible');
      console.log('   Parking lots:', lots.count);
      
      const snapshots = db.prepare('SELECT COUNT(*) as count FROM parking_snapshots').get();
      console.log('   Snapshots:', snapshots.count);
      
      db.close();
    } catch (error) {
      console.log('   ⚠️  Database exists but error reading:', error.message);
    }
  } else {
    console.log('   ❌ parking.db NOT FOUND!');
    console.log('   👉 Run: npm run init-db-sqlite');
    process.exit(1);
  }
}

// Check node_modules
console.log('\n3. Checking dependencies...');
const nodeModulesPath = path.join(__dirname, '..', 'node_modules');
if (fs.existsSync(nodeModulesPath)) {
  console.log('   ✅ node_modules exists');
  
  const requiredPackages = ['express', 'better-sqlite3', 'axios', 'cheerio'];
  for (const pkg of requiredPackages) {
    const pkgPath = path.join(nodeModulesPath, pkg);
    if (fs.existsSync(pkgPath)) {
      console.log('   ✅', pkg);
    } else {
      console.log('   ❌', pkg, 'NOT INSTALLED');
    }
  }
} else {
  console.log('   ❌ node_modules NOT FOUND!');
  console.log('   👉 Run: npm install');
  process.exit(1);
}

console.log('\n✅ Basic setup looks good!');
console.log('\n📋 Next steps:');
console.log('   1. Make sure you ran: npm run init-db-sqlite');
console.log('   2. Start the server: npm run dev');
console.log('   3. Check the frontend .env has VITE_MAPBOX_TOKEN');
