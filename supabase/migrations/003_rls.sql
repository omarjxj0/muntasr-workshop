-- ============================================================
-- Montaser Workshop — Row Level Security (RLS)
-- ============================================================

-- Helper function: get current user's role
CREATE OR REPLACE FUNCTION get_my_role()
RETURNS user_role AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;


-- ── Enable RLS on all tables ──────────────────────────────
ALTER TABLE profiles     ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers    ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles     ENABLE ROW LEVEL SECURITY;
ALTER TABLE visits       ENABLE ROW LEVEL SECURITY;
ALTER TABLE ecus         ENABLE ROW LEVEL SECURITY;
ALTER TABLE ecu_companies  ENABLE ROW LEVEL SECURITY;
ALTER TABLE ecu_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE used_parts   ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees    ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_wages  ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;


-- ── profiles ──────────────────────────────────────────────
CREATE POLICY "Users can read own profile"
  ON profiles FOR SELECT USING (id = auth.uid());

CREATE POLICY "Admin can manage all profiles"
  ON profiles FOR ALL USING (get_my_role() = 'admin');


-- ── customers ─────────────────────────────────────────────
CREATE POLICY "Authenticated users can read customers"
  ON customers FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert customers"
  ON customers FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Admin can update/delete customers"
  ON customers FOR UPDATE USING (get_my_role() = 'admin');

CREATE POLICY "Admin can delete customers"
  ON customers FOR DELETE USING (get_my_role() = 'admin');


-- ── vehicles ──────────────────────────────────────────────
CREATE POLICY "Authenticated users can read vehicles"
  ON vehicles FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert vehicles"
  ON vehicles FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Admin can update/delete vehicles"
  ON vehicles FOR UPDATE USING (get_my_role() = 'admin');

CREATE POLICY "Admin can delete vehicles"
  ON vehicles FOR DELETE USING (get_my_role() = 'admin');


-- ── visits ────────────────────────────────────────────────
CREATE POLICY "Authenticated users can read visits"
  ON visits FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert visits"
  ON visits FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update visits"
  ON visits FOR UPDATE USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admin can delete visits"
  ON visits FOR DELETE USING (get_my_role() = 'admin');


-- ── ecu_companies ─────────────────────────────────────────
CREATE POLICY "Authenticated users can read ecu_companies"
  ON ecu_companies FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admin can manage ecu_companies"
  ON ecu_companies FOR ALL USING (get_my_role() = 'admin');


-- ── ecu_categories ────────────────────────────────────────
CREATE POLICY "Authenticated users can read ecu_categories"
  ON ecu_categories FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admin can manage ecu_categories"
  ON ecu_categories FOR ALL USING (get_my_role() = 'admin');


-- ── ecus (Inventory) ──────────────────────────────────────
-- Both roles can SELECT. Purchase price is hidden at the application layer for technicians.
CREATE POLICY "Authenticated users can read ecus"
  ON ecus FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admin can manage ecus"
  ON ecus FOR ALL USING (get_my_role() = 'admin');


-- ── used_parts ────────────────────────────────────────────
CREATE POLICY "Authenticated users can read used_parts"
  ON used_parts FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert used_parts"
  ON used_parts FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Admin can update/delete used_parts"
  ON used_parts FOR UPDATE USING (get_my_role() = 'admin');

CREATE POLICY "Admin can delete used_parts"
  ON used_parts FOR DELETE USING (get_my_role() = 'admin');


-- ── employees ─────────────────────────────────────────────
-- Technicians cannot access employees
CREATE POLICY "Admin can manage employees"
  ON employees FOR ALL USING (get_my_role() = 'admin');


-- ── daily_wages ───────────────────────────────────────────
CREATE POLICY "Admin can manage daily_wages"
  ON daily_wages FOR ALL USING (get_my_role() = 'admin');


-- ── transactions ──────────────────────────────────────────
CREATE POLICY "Admin can manage transactions"
  ON transactions FOR ALL USING (get_my_role() = 'admin');


-- ── ECU View for Technicians (hides purchase_price) ───────
CREATE OR REPLACE VIEW ecus_technician_view AS
SELECT
  id,
  company_id,
  category_id,
  name,
  barcode,
  symbols_codes,
  stock_quantity,
  NULL::DECIMAL AS purchase_price,  -- hidden
  selling_price
FROM ecus;

GRANT SELECT ON ecus_technician_view TO authenticated;
