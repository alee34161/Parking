-- AWS Aurora MySQL Database Schema for Parking App

-- Drop tables if they exist (for development - remove in production)
DROP TABLE IF EXISTS service_announcements;
DROP TABLE IF EXISTS parking_snapshots;
DROP TABLE IF EXISTS parking_lots;

-- Parking Lots Table
CREATE TABLE parking_lots (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    total_spots INT NOT NULL,
    
    -- Coordinates for map display
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    
    -- Polygon coordinates stored as JSON
    -- Example: [{"lat": 33.123, "lng": -117.456}, ...]
    polygon_coordinates JSON,
    
    -- Permit types (stored as JSON array)
    -- Example: ["A", "B", "Student", "Faculty"]
    permit_types JSON,
    
    -- Additional metadata
    description TEXT,
    is_structure BOOLEAN DEFAULT FALSE,
    has_levels BOOLEAN DEFAULT FALSE,
    
    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_active (is_active),
    INDEX idx_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Parking Snapshots Table (Historical availability data)
CREATE TABLE parking_snapshots (
    id INT AUTO_INCREMENT PRIMARY KEY,
    parking_lot_id INT NOT NULL,
    
    -- Availability data
    available_spots INT NOT NULL,
    total_spots INT NOT NULL,
    occupancy_percentage DECIMAL(5, 2) GENERATED ALWAYS AS (
        ((total_spots - available_spots) / total_spots) * 100
    ) STORED,
    
    -- Status from source
    status VARCHAR(50) DEFAULT 'Open', -- Open, Closed, Limited
    
    -- Source timestamp (from the parking website)
    source_timestamp TIMESTAMP NULL,
    
    -- Our scrape timestamp
    scraped_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (parking_lot_id) REFERENCES parking_lots(id) ON DELETE CASCADE,
    INDEX idx_lot_time (parking_lot_id, scraped_at),
    INDEX idx_scraped_at (scraped_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Service Announcements Table
CREATE TABLE service_announcements (
    id INT AUTO_INCREMENT PRIMARY KEY,
    
    -- Announcement content
    title VARCHAR(255),
    message TEXT NOT NULL,
    
    -- Priority level
    priority ENUM('low', 'medium', 'high', 'critical') DEFAULT 'medium',
    
    -- Associated parking lot (optional)
    parking_lot_id INT NULL,
    
    -- Visibility
    is_active BOOLEAN DEFAULT TRUE,
    start_date DATE,
    end_date DATE,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (parking_lot_id) REFERENCES parking_lots(id) ON DELETE SET NULL,
    INDEX idx_active_dates (is_active, start_date, end_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert initial parking lot data (you'll need to add coordinates and polygons)
INSERT INTO parking_lots (name, total_spots, is_structure, has_levels, permit_types) VALUES
('Nutwood Structure', 2484, TRUE, TRUE, JSON_ARRAY('A', 'B', 'Student')),
('State College Structure', 1373, TRUE, TRUE, JSON_ARRAY('A', 'B', 'Student')),
('Eastside North', 1880, FALSE, FALSE, JSON_ARRAY('A', 'Student')),
('Eastside South', 1341, FALSE, FALSE, JSON_ARRAY('A', 'Student')),
('S8 and S10', 2104, FALSE, FALSE, JSON_ARRAY('Student')),
('Fullerton Free Church', 800, FALSE, FALSE, JSON_ARRAY('Student'));

-- Create a view for latest parking availability
CREATE OR REPLACE VIEW latest_parking_availability AS
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
AND pl.is_active = TRUE;
