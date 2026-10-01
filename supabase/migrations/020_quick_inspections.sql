-- ============================================================
-- Migration 020: Quick Inspections (سجل الفحوصات السريعة)
-- Creates: quick_inspections table + inspection_images storage policies
-- IMPORTANT: Create the "inspection_images" bucket in Supabase Dashboard
--            (Storage → New Bucket → inspection_images → Public: OFF)
--            before uploading files.
-- ============================================================

-- ── Enum: Inspection type ─────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE inspection_type AS ENUM ('car', 'ecu');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── Table ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS quick_inspections (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Type: car scan vs ECU bench test
  type            inspection_type NOT NULL DEFAULT 'car',

  -- Customer info
  customer_name   TEXT        NOT NULL,
  phone           TEXT,

  -- Subject (either car model or ECU type)
  subject         TEXT,                    -- e.g. "سنتافي 2018" or "SIM2K-241 سوناتا"

  -- Fault / diagnostic data
  fault_codes     TEXT,                    -- DTC codes or diagnostic summary

  -- Image paths in Supabase Storage bucket: inspection_images
  image_paths     JSONB       NOT NULL DEFAULT '[]',   -- array of { name, path, size }

  -- Financial
  inspection_fee  NUMERIC(12, 0) NOT NULL DEFAULT 0,

  -- Notes
  notes           TEXT,

  -- Audit
  created_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Updated-At Trigger ───────────────────────────────────────

CREATE OR REPLACE FUNCTION update_quick_inspections_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_quick_inspections_updated_at ON quick_inspections;
CREATE TRIGGER trg_quick_inspections_updated_at
  BEFORE UPDATE ON quick_inspections
  FOR EACH ROW EXECUTE FUNCTION update_quick_inspections_updated_at();

-- ── Indexes ──────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_quick_inspections_customer_name ON quick_inspections(customer_name);
CREATE INDEX IF NOT EXISTS idx_quick_inspections_type          ON quick_inspections(type);
CREATE INDEX IF NOT EXISTS idx_quick_inspections_created_at   ON quick_inspections(created_at DESC);

-- ── Row Level Security ───────────────────────────────────────

ALTER TABLE quick_inspections ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read inspections
CREATE POLICY "quick_inspections_auth_select"
  ON quick_inspections
  FOR SELECT
  TO authenticated
  USING (true);

-- All authenticated users can insert inspections
CREATE POLICY "quick_inspections_auth_insert"
  ON quick_inspections
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- Admins can update
CREATE POLICY "quick_inspections_admin_update"
  ON quick_inspections
  FOR UPDATE
  TO authenticated
  USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  );

-- Admins can delete
CREATE POLICY "quick_inspections_admin_delete"
  ON quick_inspections
  FOR DELETE
  TO authenticated
  USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  );

-- ── Storage Policies for inspection_images bucket ─────────────
-- Run AFTER creating the "inspection_images" bucket in Supabase Dashboard.

DROP POLICY IF EXISTS "inspection_images_auth_select" ON storage.objects;
DROP POLICY IF EXISTS "inspection_images_auth_insert" ON storage.objects;
DROP POLICY IF EXISTS "inspection_images_auth_update" ON storage.objects;
DROP POLICY IF EXISTS "inspection_images_admin_delete" ON storage.objects;

-- Authenticated users can view (for signed URLs)
CREATE POLICY "inspection_images_auth_select"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'inspection_images');

-- Authenticated users can upload
CREATE POLICY "inspection_images_auth_insert"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'inspection_images');

-- Authenticated users can overwrite
CREATE POLICY "inspection_images_auth_update"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'inspection_images');

-- Admins can delete objects
CREATE POLICY "inspection_images_admin_delete"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'inspection_images'
    AND (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  );
