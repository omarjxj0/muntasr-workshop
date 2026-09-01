-- ============================================================
-- Montaser Workshop — Migration 009: Cascade Delete Safety
-- ============================================================
-- This migration ensures all critical foreign keys use
-- ON DELETE CASCADE so that deleting a parent record
-- automatically cleans up all child records.
--
-- Existing cascades in 001_schema.sql (already correct):
--   vehicles.customer_id  → customers(id)  ON DELETE CASCADE ✓
--   visits.vehicle_id     → vehicles(id)   ON DELETE CASCADE ✓
--   used_parts.visit_id   → visits(id)     ON DELETE CASCADE ✓
--   daily_wages.employee_id → employees(id) ON DELETE CASCADE ✓
--
-- Migration 006_visit_images.sql also already has CASCADE:
--   visit_images.visit_id → visits(id)     ON DELETE CASCADE ✓
--
-- This migration explicitly re-affirms the visit_images FK
-- using DROP + ADD to guarantee the constraint is correct
-- regardless of any prior manual schema changes.
-- ============================================================

-- ── visit_images → visits (re-affirm CASCADE) ────────────
ALTER TABLE visit_images
  DROP CONSTRAINT IF EXISTS visit_images_visit_id_fkey;

ALTER TABLE visit_images
  ADD CONSTRAINT visit_images_visit_id_fkey
    FOREIGN KEY (visit_id)
    REFERENCES visits(id)
    ON DELETE CASCADE;

-- ── used_parts → visits (re-affirm CASCADE) ──────────────
ALTER TABLE used_parts
  DROP CONSTRAINT IF EXISTS used_parts_visit_id_fkey;

ALTER TABLE used_parts
  ADD CONSTRAINT used_parts_visit_id_fkey
    FOREIGN KEY (visit_id)
    REFERENCES visits(id)
    ON DELETE CASCADE;

-- ── visits → vehicles (re-affirm CASCADE) ────────────────
ALTER TABLE visits
  DROP CONSTRAINT IF EXISTS visits_vehicle_id_fkey;

ALTER TABLE visits
  ADD CONSTRAINT visits_vehicle_id_fkey
    FOREIGN KEY (vehicle_id)
    REFERENCES vehicles(id)
    ON DELETE CASCADE;

-- ── vehicles → customers (re-affirm CASCADE) ─────────────
ALTER TABLE vehicles
  DROP CONSTRAINT IF EXISTS vehicles_customer_id_fkey;

ALTER TABLE vehicles
  ADD CONSTRAINT vehicles_customer_id_fkey
    FOREIGN KEY (customer_id)
    REFERENCES customers(id)
    ON DELETE CASCADE;

-- ── daily_wages → employees (re-affirm CASCADE) ──────────
ALTER TABLE daily_wages
  DROP CONSTRAINT IF EXISTS daily_wages_employee_id_fkey;

ALTER TABLE daily_wages
  ADD CONSTRAINT daily_wages_employee_id_fkey
    FOREIGN KEY (employee_id)
    REFERENCES employees(id)
    ON DELETE CASCADE;
