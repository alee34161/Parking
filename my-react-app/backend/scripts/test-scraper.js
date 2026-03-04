import { scrapeParkingData, saveParkingData } from '../services/scraper.js';

console.log('🧪 Testing scraper manually...\n');

async function testScraper() {
  try {
    // Step 1: Scrape data
    console.log('Step 1: Scraping parking website...');
    const parkingData = await scrapeParkingData();
    
    console.log('\n📊 Scraped Data:');
    console.log(JSON.stringify(parkingData, null, 2));
    
    console.log(`\n✅ Successfully scraped ${parkingData.length} lots\n`);
    
    // Step 2: Save to database
    console.log('Step 2: Saving to database...');
    await saveParkingData(parkingData);
    console.log('✅ Data saved to database\n');
    
    // Step 3: Verify in database
    console.log('Step 3: Verifying data in database...');
    const { query } = await import('../config/database.js');
    
    const snapshots = await query(`
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
    `);
    
    console.log('📊 Data in database:');
    console.table(snapshots);
    
    console.log('\n✅ Test complete!');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    console.error('\nFull error:', error.stack);
    process.exit(1);
  }
}

testScraper();
