CREATE TABLE public.dog_breeds (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.dog_breeds ENABLE ROW LEVEL SECURITY;

-- Create Policy: Allow read access to all authenticated users
CREATE POLICY "Allow read access to all authenticated users" ON public.dog_breeds
    FOR SELECT USING (auth.role() = 'authenticated');

-- Create Policy: Allow insert access to all authenticated users
CREATE POLICY "Allow insert access to all authenticated users" ON public.dog_breeds
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

INSERT INTO public.dog_breeds (name) VALUES
('Boyero de Berna'), ('Dogo Argentino'), ('Samoyedo'), ('Bichón Maltés'), 
('Mestizo Grande'), ('Mestizo Mediano'), ('Mestizo Pequeño'), ('Bullterrier'), 
('American Stanford'), ('Bullying'), ('Pastor Alemán'), ('Beagle'), 
('BullDog Frances'), ('Podenco'), ('Galgo'), ('York Shire'), 
('Caniche'), ('Pit Bull'), ('Doberman'), ('Boxer'), 
('Golden'), ('Perro Salchicha'), ('Border Collie'), ('Perro de Agua'), 
('Teckel'), ('Mestizo'), ('Pastor Belga'), ('Bretón'), 
('Cavalier'), ('Labrador'), ('Chihuahua'), ('San Bernardo'), 
('Mastín'), ('Gran Danés'), ('Braco de Weimar'), ('Sharpei'), 
('Cocker'), ('Pomerania'), ('Pinscher'), ('Westy Terrier'), 
('Jack Russell Terrier'), ('Bodeguero'), ('Maltipoo'),
('Akita'), ('Spitz Alemán'), ('Pointer'), ('Dálmata'), 
('Schnauzer Pequeño'), ('Schnauzer Mediano'), ('Schnauzer Grande'), 
('Pastor Mallorquín'), ('Ratero Mallorquín'), ('Bobtail'), 
('Crestado Chino'), ('Cane Corso');
