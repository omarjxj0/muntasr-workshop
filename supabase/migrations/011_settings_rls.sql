-- Enable RLS for ecu_companies
ALTER TABLE public.ecu_companies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow full CRUD for authenticated users on ecu_companies" ON public.ecu_companies;
CREATE POLICY "Allow full CRUD for authenticated users on ecu_companies" 
ON public.ecu_companies FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Enable RLS for ecu_categories
ALTER TABLE public.ecu_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow full CRUD for authenticated users on ecu_categories" ON public.ecu_categories;
CREATE POLICY "Allow full CRUD for authenticated users on ecu_categories" 
ON public.ecu_categories FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Enable RLS for common_complaints
ALTER TABLE public.common_complaints ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow full CRUD for authenticated users on common_complaints" ON public.common_complaints;
CREATE POLICY "Allow full CRUD for authenticated users on common_complaints" 
ON public.common_complaints FOR ALL TO authenticated USING (true) WITH CHECK (true);
