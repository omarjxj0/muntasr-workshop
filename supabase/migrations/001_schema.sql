-- ============================================================
-- Montaser Workshop — Database Schema
-- ============================================================

-- ── Extensions ────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── Profiles (roles) ──────────────────────────────────────
CREATE TYPE user_role AS ENUM ('admin', 'technician');

CREATE TABLE profiles (
  id        UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role      user_role NOT NULL DEFAULT 'technician',
  full_name TEXT
);

-- ── Customers ─────────────────────────────────────────────
CREATE TABLE customers (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  phone      TEXT NOT NULL UNIQUE,
  name       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Vehicles ──────────────────────────────────────────────
CREATE TABLE vehicles (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id         UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  license_plate       TEXT NOT NULL,
  chassis_number_vin  TEXT,
  make_and_model      TEXT NOT NULL
);

-- ── Visit Status Enum ─────────────────────────────────────
CREATE TYPE visit_status AS ENUM ('Pending', 'In Progress', 'Completed', 'Delivered');

-- ── Maintenance Visits ────────────────────────────────────
CREATE TABLE visits (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vehicle_id   UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  entry_date   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  complaint    TEXT,
  status       visit_status NOT NULL DEFAULT 'Pending',
  total_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00
);

-- ── ECU Companies ─────────────────────────────────────────
CREATE TABLE ecu_companies (
  id   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL
);

-- ── ECU Categories ────────────────────────────────────────
CREATE TABLE ecu_categories (
  id   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL
);

-- ── ECUs (Inventory) ──────────────────────────────────────
CREATE TABLE ecus (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id     UUID REFERENCES ecu_companies(id) ON DELETE SET NULL,
  category_id    UUID REFERENCES ecu_categories(id) ON DELETE SET NULL,
  name           TEXT NOT NULL,
  barcode        TEXT UNIQUE,
  symbols_codes  TEXT,
  stock_quantity INTEGER NOT NULL DEFAULT 0,
  purchase_price DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  selling_price  DECIMAL(12, 2) NOT NULL DEFAULT 0.00
);

-- ── Used Parts (Visit Cart) ───────────────────────────────
CREATE TABLE used_parts (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  visit_id              UUID NOT NULL REFERENCES visits(id) ON DELETE CASCADE,
  ecu_id                UUID NOT NULL REFERENCES ecus(id) ON DELETE RESTRICT,
  quantity              INTEGER NOT NULL DEFAULT 1,
  selling_price_at_time DECIMAL(12, 2) NOT NULL
);

-- ── Employees ─────────────────────────────────────────────
CREATE TABLE employees (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name           TEXT NOT NULL,
  phone          TEXT,
  specialization TEXT
);

-- ── Daily Wages ───────────────────────────────────────────
CREATE TABLE daily_wages (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  date        DATE NOT NULL DEFAULT CURRENT_DATE,
  amount      DECIMAL(12, 2) NOT NULL
);

-- ── Transaction Type Enums ────────────────────────────────
CREATE TYPE transaction_type AS ENUM ('Income', 'Expense');
CREATE TYPE transaction_reference_type AS ENUM ('Visit_Payment', 'Employee_Wage', 'Other');

-- ── Finances / Cashier ────────────────────────────────────
CREATE TABLE transactions (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type           transaction_type NOT NULL,
  amount         DECIMAL(12, 2) NOT NULL,
  reference_type transaction_reference_type NOT NULL DEFAULT 'Other',
  reference_id   UUID,
  description    TEXT,
  date           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Indexes for performance ───────────────────────────────
CREATE INDEX idx_customers_phone         ON customers(phone);
CREATE INDEX idx_vehicles_customer_id    ON vehicles(customer_id);
CREATE INDEX idx_visits_vehicle_id       ON visits(vehicle_id);
CREATE INDEX idx_used_parts_visit_id     ON used_parts(visit_id);
CREATE INDEX idx_used_parts_ecu_id       ON used_parts(ecu_id);
CREATE INDEX idx_daily_wages_employee_id ON daily_wages(employee_id);
CREATE INDEX idx_daily_wages_date        ON daily_wages(date);
CREATE INDEX idx_transactions_date       ON transactions(date);
CREATE INDEX idx_ecus_barcode            ON ecus(barcode);
