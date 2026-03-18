import { query } from '../config/database.js';

export async function predictNextHourOccupancy(lotId) {
  try {
    const now = new Date();
    const currentDayOfWeek = now.getDay();
    const currentHour = now.getHours();
    const nextHour = (currentHour + 1) % 24;

    // only past 4 weeks
    const historicalData = await query(`
      SELECT 
        occupancy_percentage,
        available_spots,
        total_spots,
        scraped_at
      FROM parking_snapshots
      WHERE parking_lot_id = ?
        AND CAST(strftime('%w', scraped_at) AS INTEGER) = ?
        AND CAST(strftime('%H', scraped_at) AS INTEGER) = ?
        AND scraped_at >= datetime('now', '-4 weeks')
      ORDER BY scraped_at DESC
    `, [lotId, currentDayOfWeek, nextHour]);

    if (historicalData.length === 0) {
      return {
        predicted_occupancy: null,
        predicted_available: null,
        confidence: 'insufficient_data',
        data_points: 0,
        message: 'Not enough historical data for prediction'
      };
    }

    // average
    const totalOccupancy = historicalData.reduce((sum, record) => {
      return sum + (record.occupancy_percentage || 0);
    }, 0);
    
    const averageOccupancy = totalOccupancy / historicalData.length;

    const variance = historicalData.reduce((sum, record) => {
      const diff = (record.occupancy_percentage || 0) - averageOccupancy;
      return sum + (diff * diff);
    }, 0) / historicalData.length;
    

    // deviation and data amount confidence
    const standardDeviation = Math.sqrt(variance);

    const totalSpots = historicalData[0].total_spots;
    const predictedAvailable = Math.round(totalSpots * (1 - averageOccupancy / 100));

    let confidence = 'low';
    let confidencePercent = 0;
    
    if (historicalData.length >= 12) {
      if (standardDeviation < 10) {
        confidence = 'high';
        confidencePercent = 90;
      } else if (standardDeviation < 20) {
        confidence = 'medium';
        confidencePercent = 70;
      } else {
        confidence = 'low';
        confidencePercent = 50;
      }
    } else if (historicalData.length >= 6) {
      confidence = 'medium';
      confidencePercent = 60;
    } else {
      confidence = 'low';
      confidencePercent = 40;
    }

    // last thing, recent trend effect for start of semester and whatnot
    const recentTrend = await getCurrentTrend(lotId);
    let trendAdjustedOccupancy = averageOccupancy;
    
    if (recentTrend !== null) {
      trendAdjustedOccupancy = (averageOccupancy * 0.7) + ((averageOccupancy + recentTrend) * 0.3);
    }

    return {
      predicted_occupancy: Math.round(trendAdjustedOccupancy * 10) / 10,
      predicted_available: Math.max(0, Math.round(totalSpots * (1 - trendAdjustedOccupancy / 100))),
      confidence: confidence,
      confidence_percent: confidencePercent,
      data_points: historicalData.length,
      standard_deviation: Math.round(standardDeviation * 10) / 10,
      prediction_time: new Date(now.getTime() + 60 * 60 * 1000).toISOString(),
      based_on_hour: nextHour,
      based_on_day: getDayName(currentDayOfWeek)
    };

  } catch (error) {
    console.error('Error predicting:', error);
    return {
      predicted_occupancy: null,
      predicted_available: null,
      confidence: 'error',
      message: error.message
    };
  }
}


async function getCurrentTrend(lotId) {
  try {
    const recentData = await query(`
      SELECT occupancy_percentage, scraped_at
      FROM parking_snapshots
      WHERE parking_lot_id = ?
        AND scraped_at >= datetime('now', '-2 hours')
      ORDER BY scraped_at DESC
      LIMIT 2
    `, [lotId]);

    if (recentData.length === 2) {
      const recent = recentData[0].occupancy_percentage || 0;
      const previous = recentData[1].occupancy_percentage || 0;
      return recent - previous;
    }

    return null;
  } catch (error) {
    return null;
  }
}


function getDayName(dayNum) {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[dayNum];
}

export async function predictAllLots() {
  try {
    const lots = await query('SELECT id, name FROM parking_lots WHERE is_active = 1');
    
    const predictions = await Promise.all(
      lots.map(async (lot) => {
        const prediction = await predictNextHourOccupancy(lot.id);
        return {
          lot_id: lot.id,
          lot_name: lot.name,
          ...prediction
        };
      })
    );

    return predictions;
  } catch (error) {
    console.error('Error predicting: ', error);
    return [];
  }
}
