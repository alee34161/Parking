-- SQLite Database Schema for Parking App
-- Migration-safe: only drops/recreates level tables, preserves existing data

-- Drop level tables (safe to recreate)
DROP TABLE IF EXISTS parking_level_snapshots;
DROP TABLE IF EXISTS parking_levels;

-- NOTE: Do NOT drop parking_lots, parking_snapshots, or service_announcements
-- Those preserve existing data and structure

-- ─────────────────────────────────────────────
-- Parking Levels Table
-- One row per level per structure (static metadata)
-- ─────────────────────────────────────────────
CREATE TABLE parking_levels (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    parking_lot_id INTEGER NOT NULL,

    level_number INTEGER NOT NULL,       -- LevelID from API (1, 2, 3...)
    name TEXT NOT NULL,                  -- e.g. "Nutwood Level 1"
    total_spots INTEGER NOT NULL,

    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (parking_lot_id) REFERENCES parking_lots(id) ON DELETE CASCADE,
    UNIQUE(parking_lot_id, level_number)
);

CREATE INDEX idx_levels_lot ON parking_levels(parking_lot_id);

-- ─────────────────────────────────────────────
-- Parking Level Snapshots Table
-- Historical availability per level per scrape
-- ─────────────────────────────────────────────
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

-- Trigger to auto-calculate occupancy on insert
CREATE TRIGGER calculate_level_occupancy
AFTER INSERT ON parking_level_snapshots
BEGIN
    UPDATE parking_level_snapshots
    SET occupancy_percentage = ((NEW.total_spots - NEW.available_spots) * 100.0 / NEW.total_spots)
    WHERE id = NEW.id;
END;
