-- ============================================================
-- Montaser Workshop — App Settings Table
-- ============================================================

-- ── App Settings (global key-value store) ─────────────────
CREATE TABLE app_settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Seed default values ────────────────────────────────────
INSERT INTO app_settings (key, value) VALUES
  ('app_name',     'ورشة منتصر'),
  ('app_subtitle', 'كهرباء السيارات'),
  ('logo_url',     '');

-- ── RLS: allow authenticated users to read, only admins to write ──
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "app_settings_read_all"
  ON app_settings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "app_settings_write_admin"
  ON app_settings FOR ALL
  TO authenticated
  USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  )
  WITH CHECK (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  );
