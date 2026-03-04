import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import BetterSqlite3 from 'better-sqlite3';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🗺️  Importing GeoJSON coordinates from Mapbox...\n');

// Instructions for getting the GeoJSON file
console.log('📋 INSTRUCTIONS:');
console.log('1. Go to https://studio.mapbox.com/tilesets/');
console.log('2. Find your tileset: aslee.cmlk5iyo00j9k1ometjvetkko-9edsw');
console.log('3. Click on it, then click "Download" or export the original dataset');
console.log('4. Save the GeoJSON file as "parking-lots.geojson" in this scripts folder');
console.log('5. Run this script again\n');

const geojsonPath = path.join(__dirname, 'parking-lots.geojson');

if (!fs.existsSync(geojsonPath)) {
  console.error('❌ File not found: parking-lots.geojson');
  console.log('\nPlease save your GeoJSON file as:');
  console.log(geojsonPath);
  console.log('\nOr provide the path as an argument:');
  console.log('node scripts/import-geojson.js path/to/your/file.geojson');
  process.exit(1);
}

try {
  // Read GeoJSON file
  console.log('📖 Reading GeoJSON file...');
  const geojsonData = JSON.parse(fs.readFileSync(geojsonPath, 'utf8'));
  
  if (!geojsonData.features || !Array.isArray(geojsonData.features)) {
    throw new Error('Invalid GeoJSON format - missing features array');
  }
  
  console.log(`✅ Found ${geojsonData.features.length} features\n`);
  
  // Connect to database
  const dbPath = path.join(__dirname, '..', 'parking.db');
  const db = new BetterSqlite3(dbPath);
  
  console.log('📊 Processing features...\n');
  
  let updated = 0;
  let notFound = 0;
  let errors = 0;
  
  for (const feature of geojsonData.features) {
    try {
      // Get the name from properties
      const name = feature.properties?.name || feature.properties?.Name;
      
      if (!name) {
        console.warn('⚠️  Skipping feature without name property');
        errors++;
        continue;
      }
      
      // Get geometry
      if (!feature.geometry || feature.geometry.type !== 'Polygon') {
        console.warn(`⚠️  Skipping ${name} - not a polygon`);
        errors++;
        continue;
      }
      
      // Extract coordinates
      // GeoJSON format: [[[lng, lat], [lng, lat], ...]]
      const coordinates = feature.geometry.coordinates[0];
      
      // Convert to our format: [{"lat": ..., "lng": ...}, ...]
      const polygonCoords = coordinates.map(coord => ({
        lat: coord[1],
        lng: coord[0]
      }));
      
      // Calculate center point (average of all coordinates)
      const centerLat = polygonCoords.reduce((sum, c) => sum + c.lat, 0) / polygonCoords.length;
      const centerLng = polygonCoords.reduce((sum, c) => sum + c.lng, 0) / polygonCoords.length;
      
      // Update database
      const result = db.prepare(`
        UPDATE parking_lots 
        SET 
          latitude = ?,
          longitude = ?,
          polygon_coordinates = ?
        WHERE name = ?
      `).run(
        centerLat,
        centerLng,
        JSON.stringify(polygonCoords),
        name
      );
      
      if (result.changes > 0) {
        console.log(`✅ Updated: ${name}`);
        console.log(`   Center: ${centerLat.toFixed(6)}, ${centerLng.toFixed(6)}`);
        console.log(`   Points: ${polygonCoords.length}`);
        updated++;
      } else {
        console.log(`⚠️  Not found in database: ${name}`);
        console.log('   Available lot names in database:');
        const lots = db.prepare('SELECT name FROM parking_lots').all();
        lots.forEach(lot => console.log(`   - ${lot.name}`));
        notFound++;
      }
      
      console.log('');
      
    } catch (error) {
      console.error(`❌ Error processing feature:`, error.message);
      errors++;
    }
  }
  
  db.close();
  
  // Summary
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 Import Summary:');
  console.log(`   ✅ Updated: ${updated} parking lots`);
  console.log(`   ⚠️  Not found: ${notFound} lots`);
  console.log(`   ❌ Errors: ${errors}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  if (notFound > 0) {
    console.log('💡 TIP: Make sure the "name" property in your GeoJSON');
    console.log('   exactly matches the parking lot names in the database:');
    console.log('   - Nutwood Structure');
    console.log('   - State College Structure');
    console.log('   - Eastside North');
    console.log('   - Eastside South');
    console.log('   - S8 and S10');
    console.log('   - Fullerton Free Church\n');
  }
  
  if (updated > 0) {
    console.log('🎉 Success! Your parking lots now have real coordinates!');
    console.log('   Restart your server to see the changes:\n');
    console.log('   npm run dev\n');
  }
  
} catch (error) {
  console.error('❌ Failed to import GeoJSON:', error.message);
  console.error('\nFull error:', error);
  process.exit(1);
}
