-- Migration 014: Add shelf_location column to ecus table
-- Allows warehouse staff to record the physical shelf position of each ECU (e.g. A-3-2)

ALTER TABLE ecus
  ADD COLUMN IF NOT EXISTS shelf_location TEXT;

COMMENT ON COLUMN ecus.shelf_location IS 'Physical shelf/bin location in the warehouse (e.g. A-3-2). Format: Row-Shelf-Bin.';
