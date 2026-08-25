-- ============================================================
-- Montaser Workshop — Database Triggers
-- ============================================================

-- ── 1. Stock Deduction on used_parts INSERT ───────────────
CREATE OR REPLACE FUNCTION fn_deduct_ecu_stock()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE ecus
  SET stock_quantity = stock_quantity - NEW.quantity
  WHERE id = NEW.ecu_id;

  -- Prevent going negative (optional guard)
  IF (SELECT stock_quantity FROM ecus WHERE id = NEW.ecu_id) < 0 THEN
    RAISE EXCEPTION 'الكمية في المخزون غير كافية للـ ECU المحدد';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_deduct_ecu_stock
  AFTER INSERT ON used_parts
  FOR EACH ROW EXECUTE FUNCTION fn_deduct_ecu_stock();


-- ── 2. Stock Restore on used_parts DELETE ─────────────────
CREATE OR REPLACE FUNCTION fn_restore_ecu_stock()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE ecus
  SET stock_quantity = stock_quantity + OLD.quantity
  WHERE id = OLD.ecu_id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_restore_ecu_stock
  AFTER DELETE ON used_parts
  FOR EACH ROW EXECUTE FUNCTION fn_restore_ecu_stock();


-- ── 3. Stock Adjust on used_parts UPDATE (qty change) ─────
CREATE OR REPLACE FUNCTION fn_adjust_ecu_stock()
RETURNS TRIGGER AS $$
DECLARE
  diff INTEGER;
BEGIN
  diff := NEW.quantity - OLD.quantity;

  UPDATE ecus
  SET stock_quantity = stock_quantity - diff
  WHERE id = NEW.ecu_id;

  IF diff > 0 AND (SELECT stock_quantity FROM ecus WHERE id = NEW.ecu_id) < 0 THEN
    RAISE EXCEPTION 'الكمية في المخزون غير كافية للـ ECU المحدد';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_adjust_ecu_stock
  AFTER UPDATE OF quantity ON used_parts
  FOR EACH ROW EXECUTE FUNCTION fn_adjust_ecu_stock();


-- ── 4. Recalculate Visit Total Amount ─────────────────────
CREATE OR REPLACE FUNCTION fn_recalculate_visit_total()
RETURNS TRIGGER AS $$
DECLARE
  target_visit_id UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    target_visit_id := OLD.visit_id;
  ELSE
    target_visit_id := NEW.visit_id;
  END IF;

  UPDATE visits
  SET total_amount = (
    SELECT COALESCE(SUM(quantity * selling_price_at_time), 0)
    FROM used_parts
    WHERE visit_id = target_visit_id
  )
  WHERE id = target_visit_id;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_recalculate_visit_total
  AFTER INSERT OR UPDATE OR DELETE ON used_parts
  FOR EACH ROW EXECUTE FUNCTION fn_recalculate_visit_total();


-- ── 5. Auto-create profile on new auth user ───────────────
CREATE OR REPLACE FUNCTION fn_create_profile_on_signup()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, role, full_name)
  VALUES (NEW.id, 'technician', NEW.raw_user_meta_data->>'full_name')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_create_profile_on_signup
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION fn_create_profile_on_signup();
