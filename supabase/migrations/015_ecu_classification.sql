-- Migration 015: ECU Hierarchical Classification System
-- Adds manufacturer, ecu_family, vehicle_model_code, software_id,
-- quantity, and notes columns to the ecus table.
-- shelf_location was already added in migration 014.

ALTER TABLE ecus
  ADD COLUMN IF NOT EXISTS manufacturer       TEXT,
  ADD COLUMN IF NOT EXISTS ecu_family         TEXT,
  ADD COLUMN IF NOT EXISTS vehicle_model_code TEXT,
  ADD COLUMN IF NOT EXISTS software_id        TEXT,
  ADD COLUMN IF NOT EXISTS quantity           INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS notes              TEXT;

COMMENT ON COLUMN ecus.manufacturer       IS 'ECU manufacturer brand (e.g. BOSCH, SIM2K, DELPHI, CONTINENTAL)';
COMMENT ON COLUMN ecus.ecu_family         IS 'ECU family/series within manufacturer (e.g. 141, 241, 341, DCM)';
COMMENT ON COLUMN ecus.vehicle_model_code IS 'Vehicle model code this ECU targets (e.g. NF, MG, UN, TD, LM)';
COMMENT ON COLUMN ecus.software_id        IS 'Software or part ID variant (e.g. 2G330, 331, 332)';
COMMENT ON COLUMN ecus.quantity           IS 'Unit quantity per SKU entry (default 1)';
COMMENT ON COLUMN ecus.notes             IS 'Free-form technician notes about this ECU';
