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
    
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    
    polygon_coordinates JSON,

    permit_types JSON,
    badge_offset VARCHAR(20) DEFAULT NULL,
    
    description TEXT,
    is_structure BOOLEAN DEFAULT FALSE,
    has_levels BOOLEAN DEFAULT FALSE,
    
    is_active BOOLEAN DEFAULT TRUE,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_active (is_active),
    INDEX idx_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Parking Snapshots Table (Historical availability data)
CREATE TABLE parking_snapshots (
    id INT AUTO_INCREMENT PRIMARY KEY,
    parking_lot_id INT NOT NULL,
    
    available_spots INT NOT NULL,
    total_spots INT NOT NULL,
    occupancy_percentage DECIMAL(5, 2) GENERATED ALWAYS AS (
        ((total_spots - available_spots) / total_spots) * 100
    ) STORED,
    
    status VARCHAR(50) DEFAULT 'Open', -- Open, Closed, Limited
    
    source_timestamp TIMESTAMP NULL,
    
    scraped_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (parking_lot_id) REFERENCES parking_lots(id) ON DELETE CASCADE,
    INDEX idx_lot_time (parking_lot_id, scraped_at),
    INDEX idx_scraped_at (scraped_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Service Announcements Table
CREATE TABLE service_announcements (
    id INT AUTO_INCREMENT PRIMARY KEY,
    
    title VARCHAR(255),
    message TEXT NOT NULL,
    
    priority ENUM('low', 'medium', 'high', 'critical') DEFAULT 'medium',
    
    parking_lot_id INT NULL,
    
    is_active BOOLEAN DEFAULT TRUE,
    start_date DATE,
    end_date DATE,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (parking_lot_id) REFERENCES parking_lots(id) ON DELETE SET NULL,
    INDEX idx_active_dates (is_active, start_date, end_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert initial parking lot data
INSERT INTO parking_lots (name, total_spots, is_structure, has_levels, permit_types, badge_offset) VALUES
('Nutwood Structure', 2484, TRUE, TRUE, JSON_ARRAY('A', 'B', 'Student'), NULL),
('State College Structure', 1373, TRUE, TRUE, JSON_ARRAY('A', 'B', 'Student'), NULL),
('Eastside North', 1880, FALSE, FALSE, JSON_ARRAY('A', 'Student'), 'left'),
('Eastside South', 1341, FALSE, FALSE, JSON_ARRAY('A', 'Student'), 'right'),
('S8 and S10', 2104, FALSE, FALSE, JSON_ARRAY('Student'), NULL),
('Fullerton Free Church', 800, FALSE, FALSE, JSON_ARRAY('Student'), NULL);

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
    pl.badge_offset,
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
