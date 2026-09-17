-- ============================================================
-- Migration 019: ECU Flash Archive — part_number, sw_version, extra_data
-- Adds:
--   part_number  TEXT   — OEM part number (e.g. 03L906018PJ)
--   sw_version   TEXT   — SW version string (e.g. 9978)
--   extra_data   JSONB  — catchall for any extra Key:Value pairs from parser
-- ============================================================

ALTER TABLE ecu_flash_archive
  ADD COLUMN IF NOT EXISTS part_number TEXT,
  ADD COLUMN IF NOT EXISTS sw_version  TEXT,
  ADD COLUMN IF NOT EXISTS extra_data  JSONB NOT NULL DEFAULT '{}'::jsonb;

-- GIN index for extra_data queries
CREATE INDEX IF NOT EXISTS idx_ecu_flash_archive_extra_data
  ON ecu_flash_archive USING GIN (extra_data);
