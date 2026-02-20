-- Insert a test lead for conversion testing
INSERT INTO public.leads (name, email, phone, city_id, status, source)
SELECT 
    'Lead de Prueba (Para Convertir)', 
    'test_conversion@ejemplo.com', 
    '699123456', 
    id, 
    'nuevo', 
    'Google Ads'
FROM public.cities
LIMIT 1;
