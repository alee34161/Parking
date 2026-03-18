import axios from 'axios';
import * as cheerio from 'cheerio';

console.log('🔍 Testing announcement scraping from parking.fullerton.edu\n');

async function testAnnouncementScraping() {
  try {
    // Fetch the homepage
    console.log('📥 Fetching https://parking.fullerton.edu/ ...');
    const response = await axios.get('https://parking.fullerton.edu/', {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; ParkingMonitor/1.0)',
      }
    });

    const html = response.data;
    const $ = cheerio.load(html);
    
    console.log('✅ Page fetched successfully\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Try different selectors
    const selectors = [
      { name: '.alert', selector: '.alert' },
      { name: '.announcement', selector: '.announcement' },
      { name: '.notice', selector: '.notice' },
      { name: '#announcement', selector: '#announcement' },
      { name: '.hero-text', selector: '.hero-text' },
      { name: 'first main p', selector: 'main p' },
      { name: 'all paragraphs', selector: 'p' }
    ];

    for (const { name, selector } of selectors) {
      const elements = $(selector);
      if (elements.length > 0) {
        console.log(`\n📌 Found ${elements.length} elements with selector: ${name}`);
        console.log('─────────────────────────────────────────');
        
        elements.slice(0, 3).each((i, elem) => {
          const text = $(elem).text().trim();
          if (text.length > 20) {
            console.log(`\nElement ${i + 1}:`);
            console.log(text.substring(0, 200));
            if (text.length > 200) console.log('...');
          }
        });
      }
    }

    console.log('\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔍 Looking for permit-related text...\n');

    // Look for text containing "permit"
    const allText = [];
    $('p, div, span').each((i, elem) => {
      const text = $(elem).text().trim();
      if (text.length > 50 && text.length < 1000 && 
          (text.toLowerCase().includes('permit') || 
           text.toLowerCase().includes('effective'))) {
        allText.push(text);
      }
    });

    // Deduplicate
    const uniqueText = [...new Set(allText)];
    
    console.log(`Found ${uniqueText.length} unique text blocks mentioning permits:\n`);
    
    uniqueText.forEach((text, i) => {
      console.log(`\n${i + 1}. ${text.substring(0, 300)}`);
      if (text.length > 300) console.log('...');
    });

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Save HTML for manual inspection
    const fs = await import('fs');
    fs.writeFileSync('parking-homepage.html', html);
    console.log('✅ Saved full HTML to parking-homepage.html for inspection\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testAnnouncementScraping();
