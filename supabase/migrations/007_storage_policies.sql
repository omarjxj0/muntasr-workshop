-- ============================================================
-- Montaser Workshop — Storage RLS Policies for visit-images
-- ============================================================
-- Run this AFTER creating the "visit-images" bucket in the
-- Supabase Dashboard (Storage → New Bucket → visit-images → Public: ON)
-- ============================================================

-- ── DROP any pre-existing policies to avoid conflicts ───────
DROP POLICY IF EXISTS "visit_images_public_select"   ON storage.objects;
DROP POLICY IF EXISTS "visit_images_auth_insert"     ON storage.objects;
DROP POLICY IF EXISTS "visit_images_auth_delete"     ON storage.objects;
DROP POLICY IF EXISTS "visit_images_auth_update"     ON storage.objects;

-- ── SELECT: anyone (including unauthenticated) can read ─────
-- Needed so that <img> tags load without a signed URL.
CREATE POLICY "visit_images_public_select"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'visit-images');

-- ── INSERT: only authenticated users can upload ─────────────
CREATE POLICY "visit_images_auth_insert"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'visit-images');

-- ── UPDATE: authenticated users can overwrite their uploads ─
CREATE POLICY "visit_images_auth_update"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'visit-images');

-- ── DELETE: authenticated users can remove objects ──────────
CREATE POLICY "visit_images_auth_delete"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'visit-images');

-- ============================================================
-- NOTE: If your Supabase project already has a wildcard policy
-- on storage.objects (e.g. "Give users access to own folder"),
-- you may need to remove it first to avoid policy conflicts.
-- ============================================================
