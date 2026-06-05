-- Aviso por WhatsApp al adiestrador cuando se le sube un cliente para la evaluación inicial
alter table public.crm_settings add column if not exists whatsapp_new_client_template text
    default 'Buenas! te he subido un cliente para llamar cuando puedas 😉';

update public.crm_settings
set whatsapp_new_client_template = 'Buenas! te he subido un cliente para llamar cuando puedas 😉'
where whatsapp_new_client_template is null;
