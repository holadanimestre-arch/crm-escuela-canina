CREATE TABLE public.call_reasons (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.call_reasons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read access to all authenticated users" ON public.call_reasons
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Allow insert access to all authenticated users" ON public.call_reasons
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Add call_reason to clients table
ALTER TABLE public.clients ADD COLUMN call_reason TEXT;

-- Insert initial values
INSERT INTO public.call_reasons (name) VALUES
('Destrozo en el Hogar'),
('Obediencia Básica'),
('Cachorro'),
('Reactivo a Perros'),
('Reactivo a Personas'),
('Ladridos'),
('Ansiedad por Separación'),
('Celos'),
('Paseos incómodos'),
('Necesidades en casa');
