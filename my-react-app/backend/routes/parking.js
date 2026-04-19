import express from 'express';
import { query } from '../config/database.js';
import { scrapeAndSave } from '../services/scraper.js';

const router = express.Router();

// GET lots
router.get('/lots', async (req, res, next) => {
  try {
    const lots = await query(`
      SELECT pl.id, pl.name, pl.total_spots, pl.latitude, pl.longitude,
             pl.polygon_coordinates, pl.permit_types, pl.badge_offset, pl.is_structure, pl.has_levels, pl.description,
             ps.available_spots, ps.occupancy_percentage, ps.status, ps.source_timestamp, ps.scraped_at
      FROM parking_lots pl
      LEFT JOIN parking_snapshots ps ON pl.id = ps.parking_lot_id
      WHERE pl.is_active = 1
        AND (ps.id IS NULL OR ps.id = (
          SELECT id FROM parking_snapshots WHERE parking_lot_id = pl.id ORDER BY scraped_at DESC LIMIT 1
        ))
      ORDER BY pl.name
    `);

    const formattedLots = lots.map(lot => ({
      ...lot,
      polygon_coordinates: lot.polygon_coordinates ? JSON.parse(lot.polygon_coordinates) : null,
      permit_types: lot.permit_types ? JSON.parse(lot.permit_types) : []
    }));

    res.json({ success: true, data: formattedLots, timestamp: new Date() });
  } catch (error) { next(error); }
});

// GET levels
router.get('/levels', async (req, res, next) => {
  try {
    const levels = await query(`
      SELECT
        pl.id,
        pl.parking_lot_id,
        pl.level_number,
        pl.name,
        pl.total_spots,
        pls.available_spots,
        pls.occupancy_percentage,
        pls.source_timestamp,
        pls.scraped_at
      FROM parking_levels pl
      LEFT JOIN parking_level_snapshots pls ON pl.id = pls.parking_level_id
      WHERE pl.is_active = 1
        AND (pls.id IS NULL OR pls.id = (
          SELECT id FROM parking_level_snapshots WHERE parking_level_id = pl.id ORDER BY scraped_at DESC LIMIT 1
        ))
      ORDER BY pl.parking_lot_id, pl.level_number
    `);

    res.json({ success: true, data: levels, timestamp: new Date() });
  } catch (error) { next(error); }
});

// GET lots using id
router.get('/lots/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!/^\d+$/.test(id)) return res.status(400).json({ success: false, error: 'Invalid lot ID' });

    const lots = await query(`
      SELECT pl.*, ps.available_spots, ps.occupancy_percentage, ps.status, ps.source_timestamp, ps.scraped_at
      FROM parking_lots pl
      LEFT JOIN parking_snapshots ps ON pl.id = ps.parking_lot_id
      WHERE pl.id = ? AND pl.is_active = 1
        AND (ps.id IS NULL OR ps.id = (
          SELECT id FROM parking_snapshots WHERE parking_lot_id = pl.id ORDER BY scraped_at DESC LIMIT 1
        ))
      LIMIT 1
    `, [id]);

    if (lots.length === 0) return res.status(404).json({ success: false, error: 'Parking lot not found' });

    const lot = lots[0];

    const levels = await query(`
      SELECT pl.id, pl.level_number, pl.name, pl.total_spots,
             pls.available_spots, pls.occupancy_percentage, pls.source_timestamp, pls.scraped_at
      FROM parking_levels pl
      LEFT JOIN parking_level_snapshots pls ON pl.id = pls.parking_level_id
      WHERE pl.parking_lot_id = ? AND pl.is_active = 1
        AND (pls.id IS NULL OR pls.id = (
          SELECT id FROM parking_level_snapshots WHERE parking_level_id = pl.id ORDER BY scraped_at DESC LIMIT 1
        ))
      ORDER BY pl.level_number
    `, [id]);

    const { predictNextHourOccupancy } = await import('../services/prediction.js');
    const prediction = await predictNextHourOccupancy(parseInt(id, 10));

    res.json({
      success: true,
      data: {
        ...lot,
        polygon_coordinates: lot.polygon_coordinates ? JSON.parse(lot.polygon_coordinates) : null,
        permit_types: lot.permit_types ? JSON.parse(lot.permit_types) : [],
        levels,
        prediction
      }
    });
  } catch (error) { next(error); }
});

// GET lots and levels by ids
router.get('/lots/:id/levels/:levelId', async (req, res, next) => {
  try {
    const { id, levelId } = req.params;
    if (!/^\d+$/.test(id) || !/^\d+$/.test(levelId)) return res.status(400).json({ success: false, error: 'Invalid ID' });

    const levels = await query(`
      SELECT pl.id, pl.parking_lot_id, pl.level_number, pl.name, pl.total_spots,
             pls.available_spots, pls.occupancy_percentage, pls.source_timestamp, pls.scraped_at
      FROM parking_levels pl
      LEFT JOIN parking_level_snapshots pls ON pl.id = pls.parking_level_id
      WHERE pl.id = ? AND pl.parking_lot_id = ? AND pl.is_active = 1
        AND (pls.id IS NULL OR pls.id = (
          SELECT id FROM parking_level_snapshots WHERE parking_level_id = pl.id ORDER BY scraped_at DESC LIMIT 1
        ))
      LIMIT 1
    `, [levelId, id]);

    if (levels.length === 0) return res.status(404).json({ success: false, error: 'Level not found' });

    const { predictNextHourOccupancyForLevel } = await import('../services/prediction.js');
    const prediction = await predictNextHourOccupancyForLevel(parseInt(levelId, 10));

    res.json({ success: true, data: { ...levels[0], prediction } });
  } catch (error) { next(error); }
});

// GET lot history by id
router.get('/lots/:id/history', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { hours = 24 } = req.query;
    if (!/^\d+$/.test(id)) return res.status(400).json({ success: false, error: 'Invalid lot ID' });

    const hoursNum = parseInt(hours, 10);
    if (isNaN(hoursNum) || hoursNum < 1 || hoursNum > 168) return res.status(400).json({ success: false, error: 'Hours must be between 1 and 168' });

    const history = await query(`
      SELECT available_spots, total_spots, occupancy_percentage, status, source_timestamp, scraped_at
      FROM parking_snapshots
      WHERE parking_lot_id = ? AND scraped_at >= datetime('now', '-' || ? || ' hours')
      ORDER BY scraped_at DESC
    `, [id, hoursNum]);

    res.json({ success: true, data: history, lotId: parseInt(id, 10), hours: hoursNum });
  } catch (error) { next(error); }
});

// GET lot and level history by id
router.get('/lots/:id/levels/:levelId/history', async (req, res, next) => {
  try {
    const { id, levelId } = req.params;
    const { hours = 24 } = req.query;
    if (!/^\d+$/.test(id) || !/^\d+$/.test(levelId)) return res.status(400).json({ success: false, error: 'Invalid ID' });

    const hoursNum = parseInt(hours, 10);
    if (isNaN(hoursNum) || hoursNum < 1 || hoursNum > 168) return res.status(400).json({ success: false, error: 'Hours must be between 1 and 168' });

    const history = await query(`
      SELECT available_spots, total_spots, occupancy_percentage, source_timestamp, scraped_at
      FROM parking_level_snapshots
      WHERE parking_level_id = ? AND scraped_at >= datetime('now', '-' || ? || ' hours')
      ORDER BY scraped_at DESC
    `, [levelId, hoursNum]);

    res.json({ success: true, data: history, levelId: parseInt(levelId, 10), hours: hoursNum });
  } catch (error) { next(error); }
});

// GET cached announcements
router.get('/announcements', async (req, res, next) => {
  try {
    const { getCachedAnnouncements } = await import('../services/scraper.js');
    const { announcements, lastUpdate } = getCachedAnnouncements();
    res.json({ success: true, data: announcements, lastUpdate });
  } catch (error) { next(error); }
});

// POST refresh
router.post('/refresh', async (req, res, next) => {
  try {
    const apiKey = req.headers['x-api-key'];
    if (apiKey !== process.env.ADMIN_API_KEY) return res.status(401).json({ success: false, error: 'Unauthorized' });
    const result = await scrapeAndSave();
    res.json({ success: result.success, message: 'Data refresh triggered', details: result });
  } catch (error) { next(error); }
});

// GET stats
router.get('/stats', async (req, res, next) => {
  try {
    const [lotStats] = await query(`
      SELECT COUNT(*) as total_lots, SUM(total_spots) as total_capacity,
             SUM(CASE WHEN is_structure THEN 1 ELSE 0 END) as structures,
             SUM(CASE WHEN is_active THEN 1 ELSE 0 END) as active_lots
      FROM parking_lots
    `);
    const [snapshotStats] = await query(`SELECT COUNT(*) as total_snapshots, MAX(scraped_at) as last_scrape FROM parking_snapshots`);
    const [levelStats] = await query(`SELECT COUNT(*) as total_levels, COUNT(DISTINCT parking_lot_id) as structures_with_levels FROM parking_levels WHERE is_active = 1`);
    const [currentAvailability] = await query(`
      SELECT SUM(ps.available_spots) as total_available, SUM(pl.total_spots) as total_capacity
      FROM parking_lots pl
      LEFT JOIN parking_snapshots ps ON pl.id = ps.parking_lot_id
      WHERE pl.is_active = 1
        AND ps.id = (SELECT id FROM parking_snapshots WHERE parking_lot_id = pl.id ORDER BY scraped_at DESC LIMIT 1)
    `);
    res.json({ success: true, data: { lots: lotStats, snapshots: snapshotStats, levels: levelStats, current: currentAvailability } });
  } catch (error) { next(error); }
});

export default router;
