import { query } from '../config/database.js';

// Lot prediction
export async function predictNextHourOccupancy(lotId) {
  try {
    const now = new Date();
    const currentDayOfWeek = now.getDay();
    const currentHour = now.getHours();
    const nextHour = (currentHour + 1) % 24;

    const historicalData = await query(`
      SELECT occupancy_percentage, available_spots, total_spots, scraped_at
      FROM parking_snapshots
      WHERE parking_lot_id = ?
        AND CAST(strftime('%w', scraped_at) AS INTEGER) = ?
        AND CAST(strftime('%H', scraped_at) AS INTEGER) = ?
        AND scraped_at >= datetime('now', '-4 weeks')
      ORDER BY scraped_at DESC
    `, [lotId, currentDayOfWeek, nextHour]);

    if (historicalData.length === 0) {
      const anyData = await query(`
        SELECT occupancy_percentage, available_spots, total_spots
        FROM parking_snapshots
        WHERE parking_lot_id = ?
        ORDER BY scraped_at DESC
        LIMIT 1
      `, [lotId]);

      if (anyData.length === 0) {
        return {
          predicted_occupancy: null,
          predicted_available: null,
          confidence: 'insufficient_data',
          data_points: 0,
          message: 'No data available yet. System is collecting data.'
        };
      }

      return {
        predicted_occupancy: anyData[0].occupancy_percentage || 0,
        predicted_available: anyData[0].available_spots || 0,
        confidence: 'very_low',
        confidence_percent: 20,
        data_points: 1,
        standard_deviation: 0,
        prediction_time: new Date(now.getTime() + 60 * 60 * 1000).toISOString(),
        based_on_hour: nextHour,
        based_on_day: getDayName(currentDayOfWeek),
        message: 'Using current occupancy as baseline (limited historical data)'
      };
    }

    return buildPrediction(historicalData, now, currentDayOfWeek, nextHour, 'lot', lotId);

  } catch (error) {
    console.error('Error predicting lot:', error);
    return { predicted_occupancy: null, predicted_available: null, confidence: 'error', message: error.message };
  }
}

// Level prediction
export async function predictNextHourOccupancyForLevel(levelId) {
  try {
    const now = new Date();
    const currentDayOfWeek = now.getDay();
    const nextHour = (now.getHours() + 1) % 24;

    const historicalData = await query(`
      SELECT occupancy_percentage, available_spots, total_spots, scraped_at
      FROM parking_level_snapshots
      WHERE parking_level_id = ?
        AND CAST(strftime('%w', scraped_at) AS INTEGER) = ?
        AND CAST(strftime('%H', scraped_at) AS INTEGER) = ?
        AND scraped_at >= datetime('now', '-4 weeks')
      ORDER BY scraped_at DESC
    `, [levelId, currentDayOfWeek, nextHour]);

    if (historicalData.length === 0) {
      const anyData = await query(`
        SELECT occupancy_percentage, available_spots, total_spots
        FROM parking_level_snapshots
        WHERE parking_level_id = ?
        ORDER BY scraped_at DESC
        LIMIT 1
      `, [levelId]);

      if (anyData.length === 0) {
        return {
          predicted_occupancy: null,
          predicted_available: null,
          confidence: 'insufficient_data',
          data_points: 0,
          message: 'No data available yet. System is collecting data.'
        };
      }

      return {
        predicted_occupancy: anyData[0].occupancy_percentage || 0,
        predicted_available: anyData[0].available_spots || 0,
        confidence: 'very_low',
        confidence_percent: 20,
        data_points: 1,
        standard_deviation: 0,
        prediction_time: new Date(now.getTime() + 60 * 60 * 1000).toISOString(),
        based_on_hour: nextHour,
        based_on_day: getDayName(currentDayOfWeek),
        message: 'Using current occupancy as baseline (limited historical data)'
      };
    }

    return buildPrediction(historicalData, now, currentDayOfWeek, nextHour, 'level', levelId);

  } catch (error) {
    console.error('Error predicting level:', error);
    return { predicted_occupancy: null, predicted_available: null, confidence: 'error', message: error.message };
  }
}

// Prediction function/math
async function buildPrediction(historicalData, now, dayOfWeek, nextHour, type, id) {
  const totalOccupancy = historicalData.reduce((sum, r) => sum + (r.occupancy_percentage || 0), 0);
  const avgOccupancy = totalOccupancy / historicalData.length;

  const variance = historicalData.reduce((sum, r) => {
    const diff = (r.occupancy_percentage || 0) - avgOccupancy;
    return sum + diff * diff;
  }, 0) / historicalData.length;
  const stdDev = Math.sqrt(variance);

  const totalSpots = historicalData[0].total_spots;

  let confidence = 'very_low';
  let confidencePercent = 30;

  if (historicalData.length >= 12) {
    if (stdDev < 10) { confidence = 'high'; confidencePercent = 90; }
    else if (stdDev < 20) { confidence = 'medium'; confidencePercent = 70; }
    else { confidence = 'low'; confidencePercent = 50; }
  } else if (historicalData.length >= 6) {
    confidence = 'medium'; confidencePercent = 60;
  } else if (historicalData.length >= 3) {
    confidence = 'low'; confidencePercent = 45;
  }

  const trend = await getCurrentTrend(id, type);
  const adjusted = trend !== null
    ? (avgOccupancy * 0.7) + ((avgOccupancy + trend) * 0.3)
    : avgOccupancy;

  return {
    predicted_occupancy: Math.round(adjusted * 10) / 10,
    predicted_available: Math.max(0, Math.round(totalSpots * (1 - adjusted / 100))),
    confidence,
    confidence_percent: confidencePercent,
    data_points: historicalData.length,
    standard_deviation: Math.round(stdDev * 10) / 10,
    prediction_time: new Date(now.getTime() + 60 * 60 * 1000).toISOString(),
    based_on_hour: nextHour,
    based_on_day: getDayName(dayOfWeek)
  };
}

async function getCurrentTrend(id, type) {
  try {
    const table = type === 'level' ? 'parking_level_snapshots' : 'parking_snapshots';
    const col = type === 'level' ? 'parking_level_id' : 'parking_lot_id';

    const recentData = await query(`
      SELECT occupancy_percentage, scraped_at
      FROM ${table}
      WHERE ${col} = ?
        AND scraped_at >= datetime('now', '-2 hours')
      ORDER BY scraped_at DESC
      LIMIT 2
    `, [id]);

    if (recentData.length === 2) {
      return (recentData[0].occupancy_percentage || 0) - (recentData[1].occupancy_percentage || 0);
    }
    return null;
  } catch {
    return null;
  }
}

function getDayName(dayNum) {
  return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dayNum];
}

export async function predictAllLots() {
  try {
    const lots = await query('SELECT id, name FROM parking_lots WHERE is_active = 1');
    return await Promise.all(
      lots.map(async (lot) => ({
        lot_id: lot.id,
        lot_name: lot.name,
        ...(await predictNextHourOccupancy(lot.id))
      }))
    );
  } catch (error) {
    console.error('Error predicting all lots:', error);
    return [];
  }
}
