import BetterSqlite3 from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🔍 Checking database state...\n');

try {
  const dbPath = path.join(__dirname, '..', 'parking.db');
  const db = new BetterSqlite3(dbPath);
  
  // Check parking lots
  console.log('1️⃣ PARKING LOTS:');
  const lots = db.prepare('SELECT * FROM parking_lots ORDER BY id').all();
  console.table(lots.map(lot => ({
    id: lot.id,
    name: lot.name,
    total_spots: lot.total_spots,
    has_coords: lot.polygon_coordinates ? 'Yes' : 'No'
  })));
  
  // Check snapshots count
  console.log('\n2️⃣ SNAPSHOT COUNTS:');
  const snapshotCounts = db.prepare(`
    SELECT 
      pl.name,
      COUNT(ps.id) as snapshot_count,
      MAX(ps.scraped_at) as last_scrape
    FROM parking_lots pl
    LEFT JOIN parking_snapshots ps ON pl.id = ps.parking_lot_id
    GROUP BY pl.id, pl.name
    ORDER BY pl.name
  `).all();
  console.table(snapshotCounts);
  
  // Check latest data
  console.log('\n3️⃣ LATEST AVAILABILITY DATA:');
  const latest = db.prepare(`
    SELECT 
      pl.name,
      ps.available_spots,
      ps.total_spots,
      ps.occupancy_percentage,
      ps.status,
      ps.scraped_at
    FROM parking_lots pl
    LEFT JOIN parking_snapshots ps ON pl.id = ps.parking_lot_id
    WHERE ps.id = (
      SELECT id 
      FROM parking_snapshots 
      WHERE parking_lot_id = pl.id 
      ORDER BY scraped_at DESC 
      LIMIT 1
    )
    ORDER BY pl.name
  `).all();
  
  if (latest.length === 0) {
    console.log('❌ NO DATA FOUND!');
    console.log('\nPossible causes:');
    console.log('1. Scraper has never run successfully');
    console.log('2. Data was scraped but not saved to database');
    console.log('3. Database connection issue during scraping');
    console.log('\nTry running: npm run test-scraper');
  } else {
    console.table(latest);
  }
  
  // Check if all lots have snapshots
  console.log('\n4️⃣ LOTS WITHOUT DATA:');
  const lotsWithoutData = db.prepare(`
    SELECT pl.name
    FROM parking_lots pl
    LEFT JOIN parking_snapshots ps ON pl.id = ps.parking_lot_id
    WHERE ps.id IS NULL
  `).all();
  
  if (lotsWithoutData.length > 0) {
    console.log('❌ These lots have NO data:');
    lotsWithoutData.forEach(lot => console.log('  -', lot.name));
  } else {
    console.log('✅ All lots have data!');
  }
  
  // Check most recent snapshot
  console.log('\n5️⃣ MOST RECENT SCRAPE:');
  const mostRecent = db.prepare(`
    SELECT 
      scraped_at,
      COUNT(*) as lots_scraped
    FROM parking_snapshots
    WHERE scraped_at = (SELECT MAX(scraped_at) FROM parking_snapshots)
    GROUP BY scraped_at
  `).all();
  
  if (mostRecent.length > 0) {
    console.log(`Last scrape: ${mostRecent[0].scraped_at}`);
    console.log(`Lots scraped: ${mostRecent[0].lots_scraped}`);
    
    const now = new Date();
    const lastScrape = new Date(mostRecent[0].scraped_at);
    const minutesAgo = Math.round((now - lastScrape) / 60000);
    console.log(`Time since: ${minutesAgo} minutes ago`);
  } else {
    console.log('❌ No scrapes found!');
  }
  
  db.close();
  
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('💡 NEXT STEPS:');
  console.log('');
  console.log('If no data exists:');
  console.log('  → Run: npm run test-scraper');
  console.log('');
  console.log('If data is old (>10 minutes):');
  console.log('  → Check if server is running: npm run dev');
  console.log('  → Check server logs for scraping errors');
  console.log('');
  console.log('If data exists but frontend shows 0:');
  console.log('  → Check browser console (F12) for errors');
  console.log('  → Check network tab for API call failures');
  console.log('  → Verify VITE_API_URL in frontend/.env');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}
