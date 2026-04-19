DROP TABLE IF EXISTS service_announcements;
DROP TABLE IF EXISTS parking_snapshots;
DROP TABLE IF EXISTS parking_lots;
DROP TABLE IF EXISTS parking_level_snapshots;
DROP TABLE IF EXISTS parking_levels;

CREATE TABLE parking_lots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    total_spots INTEGER NOT NULL,
    latitude REAL,
    longitude REAL,
    polygon_coordinates TEXT,
    permit_types TEXT,
    badge_offset TEXT,
    description TEXT,
    is_structure INTEGER DEFAULT 0,
    has_levels INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_active ON parking_lots(is_active);
CREATE INDEX idx_name ON parking_lots(name);

CREATE TABLE parking_snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    parking_lot_id INTEGER NOT NULL,
    available_spots INTEGER NOT NULL,
    total_spots INTEGER NOT NULL,
    occupancy_percentage REAL,
    status TEXT DEFAULT 'Open',
    source_timestamp TEXT,
    scraped_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (parking_lot_id) REFERENCES parking_lots(id) ON DELETE CASCADE
);

CREATE INDEX idx_lot_time ON parking_snapshots(parking_lot_id, scraped_at);
CREATE INDEX idx_scraped_at ON parking_snapshots(scraped_at);

CREATE TABLE service_announcements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT,
    message TEXT NOT NULL,
    priority TEXT DEFAULT 'medium',
    parking_lot_id INTEGER,
    is_active INTEGER DEFAULT 1,
    start_date TEXT,
    end_date TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (parking_lot_id) REFERENCES parking_lots(id) ON DELETE SET NULL
);

CREATE INDEX idx_active_dates ON service_announcements(is_active, start_date, end_date);

CREATE TABLE parking_levels (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    parking_lot_id INTEGER NOT NULL,
    level_number INTEGER NOT NULL,
    name TEXT NOT NULL,
    total_spots INTEGER NOT NULL,
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (parking_lot_id) REFERENCES parking_lots(id) ON DELETE CASCADE,
    UNIQUE(parking_lot_id, level_number)
);

CREATE INDEX idx_levels_lot ON parking_levels(parking_lot_id);

CREATE TABLE parking_level_snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    parking_level_id INTEGER,
    available_spots INTEGER NOT NULL,
    total_spots INTEGER NOT NULL,
    occupancy_percentage REAL,
    source_timestamp TEXT,
    scraped_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (parking_level_id) REFERENCES parking_levels(id) ON DELETE CASCADE
);

CREATE INDEX idx_level_snapshots_level_time ON parking_level_snapshots(parking_level_id, scraped_at);
CREATE INDEX idx_level_snapshots_scraped ON parking_level_snapshots(scraped_at);

CREATE TRIGGER calculate_level_occupancy
AFTER INSERT ON parking_level_snapshots
BEGIN
    UPDATE parking_level_snapshots
    SET occupancy_percentage = ((NEW.total_spots - NEW.available_spots) * 100.0 / NEW.total_spots)
    WHERE id = NEW.id;
END;

INSERT INTO parking_lots (name, total_spots, is_structure, has_levels, permit_types, badge_offset) VALUES
('Nutwood Structure', 2484, 1, 1, '["A","B","Student"]', NULL),
('State College Structure', 1373, 1, 1, '["A","B","Student"]', NULL),
('Eastside North', 1880, 0, 0, '["A","Student"]', 'left'),
('Eastside South', 1341, 0, 0, '["A","Student"]', 'right'),
('S8 and S10', 2104, 0, 0, '["Student"]', NULL),
('Fullerton Free Church', 800, 0, 0, '["Student"]', NULL);
