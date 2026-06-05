-- Aviso automático por WhatsApp a adiestradores: evaluación inicial sin fecha

-- 1. Teléfono del adiestrador (necesario para enviarle el WhatsApp)
alter table public.profiles add column if not exists phone text;

-- 2. Marca para no reenviar el aviso al mismo cliente
alter table public.clients add column if not exists eval_reminder_sent_at timestamptz;

-- 3. Plantilla del mensaje (editable desde la sección WhatsApps)
alter table public.crm_settings add column if not exists whatsapp_eval_reminder_template text
    default 'Buenas! He visto que el cliente "[NOMBRE]" no tiene asignada la fecha de evaluación inicial todavía, ¿qué problema has tenido?';

-- Rellenar la plantilla por defecto si la fila existente la tiene a null
update public.crm_settings
set whatsapp_eval_reminder_template = 'Buenas! He visto que el cliente "[NOMBRE]" no tiene asignada la fecha de evaluación inicial todavía, ¿qué problema has tenido?'
where whatsapp_eval_reminder_template is null;
