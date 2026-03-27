import axios from 'axios';
import { load } from 'cheerio';
import { query } from '../config/database.js';

const PARKING_API_URL = process.env.PARKING_API_URL || '';
const ANNOUNCEMENT_URL = 'https://parking.fullerton.edu/';

let cachedAnnouncements = [];
let lastAnnouncementUpdate = null;

export function getCachedAnnouncements() {
  return { announcements: cachedAnnouncements, lastUpdate: lastAnnouncementUpdate };
}

function sanitizeString(str) {
  return str.replace(/\s+/g, ' ').trim();
}

export async function scrapeParkingData() {
  try {
    if (!PARKING_API_URL) throw new Error('PARKING_API_URL not configured');

    const response = await axios.get(PARKING_API_URL, {
      timeout: 10000,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ParkingMonitor/1.0)' }
    });

    const apiData = response.data;
    const parkingData = [];
    const levelsByLotId = {};
    const timestamp = new Date();

    for (const item of apiData) {
      if (item.LevelID === 0) {
        const available = item.Available === 'Open' ? 0 : parseInt(item.Available, 10);
        const totalSpots = parseInt(item.TotalSpots, 10);
        parkingData.push({
          apiLotId: item.LotID,
          name: item.Name,
          totalSpots,
          availableSpots: isNaN(available) ? 0 : available,
          status: item.Available === 'Open' ? 'Open' : (available > 0 ? 'Open' : 'Full'),
          sourceTimestamp: new Date(item.Last_Updated),
          scrapedAt: timestamp
        });
        if (!levelsByLotId[item.LotID]) levelsByLotId[item.LotID] = [];
      } else {
        if (!levelsByLotId[item.LotID]) levelsByLotId[item.LotID] = [];
        const available = parseInt(item.Available, 10);
        levelsByLotId[item.LotID].push({
          levelNumber: item.LevelID,
          name: item.Name,
          availableSpots: isNaN(available) ? 0 : available,
          totalSpots: parseInt(item.TotalSpots, 10),
          sourceTimestamp: new Date(item.Last_Updated)
        });
      }
    }

    console.log(`API fetch successful: ${parkingData.length} lots, levels for ${Object.keys(levelsByLotId).length} structures`);
    return { lots: parkingData, levelsByLotId };
  } catch (error) {
    console.error('API fetch error:', error.message);
    throw new Error('Failed to fetch from parking API');
  }
}

export async function scrapeServiceAnnouncements() {
  try {
    const response = await axios.get(ANNOUNCEMENT_URL, {
      timeout: 10000,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ParkingMonitor/1.0)' }
    });

    const html = response.data;
    const $ = load(html);
    const allMessages = [];

    $('*').contents().each((i, node) => {
      if (node.type === 'text') {
        const text = node.data.trim();
        if (text.length > 80) {
          const $parent = $(node.parent);
          const tagName = node.parent.tagName?.toLowerCase();
          if (['head', 'script', 'style', 'link', 'meta', 'noscript'].includes(tagName)) return;
          if ($parent.closest('head').length > 0) return;

          const $clone = $parent.clone();
          $clone.find('br').replaceWith('|||');
          const rawText = $clone.text().trim().replace(/\s+/g, ' ');

          if (rawText.length > 80 && rawText.length < 3000) {
            rawText.split('|||').forEach((part, index) => {
              const cleaned = part.trim();
              if (cleaned.length > 20) {
                allMessages.push({ id: index + 1, message: cleaned, priority: 'high', created_at: new Date().toISOString() });
              }
            });
            return false;
          }
        }
      }
    });

    const announcements = allMessages.length > 0 ? allMessages : [{ id: 1, message: 'No Announcement', priority: 'low', created_at: new Date().toISOString() }];
    cachedAnnouncements = announcements;
    lastAnnouncementUpdate = new Date();
    return announcements;
  } catch (error) {
    console.error('Announcement scraping error:', error.message);
    const def = [{ id: 1, message: 'No Announcement', priority: 'low', created_at: new Date().toISOString() }];
    cachedAnnouncements = def;
    lastAnnouncementUpdate = new Date();
    return def;
  }
}

export async function saveParkingData(parkingData, levelsByLotId) {
  try {
    const timestamp = new Date().toISOString();

    for (const lot of parkingData) {
      const lotResult = await query('SELECT id FROM parking_lots WHERE name = ?', [lot.name]);
      if (lotResult.length === 0) { console.warn(`Missing lot: ${lot.name}`); continue; }

      const parkingLotId = lotResult[0].id;
      const sourceTimestampStr = lot.sourceTimestamp ? lot.sourceTimestamp.toISOString() : null;

      await query(
        `INSERT INTO parking_snapshots (parking_lot_id, available_spots, total_spots, status, source_timestamp) VALUES (?, ?, ?, ?, ?)`,
        [parkingLotId, lot.availableSpots, lot.totalSpots, lot.status, sourceTimestampStr]
      );

      const levels = levelsByLotId[lot.apiLotId] || [];
      for (const level of levels) {
        const existingLevel = await query(
          'SELECT id FROM parking_levels WHERE parking_lot_id = ? AND level_number = ?',
          [parkingLotId, level.levelNumber]
        );

        let parkingLevelId;

        if (existingLevel.length === 0) {
          // database-sqlite.js returns [{ insertId: lastInsertRowid, affectedRows }]
          const insertResult = await query(
            `INSERT INTO parking_levels (parking_lot_id, level_number, name, total_spots) VALUES (?, ?, ?, ?)`,
            [parkingLotId, level.levelNumber, level.name, level.totalSpots]
          );
          parkingLevelId = insertResult[0]?.insertId;
          if (!parkingLevelId) { console.warn(`Failed to get insertId for level: ${level.name}`); continue; }
          console.log(`New level registered: ${level.name} (id: ${parkingLevelId})`);
        } else {
          parkingLevelId = existingLevel[0].id;
          await query(
            `UPDATE parking_levels SET name = ?, total_spots = ?, updated_at = ? WHERE id = ?`,
            [level.name, level.totalSpots, timestamp, parkingLevelId]
          );
        }

        const levelSourceTs = level.sourceTimestamp ? level.sourceTimestamp.toISOString() : null;
        await query(
          `INSERT INTO parking_level_snapshots (parking_level_id, available_spots, total_spots, source_timestamp) VALUES (?, ?, ?, ?)`,
          [parkingLevelId, level.availableSpots, level.totalSpots, levelSourceTs]
        );
      }
    }
  } catch (error) {
    console.error('Error saving parking data:', error.message);
    throw error;
  }
}

export async function scrapeAndSave() {
  try {
    const [{ lots: parkingData, levelsByLotId }, announcements] = await Promise.all([
      scrapeParkingData(),
      scrapeServiceAnnouncements()
    ]);

    await saveParkingData(parkingData, levelsByLotId);

    const totalLevels = Object.values(levelsByLotId).reduce((sum, arr) => sum + arr.length, 0);
    return { success: true, lotsScraped: parkingData.length, levelsScraped: totalLevels, announcementsFound: announcements.length, timestamp: new Date() };
  } catch (error) {
    console.error('Scraper save failed:', error.message);
    return { success: false, error: error.message, timestamp: new Date() };
  }
}

export function startScheduledScraping(intervalMinutes = 5) {
  scrapeAndSave();
  setInterval(() => scrapeAndSave(), intervalMinutes * 60 * 1000);
}
