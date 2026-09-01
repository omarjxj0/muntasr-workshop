CREATE TABLE IF NOT EXISTS public.expenses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  amount DECIMAL(12, 2) NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

-- Allow full CRUD for authenticated users
DROP POLICY IF EXISTS "Allow full CRUD for authenticated users on expenses" ON public.expenses;
CREATE POLICY "Allow full CRUD for authenticated users on expenses" 
ON public.expenses FOR ALL TO authenticated USING (true) WITH CHECK (true);
