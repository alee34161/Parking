import BetterSqlite3 from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

try {
  const dbPath = path.join(__dirname, '..', 'parking.db');
  const db = new BetterSqlite3(dbPath);

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
    
    console.log(`Updated ${name}`);
  }
  
  db.close();
  
  console.log('Successfully added coordinates to database\n');
} catch (error) {
  console.error('Failed to add coordinates:', error.message);
  process.exit(1);
}
