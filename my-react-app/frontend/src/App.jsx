import { useState, useEffect } from 'react';
import ParkingMap from './components/ParkingMap';
import './App.css';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

function App() {
  const [parkingLots, setParkingLots] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [selectedLot, setSelectedLot] = useState(null);
  const [selectedLotDetails, setSelectedLotDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);
  
  // Filter state
  const [permitFilters, setPermitFilters] = useState({
    A: true,
    B: true,
    Student: true,
    Faculty: true
  });

  // Fetch parking lots
  useEffect(() => {
    fetchParkingLots();
    fetchAnnouncements();
    
    // Refresh every 5 minutes
    const interval = setInterval(() => {
      fetchParkingLots();
      fetchAnnouncements();
    }, 5 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, []);

  const fetchParkingLots = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/parking/lots`);
      if (!response.ok) throw new Error('Failed to fetch parking data');
      
      const data = await response.json();
      setParkingLots(data.data);
      setLastUpdate(new Date(data.timestamp));
      setLoading(false);
      setError(null);
    } catch (err) {
      console.error('Error fetching parking lots:', err);
      setError('Failed to load parking data. Please try again later.');
      setLoading(false);
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
    setSelectedLot(lotId);
    
    try {
      const response = await fetch(`${API_BASE_URL}/parking/lots/${lotId}`);
      if (!response.ok) throw new Error('Failed to fetch lot details');
      
      const data = await response.json();
      setSelectedLotDetails(data.data);
    } catch (err) {
      console.error('Error fetching lot details:', err);
    }
  };

  const handlePermitFilterChange = (permitType) => {
    setPermitFilters(prev => ({
      ...prev,
      [permitType]: !prev[permitType]
    }));
  };

  // Get filtered lot IDs
  const getFilteredLotIds = () => {
    const activePermits = Object.keys(permitFilters).filter(key => permitFilters[key]);
    
    return parkingLots
      .filter(lot => {
        if (!lot.permit_types || lot.permit_types.length === 0) return true;
        return lot.permit_types.some(permit => activePermits.includes(permit));
      })
      .map(lot => lot.id);
  };

  const filteredLotIds = getFilteredLotIds();
  const selectedLotData = selectedLotDetails || parkingLots.find(lot => lot.id === selectedLot);

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
      {/* Header */}
      <header className="header">
        <div className="header-content">
          <h1>CSUF Parking Availability</h1>
          <nav className="header-links">
            <a href="https://parking.fullerton.edu" target="_blank" rel="noopener noreferrer">
              Parking Services
            </a>
            <a href="https://parking.fullerton.edu/permits/" target="_blank" rel="noopener noreferrer">
              Buy Permits
            </a>
            <a href="https://parking.fullerton.edu/transportation/" target="_blank" rel="noopener noreferrer">
              Transportation
            </a>
            <a href="https://parking.fullerton.edu/ParkMobile.aspx" target="_blank" rel="noopener noreferrer">
              ParkMobile
            </a>
          </nav>
        </div>
      </header>

      {/* Service Announcements */}
      {announcements.length > 0 && (
        <section className="announcements">
          {announcements.map(announcement => (
            <div 
              key={announcement.id} 
              className={`announcement announcement-${announcement.priority}`}
            >
              <span className="announcement-icon">ℹ️</span>
              {announcement.title && <strong>{announcement.title}: </strong>}
              {announcement.message}
              {announcement.parking_lot_name && (
                <span className="announcement-lot"> ({announcement.parking_lot_name})</span>
              )}
            </div>
          ))}
        </section>
      )}

      {error && (
        <div className="error-banner">
          <span>⚠️ {error}</span>
          <button onClick={fetchParkingLots}>Retry</button>
        </div>
      )}

      {/* Main Content */}
      <main className="main-content">
        <div className="content-grid">
          {/* Map Section */}
          <section className="map-section">
            <div className="section-header">
              <h2>Parking Lots Map</h2>
              {lastUpdate && (
                <span className="last-update">
                  Last updated: {lastUpdate.toLocaleTimeString()}
                </span>
              )}
            </div>
            <ParkingMap 
              parkingLots={parkingLots}
              selectedLot={selectedLot}
              onLotClick={handleLotClick}
              filteredLotIds={filteredLotIds}
            />
          </section>

          {/* Filter Section */}
          <aside className="filter-section">
            <h3>Filter by Permit</h3>
            <div className="filter-options">
              {Object.keys(permitFilters).map(permitType => (
                <label key={permitType} className="filter-checkbox">
                  <input
                    type="checkbox"
                    checked={permitFilters[permitType]}
                    onChange={() => handlePermitFilterChange(permitType)}
                  />
                  <span>{permitType} Permit</span>
                </label>
              ))}
            </div>
            
            <div className="filter-summary">
              <p>
                Showing {filteredLotIds.length} of {parkingLots.length} lots
              </p>
            </div>
          </aside>
        </div>

        {/* Selected Lot Details */}
        {selectedLotData && (
          <section className="lot-details">
            <h2>{selectedLotData.name}</h2>
            <div className="details-grid">
              <div className="detail-card">
                <span className="detail-label">Available Spaces</span>
                <span className="detail-value available">
                  {selectedLotData.available_spots || 0}
                </span>
              </div>
              <div className="detail-card">
                <span className="detail-label">Total Capacity</span>
                <span className="detail-value">{selectedLotData.total_spots}</span>
              </div>
              <div className="detail-card">
                <span className="detail-label">Occupancy Rate</span>
                <span className="detail-value">
                  {selectedLotData.occupancy_percentage 
                    ? `${selectedLotData.occupancy_percentage.toFixed(1)}%`
                    : 'N/A'
                  }
                </span>
              </div>
              <div className="detail-card">
                <span className="detail-label">Status</span>
                <span className={`detail-value status-${selectedLotData.status?.toLowerCase()}`}>
                  {selectedLotData.status || 'Unknown'}
                </span>
              </div>
            </div>
            
            {selectedLotData.permit_types && selectedLotData.permit_types.length > 0 && (
              <div className="permit-types">
                <strong>Accepted Permits:</strong>
                <div className="permit-badges">
                  {selectedLotData.permit_types.map(permit => (
                    <span key={permit} className="permit-badge">{permit}</span>
                  ))}
                </div>
              </div>
            )}
            
            {selectedLotData.is_structure && (
              <div className="lot-info">
                <span className="info-badge">🏢 Parking Structure</span>
              </div>
            )}
            
            {selectedLotData.source_timestamp && (
              <p className="data-timestamp">
                Data from: {new Date(selectedLotData.source_timestamp).toLocaleString()}
              </p>
            )}
          </section>
        )}
      </main>

      {/* Footer */}
      <footer className="footer">
        <p>Data sourced from CSUF Parking Services</p>
        <p>This is an unofficial tool. For official information, visit parking.fullerton.edu</p>
      </footer>
    </div>
  );
}

export default App;
