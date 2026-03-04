import axios from 'axios';
import * as cheerio from 'cheerio';

const PARKING_URL = 'https://parking.fullerton.edu/parkinglotcounts/mobile.aspx';

console.log('🔍 Debugging HTML parsing...\n');

async function debugParser() {
  try {
    // Fetch the page
    console.log('📥 Fetching page...');
    const response = await axios.get(PARKING_URL, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; ParkingMonitor/1.0)',
      }
    });

    const html = response.data;
    const $ = cheerio.load(html);
    
    console.log('✅ Page fetched successfully\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    // Find all table rows
    let rowCount = 0;
    $('table tr').each((index, element) => {
      const $row = $(element);
      const cells = $row.find('td');
      
      if (cells.length >= 2) {
        rowCount++;
        console.log(`ROW ${rowCount}:`);
        console.log('─────────────────────────────────────────');
        
        const firstCell = $(cells[0]).text();
        const secondCell = $(cells[1]).text();
        
        console.log('FIRST CELL (raw):');
        console.log(JSON.stringify(firstCell));
        console.log('\nFIRST CELL (clean):');
        console.log(firstCell);
        console.log('\nSECOND CELL (raw):');
        console.log(JSON.stringify(secondCell));
        console.log('\nSECOND CELL (clean):');
        console.log(secondCell);
        
        // Test regex patterns
        console.log('\n🧪 TESTING REGEX PATTERNS:');
        
        // Name pattern
        const nameMatch = firstCell.match(/^([^\n]+)/);
        console.log('Name match:', nameMatch ? nameMatch[1].trim() : 'NO MATCH');
        
        // Total spots pattern
        const totalSpotsMatch = firstCell.match(/Total Spots\s+(\d+)/);
        console.log('Total spots match:', totalSpotsMatch ? totalSpotsMatch[1] : 'NO MATCH');
        
        // Date pattern
        const dateMatch = firstCell.match(/(\d{1,2}\/\d{1,2}\/\d{4}\s+\d{1,2}:\d{2}:\d{2}\s+[AP]M)/);
        console.log('Date match:', dateMatch ? dateMatch[1] : 'NO MATCH');
        
        // Available spots pattern
        const availableMatch = secondCell.match(/(\d+)/);
        console.log('Available spots match:', availableMatch ? availableMatch[1] : 'NO MATCH');
        
        // Check for "Closed"
        const isClosed = secondCell.toLowerCase().includes('closed');
        console.log('Is closed:', isClosed);
        
        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      }
    });
    
    if (rowCount === 0) {
      console.log('❌ NO TABLE ROWS FOUND!');
      console.log('\nHTML structure might have changed.');
      console.log('Saving full HTML to debug.html for inspection...');
      
      const fs = await import('fs');
      fs.writeFileSync('debug.html', html);
      console.log('✅ Saved to debug.html - open this file to see the actual structure');
    } else {
      console.log(`✅ Found ${rowCount} table rows`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Status Text:', error.response.statusText);
    }
  }
}

debugParser();
