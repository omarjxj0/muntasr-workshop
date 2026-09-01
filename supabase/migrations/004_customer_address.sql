-- ============================================================
-- Montaser Workshop — Customer Address Column
-- ============================================================

-- ── Add address (سكن الزبون) to customers ─────────────────
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS address TEXT;

-- ── Index for potential future address searches ────────────
-- (optional, skip if not needed for performance)
-- CREATE INDEX idx_customers_address ON customers(address);
