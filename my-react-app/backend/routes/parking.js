import express from 'express';
import { query } from '../config/database.js';
import { scrapeAndSave } from '../services/scraper.js';

const router = express.Router();

router.get('/lots', async (req, res, next) => {
  try {
    const lots = await query(`
      SELECT 
        pl.id,
        pl.name,
        pl.total_spots,
        pl.latitude,
        pl.longitude,
        pl.polygon_coordinates,
        pl.permit_types,
        pl.is_structure,
        pl.has_levels,
        pl.description,
        ps.available_spots,
        ps.occupancy_percentage,
        ps.status,
        ps.source_timestamp,
        ps.scraped_at
      FROM parking_lots pl
      LEFT JOIN parking_snapshots ps ON pl.id = ps.parking_lot_id
      WHERE pl.is_active = 1
        AND (ps.id IS NULL OR ps.id = (
          SELECT id 
          FROM parking_snapshots 
          WHERE parking_lot_id = pl.id 
          ORDER BY scraped_at DESC 
          LIMIT 1
        ))
      ORDER BY pl.name
    `);

    const formattedLots = lots.map(lot => ({
      ...lot,
      polygon_coordinates: lot.polygon_coordinates ? JSON.parse(lot.polygon_coordinates) : null,
      permit_types: lot.permit_types ? JSON.parse(lot.permit_types) : []
    }));

    res.json({
      success: true,
      data: formattedLots,
      timestamp: new Date()
    });
  } catch (error) {
    next(error);
  }
});

router.get('/lots/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Validate ID is a number
    if (!/^\d+$/.test(id)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid lot ID' 
      });
    }

    const lots = await query(`
      SELECT 
        pl.*,
        ps.available_spots,
        ps.occupancy_percentage,
        ps.status,
        ps.source_timestamp,
        ps.scraped_at
      FROM parking_lots pl
      LEFT JOIN parking_snapshots ps ON pl.id = ps.parking_lot_id
      WHERE pl.id = ?
        AND pl.is_active = 1
        AND (ps.id IS NULL OR ps.id = (
          SELECT id 
          FROM parking_snapshots 
          WHERE parking_lot_id = pl.id 
          ORDER BY scraped_at DESC 
          LIMIT 1
        ))
      LIMIT 1
    `, [id]);

    if (lots.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'Parking lot not found' 
      });
    }

    const lot = lots[0];
    
    const { predictNextHourOccupancy } = await import('../services/prediction.js');
    const prediction = await predictNextHourOccupancy(parseInt(id, 10));
    
    const formattedLot = {
      ...lot,
      polygon_coordinates: lot.polygon_coordinates ? JSON.parse(lot.polygon_coordinates) : null,
      permit_types: lot.permit_types ? JSON.parse(lot.permit_types) : [],
      prediction: prediction
    };

    res.json({
      success: true,
      data: formattedLot
    });
  } catch (error) {
    next(error);
  }
});

router.get('/lots/:id/history', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { hours = 24 } = req.query;
    
    if (!/^\d+$/.test(id)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid lot ID' 
      });
    }
    
    const hoursNum = parseInt(hours, 10);
    if (isNaN(hoursNum) || hoursNum < 1 || hoursNum > 168) {
      return res.status(400).json({ 
        success: false, 
        error: 'Hours must be between 1 and 168' 
      });
    }

    const history = await query(`
      SELECT 
        available_spots,
        total_spots,
        occupancy_percentage,
        status,
        source_timestamp,
        scraped_at
      FROM parking_snapshots
      WHERE parking_lot_id = ?
        AND scraped_at >= datetime('now', '-' || ? || ' hours')
      ORDER BY scraped_at DESC
    `, [id, hoursNum]);

    res.json({
      success: true,
      data: history,
      lotId: parseInt(id, 10),
      hours: hoursNum
    });
  } catch (error) {
    next(error);
  }
});

router.get('/announcements', async (req, res, next) => {
  try {
    // Import the cache getter from scraper
    const { getCachedAnnouncements } = await import('../services/scraper.js');
    const { announcements, lastUpdate } = getCachedAnnouncements();

    res.json({
      success: true,
      data: announcements,
      lastUpdate: lastUpdate
    });
  } catch (error) {
    next(error);
  }
});

router.post('/refresh', async (req, res, next) => {
  try {
    const apiKey = req.headers['x-api-key'];
    
    if (apiKey !== process.env.ADMIN_API_KEY) {
      return res.status(401).json({ 
        success: false, 
        error: 'Unauthorized' 
      });
    }

    const result = await scrapeAndSave();
    
    res.json({
      success: result.success,
      message: 'Data refresh triggered',
      details: result
    });
  } catch (error) {
    next(error);
  }
});

router.get('/stats', async (req, res, next) => {
  try {
    const [lotStats] = await query(`
      SELECT 
        COUNT(*) as total_lots,
        SUM(total_spots) as total_capacity,
        SUM(CASE WHEN is_structure THEN 1 ELSE 0 END) as structures,
        SUM(CASE WHEN is_active THEN 1 ELSE 0 END) as active_lots
      FROM parking_lots
    `);

    const [snapshotStats] = await query(`
      SELECT 
        COUNT(*) as total_snapshots,
        MAX(scraped_at) as last_scrape
      FROM parking_snapshots
    `);

    const [currentAvailability] = await query(`
      SELECT 
        SUM(ps.available_spots) as total_available,
        SUM(pl.total_spots) as total_capacity
      FROM parking_lots pl
      LEFT JOIN parking_snapshots ps ON pl.id = ps.parking_lot_id
      WHERE pl.is_active = 1
        AND ps.id = (
          SELECT id 
          FROM parking_snapshots 
          WHERE parking_lot_id = pl.id 
          ORDER BY scraped_at DESC 
          LIMIT 1
        )
    `);

    res.json({
      success: true,
      data: {
        lots: lotStats,
        snapshots: snapshotStats,
        current: currentAvailability
      }
    });
  } catch (error) {
    next(error);
  }
});

export default router;
