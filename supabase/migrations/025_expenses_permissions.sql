-- ============================================================
-- Migration 025: Ensure Full Permissions & RLS on public.expenses
-- Enables DELETE, UPDATE, INSERT, and SELECT for both authenticated and anon users
-- ============================================================

-- 1. Ensure table exists & enable Row Level Security
CREATE TABLE IF NOT EXISTS public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  amount DECIMAL(12, 2) NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

-- 2. Grant table permissions to authenticated and anon roles
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON TABLE public.expenses TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;

-- 3. Drop previous restrictive policies
DROP POLICY IF EXISTS "Allow full CRUD for authenticated users on expenses" ON public.expenses;
DROP POLICY IF EXISTS "Allow full CRUD for authenticated and anon users on expenses" ON public.expenses;
DROP POLICY IF EXISTS "expenses_full_access" ON public.expenses;
DROP POLICY IF EXISTS "expenses_select_all" ON public.expenses;
DROP POLICY IF EXISTS "expenses_insert_all" ON public.expenses;
DROP POLICY IF EXISTS "expenses_update_all" ON public.expenses;
DROP POLICY IF EXISTS "expenses_delete_all" ON public.expenses;

-- 4. Create explicit RLS policies for authenticated and anon (public) users
CREATE POLICY "expenses_select_all"
  ON public.expenses FOR SELECT
  TO public
  USING (true);

CREATE POLICY "expenses_insert_all"
  ON public.expenses FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "expenses_update_all"
  ON public.expenses FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "expenses_delete_all"
  ON public.expenses FOR DELETE
  TO public
  USING (true);
