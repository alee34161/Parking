-- SQLite Database Schema for Parking App

-- Drop tables if they exist
DROP TABLE IF EXISTS service_announcements;
DROP TABLE IF EXISTS parking_snapshots;
DROP TABLE IF EXISTS parking_lots;

-- Parking Lots Table
CREATE TABLE parking_lots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    total_spots INTEGER NOT NULL,
    
    -- Coordinates for map display
    latitude REAL,
    longitude REAL,
    
    -- Polygon coordinates stored as JSON text
    polygon_coordinates TEXT,
    
    -- Permit types (stored as JSON text)
    permit_types TEXT,
    
    -- Additional metadata
    description TEXT,
    is_structure INTEGER DEFAULT 0,
    has_levels INTEGER DEFAULT 0,
    
    -- Status
    is_active INTEGER DEFAULT 1,
    
    -- Timestamps
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_active ON parking_lots(is_active);
CREATE INDEX idx_name ON parking_lots(name);

-- Parking Snapshots Table (Historical availability data)
CREATE TABLE parking_snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    parking_lot_id INTEGER NOT NULL,
    
    -- Availability data
    available_spots INTEGER NOT NULL,
    total_spots INTEGER NOT NULL,
    occupancy_percentage REAL,
    
    -- Status from source
    status TEXT DEFAULT 'Open',
    
    -- Source timestamp (from the parking website)
    source_timestamp TEXT,
    
    -- Our scrape timestamp
    scraped_at TEXT DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (parking_lot_id) REFERENCES parking_lots(id) ON DELETE CASCADE
);

CREATE INDEX idx_lot_time ON parking_snapshots(parking_lot_id, scraped_at);
CREATE INDEX idx_scraped_at ON parking_snapshots(scraped_at);

-- Trigger to calculate occupancy percentage
CREATE TRIGGER calculate_occupancy 
AFTER INSERT ON parking_snapshots
BEGIN
    UPDATE parking_snapshots 
    SET occupancy_percentage = ((NEW.total_spots - NEW.available_spots) * 100.0 / NEW.total_spots)
    WHERE id = NEW.id;
END;

-- Service Announcements Table
CREATE TABLE service_announcements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    
    -- Announcement content
    title TEXT,
    message TEXT NOT NULL,
    
    -- Priority level
    priority TEXT DEFAULT 'medium',
    
    -- Associated parking lot (optional)
    parking_lot_id INTEGER,
    
    -- Visibility
    is_active INTEGER DEFAULT 1,
    start_date TEXT,
    end_date TEXT,
    
    -- Timestamps
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (parking_lot_id) REFERENCES parking_lots(id) ON DELETE SET NULL
);

CREATE INDEX idx_active_dates ON service_announcements(is_active, start_date, end_date);

-- Insert initial parking lot data
INSERT INTO parking_lots (name, total_spots, is_structure, has_levels, permit_types) VALUES
('Nutwood Structure', 2484, 1, 1, '["A", "B", "Student"]'),
('State College Structure', 1373, 1, 1, '["A", "B", "Student"]'),
('Eastside North', 1880, 0, 0, '["A", "Student"]'),
('Eastside South', 1341, 0, 0, '["A", "Student"]'),
('S8 and S10', 2104, 0, 0, '["Student"]'),
('Fullerton Free Church', 800, 0, 0, '["Student"]');

-- Create view for latest parking availability
CREATE VIEW latest_parking_availability AS
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
    ps.available_spots,
    ps.occupancy_percentage,
    ps.status,
    ps.source_timestamp,
    ps.scraped_at
FROM parking_lots pl
LEFT JOIN parking_snapshots ps ON pl.id = ps.parking_lot_id
WHERE ps.id = (
    SELECT id 
    FROM parking_snapshots 
    WHERE parking_lot_id = pl.id 
    ORDER BY scraped_at DESC 
    LIMIT 1
)
AND pl.is_active = 1;
