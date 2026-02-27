-- Create trainer_settlements table
CREATE TABLE public.trainer_settlements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    adiestrador_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    month TEXT NOT NULL, -- Format: YYYY-MM
    base_imponible NUMERIC(10, 2) NOT NULL DEFAULT 0,
    evaluations_deducted_amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
    iva_amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
    total_amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pendiente' CHECK (status IN ('pendiente', 'pagado')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Enable RLS
ALTER TABLE public.trainer_settlements ENABLE ROW LEVEL SECURITY;

-- Policies for trainer_settlements
CREATE POLICY "Adiestradores can view own settlements" ON public.trainer_settlements
    FOR SELECT USING (
        auth.uid() = adiestrador_id OR 
        EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
    );

CREATE POLICY "Admins can manage settlements" ON public.trainer_settlements
    FOR ALL USING (
        EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
    );

-- Function for updated_at
CREATE OR REPLACE FUNCTION update_trainer_settlements_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_trainer_settlements_updated_at
    BEFORE UPDATE ON public.trainer_settlements
    FOR EACH ROW
    EXECUTE FUNCTION update_trainer_settlements_updated_at();


-- Add tracking columns to evaluations
ALTER TABLE public.evaluations 
ADD COLUMN trainer_settlement_id UUID REFERENCES public.trainer_settlements(id) ON DELETE SET NULL,
ADD COLUMN paid_to_trainer BOOLEAN NOT NULL DEFAULT false;

-- Add tracking columns to sessions
ALTER TABLE public.sessions
ADD COLUMN trainer_settlement_id UUID REFERENCES public.trainer_settlements(id) ON DELETE SET NULL,
ADD COLUMN paid_to_trainer BOOLEAN NOT NULL DEFAULT false;
