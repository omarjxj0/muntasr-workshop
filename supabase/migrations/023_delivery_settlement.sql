-- ============================================================
-- Migration 023: Delivery Date Settlement Columns
-- ============================================================

-- Ensure delivered_at and completed_at exist on visits table
ALTER TABLE visits
  ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

-- Performance indexes for date settlement queries
CREATE INDEX IF NOT EXISTS idx_visits_delivered_at ON visits(delivered_at);
CREATE INDEX IF NOT EXISTS idx_visits_completed_at ON visits(completed_at);
