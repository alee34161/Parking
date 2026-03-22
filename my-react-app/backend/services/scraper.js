import axios from 'axios';
import * as cheerio from 'cheerio';
import { query } from '../config/database.js';

const PARKING_URL = 'https://parking.fullerton.edu/parkinglotcounts/mobile.aspx';
const ANNOUNCEMENT_URL = 'https://parking.fullerton.edu/';

// announcement cache
let cachedAnnouncements = [];
let lastAnnouncementUpdate = null;

export function getCachedAnnouncements() {
  return {
    announcements: cachedAnnouncements,
    lastUpdate: lastAnnouncementUpdate
  };
}

// parking data scraper
export async function scrapeParkingData() {
  try {    
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

    // parse
    $('table tr').each((index, element) => {
      const $row = $(element);
      const cells = $row.find('td');
      
      if (cells.length >= 2) {
        const firstCell = $(cells[0]).text();
        const secondCell = $(cells[1]).text();
        
        if (firstCell.length < 10) return;
        
        const lines = firstCell.split('\n').map(l => l.trim()).filter(l => l);
        if (lines.length === 0) return;
        
        const name = sanitizeString(lines[0]);
        
        if (!name || name.length < 3) return;
        
        const totalSpotsMatch = firstCell.match(/Total\s+Spots\s+(\d+)/i);
        if (!totalSpotsMatch) {
          console.log(`"${name}" is missing total spots`);
          return;
        }
        
        const totalSpots = parseInt(totalSpotsMatch[1], 10);
        
        const dateMatch = firstCell.match(/(\d{1,2}\/\d{1,2}\/\d{4}\s+\d{1,2}:\d{2}:\d{2}\s+[AP]M)/);
        let sourceTimestamp = null;
        if (dateMatch) {
          sourceTimestamp = new Date(dateMatch[1]);
        }
        
        let availableSpots = null;
        let status = 'Open';
        
        const availableText = secondCell.trim();
        
        if (availableText.toLowerCase().includes('closed')) {
          status = 'Closed';
          availableSpots = 0;
        } else if (availableText.toLowerCase() === 'open') {
          status = 'Open';
          availableSpots = 0;
          console.log(`"${name}": open but missing availability, default set to 0`);
        } else {
          const numberMatch = availableText.match(/^\s*(\d+)/);
          if (numberMatch) {
            availableSpots = parseInt(numberMatch[1], 10);
          } else {
            console.log(`"${name}": "${availableText}" unable to parse properly`);
          }
        }
        
        // validate
        if (name && totalSpots && availableSpots !== null && !isNaN(availableSpots)) {
          parkingData.push({
            name,
            totalSpots,
            availableSpots,
            status,
            sourceTimestamp,
            scrapedAt: timestamp
          });
        } else {
          console.log(`Invalid data skipped: name="${name}", total=${totalSpots}, available=${availableSpots}`);
        }
      }
    });

    console.log(`Scraped successfully`);
    
    if (parkingData.length === 0) {
      console.warn('No data detected, check scraping json');
    }
    
    return parkingData;
    
  } catch (error) {
    console.error('Scraping error: ', error.message);
    throw new Error('Scrape data failed');
  }
}

// scrape announcement
export async function scrapeServiceAnnouncements() {
  try {
        const response = await axios.get(ANNOUNCEMENT_URL, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; ParkingMonitor/1.0)',
      }
    });

    const html = response.data;
    const $ = cheerio.load(html);
    const announcements = [];

    const noticeText = $('.notice-warning, .notice-information, p.notice-warning').first().text().trim();
    
    if (noticeText && noticeText.length > 50) {
      announcements.push({
        id: 1,
        message: sanitizeString(noticeText),
        priority: 'high',
        created_at: new Date().toISOString()
      });
    } else {
      announcements.push({
        id: 1,
        message: 'No Announcement',
        priority: 'low',
        created_at: new Date().toISOString()
      });
    }

    // check the parking site too
    const availResponse = await axios.get(PARKING_URL, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; ParkingMonitor/1.0)',
      }
    });

    const availHtml = availResponse.data;
    const $avail = cheerio.load(availHtml);
    
    let lotAnnouncementId = 2;
    $avail('table tr').each((index, element) => {
      const $row = $avail(element);
      const text = $row.text();

      // parse for date mentioned
      const dateRangeMatch = text.match(/(\d{2}\/\d{2}\/\d{4})\s*-\s*(\d{2}\/\d{2}\/\d{4})/);
      if (dateRangeMatch) {
        const lines = text.split('\n').map(l => l.trim()).filter(l => l);
        if (lines.length > 0) {
          const lotName = sanitizeString(lines[0]);
          if (lotName && lotName.length > 3) {
            announcements.push({
              id: lotAnnouncementId++,
              message: `${lotName}: Available ${dateRangeMatch[0]}`,
              priority: 'medium',
              start_date: dateRangeMatch[1],
              end_date: dateRangeMatch[2],
              created_at: new Date().toISOString()
            });
          }
        }
      }
    });

    cachedAnnouncements = announcements;
    lastAnnouncementUpdate = new Date();

    return announcements;
    
  } catch (error) {
    console.error('Announcement scraping error:', error.message);
    const defaultAnnouncement = [{
      id: 1,
      message: 'No Announcement',
      priority: 'low',
      created_at: new Date().toISOString()
    }];
    cachedAnnouncements = defaultAnnouncement;
    lastAnnouncementUpdate = new Date();
    return defaultAnnouncement;
  }
}

export async function saveParkingData(parkingData) {
  try {
    for (const lot of parkingData) {
      const lotResult = await query(
        'SELECT id FROM parking_lots WHERE name = ?',
        [lot.name]
      );

      if (lotResult.length === 0) {
        console.warn(`Missing lot: ${lot.name}`);
        continue;
      }

      const parkingLotId = lotResult[0].id;

      const sourceTimestampStr = lot.sourceTimestamp 
        ? lot.sourceTimestamp.toISOString() 
        : null;

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

  } catch (error) {
    console.error('Error saving parking data: ', error.message);
    throw error;
  }
}

export async function scrapeAndSave() {
  try {
    const [parkingData, announcements] = await Promise.all([
      scrapeParkingData(),
      scrapeServiceAnnouncements()
    ]);

    await saveParkingData(parkingData);

    return {
      success: true,
      lotsScraped: parkingData.length,
      announcementsFound: announcements.length,
      timestamp: new Date()
    };
  } catch (error) {
    console.error('Scraper save failed: ', error.message);
    return {
      success: false,
      error: error.message,
      timestamp: new Date()
    };
  }
}

// scrape every 5 min to generate history for prediction
export function startScheduledScraping(intervalMinutes = 5) {  
  scrapeAndSave();
  
  setInterval(() => {
    scrapeAndSave();
  }, intervalMinutes * 60 * 1000);
}

// sanitize input
function sanitizeString(str) {
  return str
    .replace(/[<>]/g, '')
    .trim()
    .substring(0, 500);
}
