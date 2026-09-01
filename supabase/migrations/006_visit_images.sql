-- ============================================================
-- Montaser Workshop — Visit Images (Supabase Storage refs)
-- ============================================================

-- ── Table to track image attachments per visit ─────────────
CREATE TABLE IF NOT EXISTS visit_images (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  visit_id    UUID NOT NULL REFERENCES visits(id) ON DELETE CASCADE,
  image_url   TEXT NOT NULL,
  file_name   TEXT,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_visit_images_visit_id ON visit_images(visit_id);

-- ── RLS ────────────────────────────────────────────────────
ALTER TABLE visit_images ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "visit_images_read_authenticated" ON visit_images;
CREATE POLICY "visit_images_read_authenticated"
  ON visit_images FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "visit_images_insert_authenticated" ON visit_images;
CREATE POLICY "visit_images_insert_authenticated"
  ON visit_images FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "visit_images_delete_authenticated" ON visit_images;
CREATE POLICY "visit_images_delete_authenticated"
  ON visit_images FOR DELETE
  TO authenticated USING (true);

-- ──────────────────────────────────────────────────────────
-- IMPORTANT: You must also create a Supabase Storage bucket
-- named "visit-images" with public access enabled.
-- Go to: Storage → New Bucket → Name: "visit-images" → Public: ON
-- ──────────────────────────────────────────────────────────
