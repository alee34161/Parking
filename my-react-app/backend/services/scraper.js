import axios from 'axios';
import * as cheerio from 'cheerio';
import { query } from '../config/database.js';

const PARKING_URL = 'https://parking.fullerton.edu/parkinglotcounts/mobile.aspx';

// Scrape parking data from the website
export async function scrapeParkingData() {
  try {
    console.log('🔍 Starting parking data scrape...');
    
    // Fetch the page with timeout and user agent
    const response = await axios.get(PARKING_URL, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; ParkingMonitor/1.0)',
      }
    });

    const html = response.data;
    const $ = cheerio.load(html);
    const parkingData = [];
    const timestamp = new Date();

    console.log('📄 Page fetched, parsing table...');

    // Parse the table rows
    $('table tr').each((index, element) => {
      const $row = $(element);
      const cells = $row.find('td');
      
      if (cells.length >= 2) {
        // Extract parking lot info from first cell
        const firstCell = $(cells[0]).text();
        const secondCell = $(cells[1]).text();
        
        // Skip if first cell is too short (likely header)
        if (firstCell.length < 10) return;
        
        // Parse lot name - get first line
        const lines = firstCell.split('\n').map(l => l.trim()).filter(l => l);
        if (lines.length === 0) return;
        
        const name = sanitizeString(lines[0]);
        
        // Skip if name doesn't look like a parking lot
        if (!name || name.length < 3) return;
        
        // Parse total spots
        const totalSpotsMatch = firstCell.match(/Total\s+Spots\s+(\d+)/i);
        if (!totalSpotsMatch) {
          console.log(`⚠️  Skipping "${name}" - no total spots found`);
          return;
        }
        
        const totalSpots = parseInt(totalSpotsMatch[1], 10);
        
        // Parse source timestamp
        const dateMatch = firstCell.match(/(\d{1,2}\/\d{1,2}\/\d{4}\s+\d{1,2}:\d{2}:\d{2}\s+[AP]M)/);
        let sourceTimestamp = null;
        if (dateMatch) {
          sourceTimestamp = new Date(dateMatch[1]);
        }
        
        // Parse available spots or status
        let availableSpots = null;
        let status = 'Open';
        
        const availableText = secondCell.trim();
        
        // Check for closed status
        if (availableText.toLowerCase().includes('closed')) {
          status = 'Closed';
          availableSpots = 0;
        } else if (availableText.toLowerCase() === 'open') {
          // If it just says "Open" with no number, assume lot is open but no sensor data
          // Set to 0 to indicate unknown/unavailable data
          status = 'Open';
          availableSpots = 0;
          console.log(`⚠️  "${name}": Status is "Open" but no availability number - setting to 0`);
        } else {
          // Extract ONLY the first number (before "Levels" text)
          const numberMatch = availableText.match(/^\s*(\d+)/);
          if (numberMatch) {
            availableSpots = parseInt(numberMatch[1], 10);
          } else {
            console.log(`⚠️  Could not parse available spots for "${name}": "${availableText}"`);
          }
        }
        
        // Validate data before adding
        if (name && totalSpots && availableSpots !== null && !isNaN(availableSpots)) {
          parkingData.push({
            name,
            totalSpots,
            availableSpots,
            status,
            sourceTimestamp,
            scrapedAt: timestamp
          });
          console.log(`✅ Parsed: ${name} - ${availableSpots}/${totalSpots} available`);
        } else {
          console.log(`❌ Skipped invalid data: name="${name}", total=${totalSpots}, available=${availableSpots}`);
        }
      }
    });

    console.log(`✅ Scraped ${parkingData.length} parking lots`);
    
    if (parkingData.length === 0) {
      console.warn('⚠️  WARNING: No parking data was scraped!');
      console.warn('The website structure may have changed.');
    }
    
    return parkingData;
    
  } catch (error) {
    console.error('❌ Scraping error:', error.message);
    throw new Error('Failed to scrape parking data');
  }
}

// Scrape service announcements
export async function scrapeServiceAnnouncements() {
  try {
    const response = await axios.get(PARKING_URL, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; ParkingMonitor/1.0)',
      }
    });

    const html = response.data;
    const $ = cheerio.load(html);
    const announcements = [];

    // Look for announcement text
    const announcementText = $('#lblMessage').text().trim();
    
    if (announcementText) {
      announcements.push({
        message: sanitizeString(announcementText),
        priority: 'medium',
        isActive: true
      });
    }

    // Check for specific lot closures or date ranges
    $('table tr').each((index, element) => {
      const $row = $(element);
      const text = $row.text();
      
      // Look for date ranges (e.g., "01/20/2026 - 05/07/2026")
      const dateRangeMatch = text.match(/(\d{2}\/\d{2}\/\d{4})\s*-\s*(\d{2}\/\d{2}\/\d{4})/);
      if (dateRangeMatch) {
        const nameMatch = text.match(/^([^\n]+)/);
        if (nameMatch) {
          const lotName = sanitizeString(nameMatch[1].trim());
          announcements.push({
            message: `${lotName}: Available ${dateRangeMatch[0]}`,
            priority: 'medium',
            isActive: true,
            startDate: new Date(dateRangeMatch[1]),
            endDate: new Date(dateRangeMatch[2])
          });
        }
      }
    });

    console.log(`✅ Found ${announcements.length} announcements`);
    return announcements;
    
  } catch (error) {
    console.error('❌ Announcement scraping error:', error.message);
    return [];
  }
}

// Save parking data to database
export async function saveParkingData(parkingData) {
  try {
    for (const lot of parkingData) {
      // Get parking lot ID
      const lotResult = await query(
        'SELECT id FROM parking_lots WHERE name = ?',
        [lot.name]
      );

      if (lotResult.length === 0) {
        console.warn(`⚠️  Parking lot not found: ${lot.name}`);
        continue;
      }

      const parkingLotId = lotResult[0].id;

      // Convert Date to ISO string for SQLite
      const sourceTimestampStr = lot.sourceTimestamp 
        ? lot.sourceTimestamp.toISOString() 
        : null;

      // Insert snapshot
      await query(
        `INSERT INTO parking_snapshots 
         (parking_lot_id, available_spots, total_spots, status, source_timestamp) 
         VALUES (?, ?, ?, ?, ?)`,
        [
          parkingLotId,
          lot.availableSpots,
          lot.totalSpots,
          lot.status,
          sourceTimestampStr
        ]
      );
    }

    console.log('✅ Parking data saved to database');
  } catch (error) {
    console.error('❌ Error saving parking data:', error.message);
    throw error;
  }
}

// Save service announcements to database
export async function saveAnnouncements(announcements) {
  try {
    // Deactivate old announcements
    await query('UPDATE service_announcements SET is_active = FALSE');

    // Insert new announcements
    for (const announcement of announcements) {
      await query(
        `INSERT INTO service_announcements 
         (message, priority, is_active, start_date, end_date) 
         VALUES (?, ?, ?, ?, ?)`,
        [
          announcement.message,
          announcement.priority,
          announcement.isActive,
          announcement.startDate || null,
          announcement.endDate || null
        ]
      );
    }

    console.log('✅ Announcements saved to database');
  } catch (error) {
    console.error('❌ Error saving announcements:', error.message);
    throw error;
  }
}

// Main scraping function
export async function scrapeAndSave() {
  try {
    const [parkingData, announcements] = await Promise.all([
      scrapeParkingData(),
      scrapeServiceAnnouncements()
    ]);

    await saveParkingData(parkingData);
    
    if (announcements.length > 0) {
      await saveAnnouncements(announcements);
    }

    return {
      success: true,
      lotsScraped: parkingData.length,
      announcementsFound: announcements.length,
      timestamp: new Date()
    };
  } catch (error) {
    console.error('❌ Scrape and save failed:', error.message);
    return {
      success: false,
      error: error.message,
      timestamp: new Date()
    };
  }
}

// Schedule scraping every N minutes
export function startScheduledScraping(intervalMinutes = 5) {
  console.log(`⏰ Scheduling scraping every ${intervalMinutes} minutes`);
  
  // Run immediately on startup
  scrapeAndSave();
  
  // Then run on schedule
  setInterval(() => {
    scrapeAndSave();
  }, intervalMinutes * 60 * 1000);
}

// Security: Sanitize strings to prevent injection
function sanitizeString(str) {
  return str
    .replace(/[<>]/g, '') // Remove potential HTML tags
    .trim()
    .substring(0, 500); // Limit length
}
