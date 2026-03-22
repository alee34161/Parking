import { scrapeAndSave } from '../services/scraper.js';
import { predictAllLots } from '../services/prediction.js';

console.log('Running manual scrape and prediction test...\n');

async function test() {
  console.log('1. Scraping current parking data...');
  const scrapeResult = await scrapeAndSave();
  console.log(`   ✅ Scraped ${scrapeResult.lotsScraped} lots\n`);

  console.log('2. Getting predictions for all lots...');
  const predictions = await predictAllLots();
  
  console.log('\n=== PREDICTIONS ===\n');
  predictions.forEach(pred => {
    console.log(`${pred.lot_name}:`);
    if (pred.predicted_occupancy !== null) {
      console.log(`  Predicted Occupancy: ${pred.predicted_occupancy}%`);
      console.log(`  Expected Available: ${pred.predicted_available} spots`);
      console.log(`  Confidence: ${pred.confidence} (${pred.confidence_percent}%)`);
      console.log(`  Data Points: ${pred.data_points}`);
    } else {
      console.log(`  ${pred.message || 'No prediction available'}`);
    }
    console.log('');
  });

  console.log('✅ Test complete! Predictions should now show in the frontend.');
  process.exit(0);
}

test().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
