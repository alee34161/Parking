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
  
  const [permitFilters, setPermitFilters] = useState({
    'Student Parking': true,
    'Employee Parking': true,
    'Resident Parking (non-freshmen)': true,
    'Hourly Parking': true
  });

  useEffect(() => {
    fetchParkingLots();
    fetchAnnouncements();
    
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
      setLastUpdate(new Date());
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
      console.log('Lot details with prediction:', data.data);
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
      <header className="header">
        <div className="header-content">
          <h1>CSUF Parking Availability</h1>
          <nav className="header-nav">
            <div className="dropdown">
              <button className="dropdown-button">Permits ▾</button>
              <div className="dropdown-content">
                <a href="https://csufparking.t2hosted.com/cmn/auth_ext.aspx" target="_blank" rel="noopener noreferrer">
                  Parking Portal - Buy Permits
                </a>
                <a href="https://parking.fullerton.edu/student/?itemID=484f-877a-d31e45-0" target="_blank" rel="noopener noreferrer">
                  Student Permit Types
                </a>
                <a href="https://parking.fullerton.edu/visitors/index.html?itemID=4a27-ace8-d31e45-0" target="_blank" rel="noopener noreferrer">
                  Temporary Permits
                </a>
                <a href="https://parking.fullerton.edu/faq/?itemID=4282-be36-d31e340-2" target="_blank" rel="noopener noreferrer">
                  Permit FAQs
                </a>
              </div>
            </div>

            <div className="dropdown">
              <button className="dropdown-button">Tickets ▾</button>
              <div className="dropdown-content">
                <a href="https://csufparking.t2hosted.com/cmn/auth_ext.aspx" target="_blank" rel="noopener noreferrer">
                  Parking Portal - Pay/Appeal Citations
                </a>
                <a href="https://parking.fullerton.edu/visitors/?itemID=49cb-a9f2-d31e126-4" target="_blank" rel="noopener noreferrer">
                  Visitor Parking Ticket Policies
                </a>
                <a href="https://parking.fullerton.edu/forms-policies/?itemID=420a-a61c-d31e173-17" target="_blank" rel="noopener noreferrer">
                  Parking Ticket Policies
                </a>
              </div>
            </div>

            <div className="dropdown">
              <button className="dropdown-button">Resources ▾</button>
              <div className="dropdown-content">
                <a href="https://csufparking.t2hosted.com/cmn/auth_ext.aspx" target="_blank" rel="noopener noreferrer">
                  Parking Portal
                </a>
                <a href="https://parking.fullerton.edu/student/" target="_blank" rel="noopener noreferrer">
                  Student Parking Information
                </a>
                <a href="https://parking.fullerton.edu/faculty-staff/" target="_blank" rel="noopener noreferrer">
                  Faculty/Staff Parking Information
                </a>
                <a href="https://parking.fullerton.edu/forms-policies/index.html" target="_blank" rel="noopener noreferrer">
                  Forms and Policies
                </a>
                <a href="https://parking.fullerton.edu/visitors/index.html" target="_blank" rel="noopener noreferrer">
                  Visitors
                </a>
                <a href="https://parking.fullerton.edu/maps/" target="_blank" rel="noopener noreferrer">
                  Campus Map
                </a>
              </div>
            </div>

            <div className="dropdown">
              <button className="dropdown-button">Parking Events and Notices ▾</button>
              <div className="dropdown-content">
                <a href="https://parking.fullerton.edu/" target="_blank" rel="noopener noreferrer">
                  Homepage
                </a>
              </div>
            </div>
          </nav>
        </div>
      </header>

      {announcements.length > 0 && (
        <section className="announcements">
          {announcements.map(announcement => (
            <div 
              key={announcement.id} 
              className={`announcement announcement-${announcement.priority}`}
            >
              <span className="announcement-icon">Announcement: </span>
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
          <span>Error: {error}</span>
          <button onClick={fetchParkingLots}>Retry</button>
        </div>
      )}

      <main className="main-content">
        <div className="content-grid">
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

          <aside className="filter-section">
            <h3>Filter by Parking</h3>
            <div className="filter-options">
              {Object.keys(permitFilters).map(permitType => (
                <label key={permitType} className="filter-checkbox">
                  <input
                    type="checkbox"
                    checked={permitFilters[permitType]}
                    onChange={() => handlePermitFilterChange(permitType)}
                  />
                  <span>{permitType}</span>
                </label>
              ))}
            </div>
            
            <div className="filter-summary">
              <p>
                Showing {filteredLotIds.length} of {parkingLots.length-1} lots
              </p>
            </div>
          </aside>
        </div>

        {selectedLotData && (
          <section className="lot-details">
            <div className="lot-details-header">
              <h2>{selectedLotData.name}</h2>
              <button 
                className="close-button" 
                onClick={() => {
                  setSelectedLot(null);
                  setSelectedLotDetails(null);
                }}
                aria-label="Close details"
              >
                ✕
              </button>
            </div>
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
            
            <div className="prediction-section">
              <h3>Next Hour Prediction</h3>
              {selectedLotData.prediction ? (
                selectedLotData.prediction.predicted_occupancy !== null ? (
                  <div className="prediction-content">
                    <div className="prediction-main">
                      <div className="prediction-stat">
                        <span className="prediction-label">Expected Available</span>
                        <span className="prediction-value prediction-available">
                          ~{selectedLotData.prediction.predicted_available} spots
                        </span>
                      </div>
                      <div className="prediction-stat">
                        <span className="prediction-label">Predicted Occupancy</span>
                        <span className="prediction-value prediction-occupancy">
                          {selectedLotData.prediction.predicted_occupancy.toFixed(1)}%
                        </span>
                      </div>
                      <div className="prediction-stat">
                        <span className="prediction-label">Confidence</span>
                        <span className={`prediction-badge confidence-${selectedLotData.prediction.confidence}`}>
                          {selectedLotData.prediction.confidence.replace('_', ' ').split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')} 
                          ({selectedLotData.prediction.confidence_percent}%)
                        </span>
                      </div>
                    </div>
                    {selectedLotData.prediction.message && (
                      <div className="prediction-meta">
                        <small>{selectedLotData.prediction.message}</small>
                      </div>
                    )}
                    {selectedLotData.prediction.data_points > 0 && (
                      <div className="prediction-meta">
                        <small>
                          Based on {selectedLotData.prediction.data_points} historical data points from similar 
                          {' '}{selectedLotData.prediction.based_on_day} patterns around {selectedLotData.prediction.based_on_hour}:00
                        </small>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="prediction-message">
                    {selectedLotData.prediction.message || 'Not enough historical data yet. System is collecting data.'}
                  </p>
                )
              ) : (
                <p className="prediction-message">
                  Prediction unavailable
                </p>
              )}
            </div>
            
            {selectedLotData.permit_types && selectedLotData.permit_types.length > 0 && (
              <div className="permit-types">
                <strong>Accepted Parking:</strong>
                <div className="permit-badges">
                  {selectedLotData.permit_types.map(permit => (
                    <span key={permit} className="permit-badge">{permit}</span>
                  ))}
                </div>
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

      <footer className="footer">
        <p>Data sourced from CSUF Parking Services • This is an unofficial tool</p>
      </footer>
    </div>
  );
}

export default App;
