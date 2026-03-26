import axios from 'axios';
import { query } from '../config/database.js';

const PARKING_API_URL = process.env.PARKING_API_URL || '';

let cachedAnnouncements = [];
let lastAnnouncementUpdate = null;

export function getCachedAnnouncements() {
  return {
    announcements: cachedAnnouncements,
    lastUpdate: lastAnnouncementUpdate
  };
}

export async function scrapeParkingData() {
  try {
    if (!PARKING_API_URL) {
      throw new Error('PARKING_API_URL not configured');
    }

    const response = await axios.get(PARKING_API_URL, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; ParkingMonitor/1.0)',
      }
    });

    const apiData = response.data;
    const parkingData = [];
    const timestamp = new Date();

    const lotMap = {};

    for (const item of apiData) {
      if (item.LevelID === 0) {
        const available = item.Available === 'Open' ? 0 : parseInt(item.Available, 10);
        const totalSpots = parseInt(item.TotalSpots, 10);
        
        parkingData.push({
          name: item.Name,
          totalSpots: totalSpots,
          availableSpots: isNaN(available) ? 0 : available,
          status: item.Available === 'Open' ? 'Open' : (available > 0 ? 'Open' : 'Full'),
          sourceTimestamp: new Date(item.Last_Updated),
          scrapedAt: timestamp
        });

        lotMap[item.LotID] = {
          name: item.Name,
          levels: []
        };
      } else {
        if (!lotMap[item.LotID]) {
          lotMap[item.LotID] = {
            name: item.Name.replace(/Level \d+/, '').trim(),
            levels: []
          };
        }

        const available = parseInt(item.Available, 10);
        lotMap[item.LotID].levels.push({
          level: item.LevelID,
          name: item.Name,
          available: isNaN(available) ? 0 : available,
          total: parseInt(item.TotalSpots, 10)
        });
      }
    }

    console.log(`API fetch successful: ${parkingData.length} lots`);
    
    return parkingData;
    
  } catch (error) {
    console.error('API fetch error:', error.message);
    throw new Error('Failed to fetch from parking API');
  }
}

export async function scrapeServiceAnnouncements() {
  try {
    const announcements = [{
      id: 1,
      message: 'No Announcement',
      priority: 'low',
      created_at: new Date().toISOString()
    }];

    cachedAnnouncements = announcements;
    lastAnnouncementUpdate = new Date();

    return announcements;
    
  } catch (error) {
    console.error('Announcement error:', error.message);
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
    console.error('Error saving parking data:', error.message);
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
    console.error('Scraper save failed:', error.message);
    return {
      success: false,
      error: error.message,
      timestamp: new Date()
    };
  }
}

export function startScheduledScraping(intervalMinutes = 5) {  
  scrapeAndSave();
  
  setInterval(() => {
    scrapeAndSave();
  }, intervalMinutes * 60 * 1000);
}
