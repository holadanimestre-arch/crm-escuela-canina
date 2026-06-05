-- Satisfacción del cliente (notas de la llamada de calidad al finalizar el adiestramiento)
alter table public.clients add column if not exists satisfaction_notes text;
