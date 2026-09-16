-- ============================================================
-- Migration 017: ECU Flash Archive & Data Bank (بنك ملفات العقول)
-- Creates: ecu_flash_archive table + ecu_vault storage policies
-- IMPORTANT: Create the "ecu_vault" bucket in Supabase Dashboard
--            (Storage → New Bucket → ecu_vault → Public: OFF)
--            before uploading files.
-- ============================================================

-- ── Table ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ecu_flash_archive (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identification fields (parsed from scan-tool logs)
  vin             TEXT,                         -- Barcode / VIN / Chassis
  software_id     TEXT,                         -- Calibration / SW ID
  hardware_id     TEXT,                         -- HW ID
  ecu_module      TEXT,                         -- Module family / ECU type
  car_name        TEXT,                         -- Vehicle description

  -- Storage references (Supabase Storage bucket: ecu_vault)
  flash_file_path TEXT,                         -- Path inside ecu_vault
  flash_file_name TEXT,                         -- Original filename (for download label)
  image_path      TEXT,                         -- ECU label / pinout photo path

  -- Notes
  notes           TEXT,                         -- e.g. Immo Off, Stage 1, Stock, Tuned

  -- Audit
  created_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Updated-At Trigger ───────────────────────────────────────

CREATE OR REPLACE FUNCTION update_ecu_flash_archive_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ecu_flash_archive_updated_at ON ecu_flash_archive;
CREATE TRIGGER trg_ecu_flash_archive_updated_at
  BEFORE UPDATE ON ecu_flash_archive
  FOR EACH ROW EXECUTE FUNCTION update_ecu_flash_archive_updated_at();

-- ── Indexes ──────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_ecu_flash_archive_vin         ON ecu_flash_archive(vin);
CREATE INDEX IF NOT EXISTS idx_ecu_flash_archive_software_id ON ecu_flash_archive(software_id);
CREATE INDEX IF NOT EXISTS idx_ecu_flash_archive_hardware_id ON ecu_flash_archive(hardware_id);
CREATE INDEX IF NOT EXISTS idx_ecu_flash_archive_created_at  ON ecu_flash_archive(created_at DESC);

-- ── Row Level Security ───────────────────────────────────────

ALTER TABLE ecu_flash_archive ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read all archive records
CREATE POLICY "ecu_flash_archive_auth_select"
  ON ecu_flash_archive
  FOR SELECT
  TO authenticated
  USING (true);

-- Admins can insert new records
CREATE POLICY "ecu_flash_archive_admin_insert"
  ON ecu_flash_archive
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  );

-- Admins can update records
CREATE POLICY "ecu_flash_archive_admin_update"
  ON ecu_flash_archive
  FOR UPDATE
  TO authenticated
  USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  );

-- Admins can delete records
CREATE POLICY "ecu_flash_archive_admin_delete"
  ON ecu_flash_archive
  FOR DELETE
  TO authenticated
  USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  );

-- ── Storage Policies for ecu_vault bucket ────────────────────
-- Run AFTER creating the "ecu_vault" bucket in Supabase Dashboard.

DROP POLICY IF EXISTS "ecu_vault_auth_select"  ON storage.objects;
DROP POLICY IF EXISTS "ecu_vault_auth_insert"  ON storage.objects;
DROP POLICY IF EXISTS "ecu_vault_auth_update"  ON storage.objects;
DROP POLICY IF EXISTS "ecu_vault_auth_delete"  ON storage.objects;

-- Authenticated users can read (needed for signed URL downloads)
CREATE POLICY "ecu_vault_auth_select"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'ecu_vault');

-- Authenticated users can upload
CREATE POLICY "ecu_vault_auth_insert"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'ecu_vault');

-- Authenticated users can overwrite
CREATE POLICY "ecu_vault_auth_update"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'ecu_vault');

-- Admins can delete objects
CREATE POLICY "ecu_vault_auth_delete"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'ecu_vault');
