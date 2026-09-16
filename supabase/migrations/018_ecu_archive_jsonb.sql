-- ============================================================
-- Migration 018: ECU Flash Archive — Multi-file JSONB upgrade
-- Adds:
--   flash_files  JSONB  — array of {name, path, size}
--   images       JSONB  — array of {name, path}
--   engine_size  TEXT   — optional extra field
-- Keeps old TEXT columns for backward-compat (existing records safe)
-- Seeds default archive_custom_labels in app_settings
-- ============================================================

-- ── New columns on ecu_flash_archive ─────────────────────────

ALTER TABLE ecu_flash_archive
  ADD COLUMN IF NOT EXISTS flash_files  JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS images       JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS engine_size  TEXT;

-- ── GIN index for fast JSONB search ──────────────────────────

CREATE INDEX IF NOT EXISTS idx_ecu_flash_archive_flash_files
  ON ecu_flash_archive USING GIN (flash_files);

CREATE INDEX IF NOT EXISTS idx_ecu_flash_archive_images
  ON ecu_flash_archive USING GIN (images);

-- ── Seed default archive field label config in app_settings ──
-- Fields: hardware_id, ecu_module, car_name, engine_size
-- VIN, software_id, and notes are always visible; not configurable.

INSERT INTO app_settings (key, value)
VALUES (
  'archive_custom_labels',
  '{"hardware_id":{"label":"Hardware ID","visible":true},"ecu_module":{"label":"عائلة الوحدة / Module","visible":true},"car_name":{"label":"اسم السيارة","visible":true},"engine_size":{"label":"حجم المحرك","visible":true}}'
)
ON CONFLICT (key) DO NOTHING;
