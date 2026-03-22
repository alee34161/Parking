import BetterSqlite3 from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

try {
  const dbPath = path.join(__dirname, '..', 'parking.db');
  const db = new BetterSqlite3(dbPath);
  
  console.log('Lots:');
  const lots = db.prepare('SELECT * FROM parking_lots ORDER BY id').all();
  console.table(lots.map(lot => ({
    id: lot.id,
    name: lot.name,
    total_spots: lot.total_spots,
    has_coords: lot.polygon_coordinates ? 'Yes' : 'No'
  })));
  
  console.log('Snapshots:');
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
  
  console.log('Latest entry:');
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
    console.log('No data found');
  } else {
    console.table(latest);
  }
  
  const lotsWithoutData = db.prepare(`
    SELECT pl.name
    FROM parking_lots pl
    LEFT JOIN parking_snapshots ps ON pl.id = ps.parking_lot_id
    WHERE ps.id IS NULL
  `).all();
  
  if (lotsWithoutData.length > 0) {
    console.log('Empty Lots:');
    lotsWithoutData.forEach(lot => console.log('  -', lot.name));
  }
  
  console.log('Last scrape:');
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
  }
  
  db.close();

} catch (error) {
  console.error('Error:', error.message);
  process.exit(1);
}
