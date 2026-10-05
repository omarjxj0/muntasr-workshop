-- ============================================================
-- Migration 024: Direct Sales & ECU Store
-- Creates direct_sales table, status column on ecus, and auto-sold trigger
-- ============================================================

-- 1. Ensure status column exists on ecus
ALTER TABLE ecus
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'available';

CREATE INDEX IF NOT EXISTS idx_ecus_status ON ecus(status);

-- 2. Create direct_sales table
CREATE TABLE IF NOT EXISTS direct_sales (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sale_date       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  item_type       TEXT NOT NULL DEFAULT 'ecu',
  barcode         TEXT,
  ecu_id          UUID REFERENCES ecus(id) ON DELETE SET NULL,
  item_name       TEXT NOT NULL,
  customer_name   TEXT,
  phone           TEXT,
  selling_price   NUMERIC(12, 0) NOT NULL DEFAULT 0,
  technician_name TEXT,
  notes           TEXT
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_direct_sales_created_at      ON direct_sales(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_direct_sales_ecu_id          ON direct_sales(ecu_id);
CREATE INDEX IF NOT EXISTS idx_direct_sales_technician_name ON direct_sales(technician_name);
CREATE INDEX IF NOT EXISTS idx_direct_sales_barcode         ON direct_sales(barcode);

-- 3. Trigger: Automatically mark ECU as 'sold' when direct sale is recorded
CREATE OR REPLACE FUNCTION fn_mark_ecu_as_sold()
RETURNS TRIGGER AS $$
DECLARE
  target_id UUID;
BEGIN
  target_id := NEW.ecu_id;

  -- If ecu_id not explicitly set, match by barcode
  IF target_id IS NULL AND NEW.barcode IS NOT NULL AND TRIM(NEW.barcode) != '' THEN
    SELECT id INTO target_id FROM ecus WHERE barcode = TRIM(NEW.barcode) LIMIT 1;
    IF target_id IS NOT NULL THEN
      NEW.ecu_id := target_id;
    END IF;
  END IF;

  -- Mark ECU as sold and reduce stock
  IF target_id IS NOT NULL THEN
    UPDATE ecus
    SET status = 'sold',
        stock_quantity = 0
    WHERE id = target_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_mark_ecu_as_sold ON direct_sales;
CREATE TRIGGER trg_mark_ecu_as_sold
  BEFORE INSERT ON direct_sales
  FOR EACH ROW EXECUTE FUNCTION fn_mark_ecu_as_sold();

-- 4. Trigger: Restore ECU to available if direct sale is deleted
CREATE OR REPLACE FUNCTION fn_restore_sold_ecu()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.ecu_id IS NOT NULL THEN
    UPDATE ecus
    SET status = 'available',
        stock_quantity = 1
    WHERE id = OLD.ecu_id;
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_restore_sold_ecu ON direct_sales;
CREATE TRIGGER trg_restore_sold_ecu
  AFTER DELETE ON direct_sales
  FOR EACH ROW EXECUTE FUNCTION fn_restore_sold_ecu();

-- 5. Row Level Security
ALTER TABLE direct_sales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "direct_sales_select_authenticated"
  ON direct_sales FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "direct_sales_insert_authenticated"
  ON direct_sales FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "direct_sales_update_admin"
  ON direct_sales FOR UPDATE
  TO authenticated
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

CREATE POLICY "direct_sales_delete_admin"
  ON direct_sales FOR DELETE
  TO authenticated
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');
