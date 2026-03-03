-- Update crm_settings to include WhatsApp templates
ALTER TABLE public.crm_settings 
ADD COLUMN IF NOT EXISTS whatsapp_no_contesta_template text DEFAULT 'Hola [NOMBRE], soy [ADIESTRADOR] de la Escuela Canina Fran Estévez. Te hemos llamado para concertar la cita de evaluación pero no hemos podido contactar contigo. Te dejo este mensaje para que nos devuelvas la llamada cuando puedas. ¡Gracias!';

-- Add column to log if whatsapp was sent to a client
ALTER TABLE public.clients
ADD COLUMN IF NOT EXISTS last_whatsapp_sent_at timestamp with time zone;
