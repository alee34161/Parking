import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database(path.join(__dirname, '../parking.db'));

const permitMappings = {
  'Nutwood Structure': ['Student Parking', 'Hourly Parking', 'Employee Parking'],
  'State College Structure': ['Student Parking', 'Hourly Parking', 'Employee Parking'],
  'Eastside North': ['Student Parking'],
  'Eastside South': ['Hourly Parking', 'Employee Parking', 'Student Parking'],
  'S8 and S10': ['Student Parking', 'Employee Parking', 'Resident Parking (non-freshmen)', 'Hourly Parking']
};

console.log('Updating permit types for all parking lots...\n');

for (const [lotName, permits] of Object.entries(permitMappings)) {
  const permitJson = JSON.stringify(permits);
  
  const result = db.prepare(`
    UPDATE parking_lots 
    SET permit_types = ? 
    WHERE name = ?
  `).run(permitJson, lotName);

  if (result.changes > 0) {
    console.log(`✅ Updated ${lotName}:`);
    console.log(`   Permits: ${permits.join(', ')}\n`);
  } else {
    console.log(`⚠️  Warning: Could not find lot "${lotName}"\n`);
  }
}

const lots = db.prepare('SELECT id, name, permit_types FROM parking_lots WHERE is_active = 1').all();

console.log('\n=== Current Permit Configuration ===\n');
lots.forEach(lot => {
  const permits = JSON.parse(lot.permit_types || '[]');
  console.log(`${lot.name}:`);
  if (permits.length === 0) {
    console.log('  No permits assigned');
  } else {
    permits.forEach(permit => console.log(`  - ${permit}`));
  }
  console.log('');
});

db.close();
console.log('✅ Permit types updated successfully!');
