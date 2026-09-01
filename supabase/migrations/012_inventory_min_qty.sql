-- Add min_quantity column to ecus table for low stock alerts
ALTER TABLE public.ecus 
ADD COLUMN IF NOT EXISTS min_quantity INTEGER DEFAULT 3;
