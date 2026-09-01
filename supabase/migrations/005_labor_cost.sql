-- ============================================================
-- Montaser Workshop — Visit Labor Cost Column
-- ============================================================

-- ── Add labor_cost to visits ───────────────────────────────
-- Stored in full Iraqi Dinar value (e.g., 120000 for 120k IQD).
-- The UI multiplies user input × 1000 before saving.
-- This column is intentionally separate from total_amount
-- (which is auto-calculated from used_parts by trigger).
-- The grand total shown to the user = total_amount + labor_cost.
ALTER TABLE visits
  ADD COLUMN IF NOT EXISTS labor_cost DECIMAL(12, 2) NOT NULL DEFAULT 0.00;
