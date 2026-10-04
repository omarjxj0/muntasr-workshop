-- ============================================================
-- Migration 022: Technician Assignment & Daily Shift Work
-- ============================================================

-- Add technician_name to visits
ALTER TABLE visits
  ADD COLUMN IF NOT EXISTS technician_name TEXT;

-- Add technician_name to quick_inspections
ALTER TABLE quick_inspections
  ADD COLUMN IF NOT EXISTS technician_name TEXT;

-- Indexes for performance filtering by technician
CREATE INDEX IF NOT EXISTS idx_visits_technician_name ON visits(technician_name);
CREATE INDEX IF NOT EXISTS idx_quick_inspections_technician_name ON quick_inspections(technician_name);
