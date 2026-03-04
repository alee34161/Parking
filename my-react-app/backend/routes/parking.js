import express from 'express';
import { query } from '../config/database.js';
import { scrapeAndSave } from '../services/scraper.js';

const router = express.Router();

// GET /api/parking/lots - Get all parking lots with latest availability
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

    // Parse JSON fields
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

// GET /api/parking/lots/:id - Get specific parking lot details
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
    const formattedLot = {
      ...lot,
      polygon_coordinates: lot.polygon_coordinates ? JSON.parse(lot.polygon_coordinates) : null,
      permit_types: lot.permit_types ? JSON.parse(lot.permit_types) : []
    };

    res.json({
      success: true,
      data: formattedLot
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/parking/lots/:id/history - Get historical data for a lot
router.get('/lots/:id/history', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { hours = 24 } = req.query;
    
    // Validate inputs
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

// GET /api/parking/announcements - Get active service announcements
router.get('/announcements', async (req, res, next) => {
  try {
    const announcements = await query(`
      SELECT 
        sa.id,
        sa.title,
        sa.message,
        sa.priority,
        sa.start_date,
        sa.end_date,
        sa.created_at,
        pl.name as parking_lot_name
      FROM service_announcements sa
      LEFT JOIN parking_lots pl ON sa.parking_lot_id = pl.id
      WHERE sa.is_active = 1
        AND (sa.start_date IS NULL OR sa.start_date <= DATE('now'))
        AND (sa.end_date IS NULL OR sa.end_date >= DATE('now'))
      ORDER BY 
        CASE sa.priority 
          WHEN 'critical' THEN 1
          WHEN 'high' THEN 2
          WHEN 'medium' THEN 3
          WHEN 'low' THEN 4
        END,
        sa.created_at DESC
    `);

    res.json({
      success: true,
      data: announcements
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/parking/refresh - Manually trigger scraping (protected endpoint)
router.post('/refresh', async (req, res, next) => {
  try {
    // In production, add authentication middleware here
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

// GET /api/parking/stats - Get system statistics
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
