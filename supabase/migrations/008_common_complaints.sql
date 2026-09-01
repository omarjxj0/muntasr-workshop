-- 008_common_complaints.sql

CREATE TABLE IF NOT EXISTS public.common_complaints (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    text TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.common_complaints ENABLE ROW LEVEL SECURITY;

-- Allow public read
CREATE POLICY "Allow public read access to common_complaints"
ON public.common_complaints FOR SELECT
USING (true);

-- Allow authenticated users to manage complaints
CREATE POLICY "Allow authenticated users to manage common_complaints"
ON public.common_complaints FOR ALL
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');

-- Insert default suggestions
INSERT INTO public.common_complaints (text) VALUES
('عدم الاشتغال'),
('مشكلة في الحساسات'),
('خطأ في وحدة التحكم ECU'),
('مشكلة في منظومة الوقود'),
('إنذار محرك'),
('مشكلة في الفرامل ABS'),
('مشكلة في تكييف الهواء'),
('مشكلة كهربائية في الأضواء'),
('خطأ في منظومة الناقل الأوتوماتيكي'),
('مشكلة في البطارية والشارجة'),
('اهتزاز غير طبيعي'),
('صوت غريب عند التشغيل'),
('ارتفاع في حرارة المحرك'),
('مشكلة في منظومة التوجيه الكهربائي'),
('عدم استجابة البيدال')
ON CONFLICT DO NOTHING;
