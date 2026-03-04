import BetterSqlite3 from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🗺️  Adding sample polygon coordinates to parking lots...\n');

try {
  const dbPath = path.join(__dirname, '..', 'parking.db');
  const db = new BetterSqlite3(dbPath);
  
  // CSUF is approximately at: 33.8820° N, 117.8850° W
  // These are SAMPLE polygons - you'll want to replace with actual lot boundaries
  
  const polygons = {
    'Nutwood Structure': {
      lat: 33.8820,
      lng: -117.8850,
      polygon: [
        { lat: 33.8818, lng: -117.8855 },
        { lat: 33.8822, lng: -117.8855 },
        { lat: 33.8822, lng: -117.8845 },
        { lat: 33.8818, lng: -117.8845 }
      ]
    },
    'State College Structure': {
      lat: 33.8830,
      lng: -117.8870,
      polygon: [
        { lat: 33.8828, lng: -117.8875 },
        { lat: 33.8832, lng: -117.8875 },
        { lat: 33.8832, lng: -117.8865 },
        { lat: 33.8828, lng: -117.8865 }
      ]
    },
    'Eastside North': {
      lat: 33.8810,
      lng: -117.8820,
      polygon: [
        { lat: 33.8808, lng: -117.8825 },
        { lat: 33.8812, lng: -117.8825 },
        { lat: 33.8812, lng: -117.8815 },
        { lat: 33.8808, lng: -117.8815 }
      ]
    },
    'Eastside South': {
      lat: 33.8800,
      lng: -117.8820,
      polygon: [
        { lat: 33.8798, lng: -117.8825 },
        { lat: 33.8802, lng: -117.8825 },
        { lat: 33.8802, lng: -117.8815 },
        { lat: 33.8798, lng: -117.8815 }
      ]
    },
    'S8 and S10': {
      lat: 33.8840,
      lng: -117.8860,
      polygon: [
        { lat: 33.8838, lng: -117.8865 },
        { lat: 33.8842, lng: -117.8865 },
        { lat: 33.8842, lng: -117.8855 },
        { lat: 33.8838, lng: -117.8855 }
      ]
    },
    'Fullerton Free Church': {
      lat: 33.8850,
      lng: -117.8880,
      polygon: [
        { lat: 33.8848, lng: -117.8885 },
        { lat: 33.8852, lng: -117.8885 },
        { lat: 33.8852, lng: -117.8875 },
        { lat: 33.8848, lng: -117.8875 }
      ]
    }
  };
  
  for (const [name, data] of Object.entries(polygons)) {
    const update = db.prepare(`
      UPDATE parking_lots 
      SET 
        latitude = ?,
        longitude = ?,
        polygon_coordinates = ?
      WHERE name = ?
    `);
    
    update.run(
      data.lat,
      data.lng,
      JSON.stringify(data.polygon),
      name
    );
    
    console.log(`✅ Updated ${name}`);
  }
  
  db.close();
  
  console.log('\n✅ All parking lots updated with sample coordinates!');
  console.log('\n⚠️  NOTE: These are SAMPLE coordinates for testing.');
  console.log('For production, you should:');
  console.log('1. Go to https://studio.mapbox.com/');
  console.log('2. Create a dataset and draw actual lot boundaries');
  console.log('3. Export as GeoJSON and update the database');
  console.log('\nYou can now start the server and see the lots on the map!');
  
} catch (error) {
  console.error('❌ Failed to add coordinates:', error.message);
  process.exit(1);
}
