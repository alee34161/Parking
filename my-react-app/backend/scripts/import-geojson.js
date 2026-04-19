import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import BetterSqlite3 from 'better-sqlite3';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🗺️  Importing GeoJSON coordinates from Mapbox...\n');

console.log('INSTRUCTIONS:');
console.log('1. Go to https://studio.mapbox.com/tilesets/');
console.log('2. Find your tileset');
console.log('3. Click on it, then click "Download" or export the original dataset');
console.log('4. Save the GeoJSON file as "parking-lots.geojson" in this scripts folder');
console.log('5. Run this script again\n');

const geojsonPath = path.join(__dirname, 'parking-lots.geojson');

if (!fs.existsSync(geojsonPath)) {
  console.error('File not found: parking-lots.geojson');
  console.log('\nPlease save your GeoJSON file as:');
  console.log(geojsonPath);
  console.log('\nOr provide the path as an argument:');
  console.log('node scripts/import-geojson.js path/to/your/file.geojson');
  process.exit(1);
}

try {
  console.log('Reading GeoJSON file');
  const geojsonData = JSON.parse(fs.readFileSync(geojsonPath, 'utf8'));

  if (!geojsonData.features || !Array.isArray(geojsonData.features)) {
    throw new Error('Invalid GeoJSON format features');
  }

  console.log(`Found ${geojsonData.features.length} features\n`);

  const dbPath = path.join(__dirname, '..', 'parking.db');
  const db = new BetterSqlite3(dbPath);

  console.log('Processing features\n');

  let updated = 0;
  let notFound = 0;
  let errors = 0;

  for (const feature of geojsonData.features) {
    try {
      const name = feature.properties?.name || feature.properties?.Name;

      if (!name) {
        console.warn('Skipping feature without name property');
        errors++;
        continue;
      }

      if (!feature.geometry || feature.geometry.type !== 'Polygon') {
        console.warn(`Skipping ${name} since not a polygon`);
        errors++;
        continue;
      }

      const coordinates = feature.geometry.coordinates[0];

      const polygonCoords = coordinates.map(coord => ({
        lat: coord[1],
        lng: coord[0]
      }));

      const centerLat = polygonCoords.reduce((sum, c) => sum + c.lat, 0) / polygonCoords.length;
      const centerLng = polygonCoords.reduce((sum, c) => sum + c.lng, 0) / polygonCoords.length;

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
        console.log(`Updated: ${name}`);
        console.log(`Center: ${centerLat.toFixed(6)}, ${centerLng.toFixed(6)}`);
        console.log(`Points: ${polygonCoords.length}`);
        updated++;
      } else {
        console.log(`Not found in database: ${name}`);
        console.log('Available lot names in database:');
        const lots = db.prepare('SELECT name FROM parking_lots').all();
        lots.forEach(lot => console.log(`   - ${lot.name}`));
        notFound++;
      }


      console.log('');

    } catch (error) {
      console.error(`Error processing feature:`, error.message);
      errors++;
    }
  }

  db.close();

  if (updated > 0) {
    console.log('Successfully added coordinates to lots');
  }

} catch (error) {
  console.error('Failed to import GeoJSON:', error.message);
  console.error('\nFull error:', error);
  process.exit(1);
}