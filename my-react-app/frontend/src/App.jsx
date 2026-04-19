import { useState, useEffect } from 'react';
import ParkingMap from './components/ParkingMap';
import './App.css';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

function PredictionBlock({ prediction }) {
  if (!prediction) return <p className="prediction-message">Prediction unavailable</p>;
  if (prediction.predicted_occupancy === null) {
    return <p className="prediction-message">{prediction.message || 'Not enough historical data yet.'}</p>;
  }
  return (
    <div className="prediction-content">
      <div className="prediction-main">
        <div className="prediction-stat">
          <span className="prediction-label">Expected Available</span>
          <span className="prediction-value prediction-available">~{prediction.predicted_available} spots</span>
        </div>
        <div className="prediction-stat">
          <span className="prediction-label">Predicted Occupancy</span>
          <span className="prediction-value prediction-occupancy">{prediction.predicted_occupancy.toFixed(1)}%</span>
        </div>
        <div className="prediction-stat">
          <span className="prediction-label">Confidence</span>
          <span className={`prediction-badge confidence-${prediction.confidence}`}>
            {prediction.confidence.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
            {prediction.confidence_percent ? ` (${prediction.confidence_percent}%)` : ''}
          </span>
        </div>
      </div>
      {prediction.message && <div className="prediction-meta"><small>{prediction.message}</small></div>}
      {prediction.data_points > 0 && (
        <div className="prediction-meta">
          <small>Based on {prediction.data_points} historical data points — {prediction.based_on_day} around {prediction.based_on_hour}:00</small>
        </div>
      )}
    </div>
  );
}

function App() {
  const [parkingLots, setParkingLots] = useState([]);
  const [allLevels, setAllLevels] = useState({});        // { [lotId]: [...levels] }
  const [announcements, setAnnouncements] = useState([]);
  const [selectedLot, setSelectedLot] = useState(null);
  const [selectedLotDetails, setSelectedLotDetails] = useState(null);
  const [selectedLevel, setSelectedLevel] = useState(null);
  const [selectedLevelDetails, setSelectedLevelDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);

  const [permitFilters, setPermitFilters] = useState({
    'Student Parking': true,
    'Employee Parking': true,
    'Resident Parking (non-freshmen)': true,
    'Hourly Parking': true
  });

  useEffect(() => {
    Promise.all([fetchParkingLots(), fetchAllLevels(), fetchAnnouncements()]);

    const interval = setInterval(() => {
      fetchParkingLots();
      fetchAllLevels();
      fetchAnnouncements();
    }, 1 * 60 * 1000); // how often to refresh data,   minutes * seconds * ms

    return () => clearInterval(interval);
  }, []);

  const fetchParkingLots = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/parking/lots`);
      if (!response.ok) throw new Error('Failed to fetch parking data');
      const data = await response.json();
      setParkingLots(data.data);
      setLastUpdate(new Date());
      setLoading(false);
      setError(null);
    } catch (err) {
      console.error('Error fetching parking lots:', err);
      setError('Failed to load parking data. Please try again later.');
      setLoading(false);
    }
  };

  const fetchAllLevels = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/parking/levels`);
      if (!response.ok) throw new Error('Failed to fetch levels');
      const data = await response.json();

      // Group by parking_lot_id
      const byLot = {};
      for (const level of data.data) {
        if (!byLot[level.parking_lot_id]) byLot[level.parking_lot_id] = [];
        byLot[level.parking_lot_id].push(level);
      }
      setAllLevels(byLot);
    } catch (err) {
      console.error('Error fetching levels:', err);
    }
  };

  const fetchAnnouncements = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/parking/announcements`);
      if (!response.ok) throw new Error('Failed to fetch announcements');
      const data = await response.json();
      setAnnouncements(data.data);
    } catch (err) {
      console.error('Error fetching announcements:', err);
    }
  };

  const handleLotClick = async (lotId) => {
    setSelectedLevel(null);
    setSelectedLevelDetails(null);
    setSelectedLot(lotId);

    try {
      const response = await fetch(`${API_BASE_URL}/parking/lots/${lotId}`);
      if (!response.ok) throw new Error('Failed to fetch lot details');
      const data = await response.json();
      setSelectedLotDetails(data.data);
      // Also refresh this lot's levels in allLevels
      if (data.data.levels?.length > 0) {
        setAllLevels(prev => ({ ...prev, [lotId]: data.data.levels }));
      }
    } catch (err) {
      console.error('Error fetching lot details:', err);
    }
  };

  const handleLevelClick = async (lotId, levelId) => {
    if (selectedLot !== lotId) await handleLotClick(lotId);
    setSelectedLevel({ id: levelId, lotId });

    try {
      const response = await fetch(`${API_BASE_URL}/parking/lots/${lotId}/levels/${levelId}`);
      if (!response.ok) throw new Error('Failed to fetch level details');
      const data = await response.json();
      setSelectedLevelDetails(data.data);
    } catch (err) {
      console.error('Error fetching level details:', err);
    }
  };

  const handleCloseDetails = () => {
    setSelectedLot(null);
    setSelectedLotDetails(null);
    setSelectedLevel(null);
    setSelectedLevelDetails(null);
  };

  const handleBackToLot = () => {
    setSelectedLevel(null);
    setSelectedLevelDetails(null);
  };

  const handlePermitFilterChange = (permitType) => {
    setPermitFilters(prev => ({ ...prev, [permitType]: !prev[permitType] }));
  };

  const getFilteredLotIds = () => {
    const activePermits = Object.keys(permitFilters).filter(k => permitFilters[k]);
    return parkingLots
      .filter(lot => {
        if (!lot.permit_types || lot.permit_types.length === 0) return true;
        return lot.permit_types.some(p => activePermits.includes(p));
      })
      .map(lot => lot.id);
  };

  const filteredLotIds = getFilteredLotIds();

  // Merge allLevels into each lot for the map
  const lotsWithLevels = parkingLots.map(lot => ({
    ...lot,
    levels: allLevels[lot.id] || []
  }));

  const showingLevel = selectedLevel && selectedLevelDetails;
  const detailData = showingLevel
    ? selectedLevelDetails
    : (selectedLotDetails || parkingLots.find(l => l.id === selectedLot));

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Loading parking data...</p>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="header">
        <div className="header-content">
          <h1>CSUF Parking Availability</h1>
          <nav className="header-nav">
            <div className="dropdown">
              <button className="dropdown-button">Permits ▾</button>
              <div className="dropdown-content">
                <a href="https://csufparking.t2hosted.com/cmn/auth_ext.aspx" target="_blank" rel="noopener noreferrer">Parking Portal - Buy Permits</a>
                <a href="https://parking.fullerton.edu/student/?itemID=484f-877a-d31e45-0" target="_blank" rel="noopener noreferrer">Student Permit Types</a>
                <a href="https://parking.fullerton.edu/visitors/index.html?itemID=4a27-ace8-d31e45-0" target="_blank" rel="noopener noreferrer">Temporary Permits</a>
                <a href="https://parking.fullerton.edu/faq/?itemID=4282-be36-d31e340-2" target="_blank" rel="noopener noreferrer">Permit FAQs</a>
              </div>
            </div>
            <div className="dropdown">
              <button className="dropdown-button">Tickets ▾</button>
              <div className="dropdown-content">
                <a href="https://csufparking.t2hosted.com/cmn/auth_ext.aspx" target="_blank" rel="noopener noreferrer">Parking Portal - Pay/Appeal Citations</a>
                <a href="https://parking.fullerton.edu/visitors/?itemID=49cb-a9f2-d31e126-4" target="_blank" rel="noopener noreferrer">Visitor Parking Ticket Policies</a>
                <a href="https://parking.fullerton.edu/forms-policies/?itemID=420a-a61c-d31e173-17" target="_blank" rel="noopener noreferrer">Parking Ticket Policies</a>
              </div>
            </div>
            <div className="dropdown">
              <button className="dropdown-button">Resources ▾</button>
              <div className="dropdown-content">
                <a href="https://csufparking.t2hosted.com/cmn/auth_ext.aspx" target="_blank" rel="noopener noreferrer">Parking Portal</a>
                <a href="https://parking.fullerton.edu/student/" target="_blank" rel="noopener noreferrer">Student Parking Information</a>
                <a href="https://parking.fullerton.edu/faculty-staff/" target="_blank" rel="noopener noreferrer">Faculty/Staff Parking Information</a>
                <a href="https://parking.fullerton.edu/forms-policies/index.html" target="_blank" rel="noopener noreferrer">Forms and Policies</a>
                <a href="https://parking.fullerton.edu/visitors/index.html" target="_blank" rel="noopener noreferrer">Visitors</a>
                <a href="https://parking.fullerton.edu/maps/" target="_blank" rel="noopener noreferrer">Campus Map</a>
              </div>
            </div>
            <div className="dropdown">
              <button className="dropdown-button">Parking Events and Notices ▾</button>
              <div className="dropdown-content">
                <a href="https://parking.fullerton.edu/" target="_blank" rel="noopener noreferrer">Homepage</a>
              </div>
            </div>
          </nav>
        </div>
      </header>

      {announcements.some(a => a.message !== 'No Announcement') && (
        <section className="announcements">
          {announcements.filter(a => a.message !== 'No Announcement').map(announcement => (
            <div key={announcement.id} className={`announcement announcement-${announcement.priority}`}>
              <span className="announcement-icon">Announcement: </span>
              {announcement.title && <strong>{announcement.title}: </strong>}
              {announcement.message}
              {announcement.parking_lot_name && <span className="announcement-lot"> ({announcement.parking_lot_name})</span>}
            </div>
          ))}
        </section>
      )}

      {error && (
        <div className="error-banner">
          <span>Error: {error}</span>
          <button onClick={fetchParkingLots}>Retry</button>
        </div>
      )}

      <main className="main-content">
        <div className="content-grid">
          <section className="map-section">
            <div className="section-header">
              <h2>Parking Lots Map</h2>
              {lastUpdate && <span className="last-update">Last updated: {lastUpdate.toLocaleTimeString()}</span>}
            </div>
            <ParkingMap
              parkingLots={lotsWithLevels}
              selectedLot={selectedLot}
              selectedLevel={selectedLevel}
              onLotClick={handleLotClick}
              onLevelClick={handleLevelClick}
              filteredLotIds={filteredLotIds}
            />
          </section>

          <aside className="filter-section">
            <h3>Filter by Parking</h3>
            <div className="filter-options">
              {Object.keys(permitFilters).map(permitType => (
                <label key={permitType} className="filter-checkbox">
                  <input type="checkbox" checked={permitFilters[permitType]} onChange={() => handlePermitFilterChange(permitType)} />
                  <span>{permitType}</span>
                </label>
              ))}
            </div>
            <div className="filter-summary">
              <p>Showing {filteredLotIds.length} of {parkingLots.length} lots</p>
            </div>
          </aside>
        </div>

        {detailData && (
          <section className="lot-details">
            <div className="lot-details-header">
              <div className="lot-details-title">
                {showingLevel && (
                  <button className="back-button" onClick={handleBackToLot}>← Back</button>
                )}
                <h2>{detailData.name}</h2>
                {showingLevel && selectedLotDetails && (
                  <span className="detail-parent-name">{selectedLotDetails.name}</span>
                )}
              </div>
              <button className="close-button" onClick={handleCloseDetails} aria-label="Close details">✕</button>
            </div>

            <div className="details-grid">
              <div className="detail-card">
                <span className="detail-label">Available Spaces</span>
                <span className="detail-value available">{detailData.available_spots ?? 0}</span>
              </div>
              <div className="detail-card">
                <span className="detail-label">Total Capacity</span>
                <span className="detail-value">{detailData.total_spots}</span>
              </div>
              <div className="detail-card">
                <span className="detail-label">Occupancy Rate</span>
                <span className="detail-value">
                  {detailData.occupancy_percentage != null ? `${detailData.occupancy_percentage.toFixed(1)}%` : 'N/A'}
                </span>
              </div>
              {!showingLevel && (
                <div className="detail-card">
                  <span className="detail-label">Status</span>
                  <span className={`detail-value status-${detailData.status?.toLowerCase()}`}>{detailData.status || 'Unknown'}</span>
                </div>
              )}
            </div>

            {/* Level list — shown when viewing a lot with levels */}
            {!showingLevel && selectedLotDetails?.levels?.length > 0 && (
              <div className="levels-section">
                <h3 className="levels-title">Levels</h3>
                <div className="levels-grid">
                  {selectedLotDetails.levels.map(level => {
                    const occ = level.available_spots != null && level.total_spots > 0
                      ? (level.total_spots - level.available_spots) / level.total_spots * 100
                      : null;
                    return (
                      <button key={level.id} className="level-card" onClick={() => handleLevelClick(selectedLot, level.id)}>
                        <span className="level-card-name">{level.name}</span>
                        <span className="level-card-available">{level.available_spots ?? '?'} available</span>
                        {occ !== null && <span className="level-card-occ">{occ.toFixed(1)}% occupied</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="prediction-section">
              <h3>Next Hour Prediction</h3>
              <PredictionBlock prediction={detailData.prediction} />
            </div>

            {!showingLevel && detailData.permit_types?.length > 0 && (
              <div className="permit-types">
                <strong>Accepted Parking:</strong>
                <div className="permit-badges">
                  {detailData.permit_types.map(permit => (
                    <span key={permit} className="permit-badge">{permit}</span>
                  ))}
                </div>
              </div>
            )}

            {detailData.source_timestamp && (
              <p className="data-timestamp">Data from: {new Date(detailData.source_timestamp).toLocaleString()}</p>
            )}
          </section>
        )}
      </main>

      <footer className="footer">
        <p>Data sourced from CSUF Parking Services • This is an unofficial tool</p>
      </footer>
    </div>
  );
}

export default App;
