-- EVALUATION RESULTS - Detailed scoring for each evaluation
-- Run this in Supabase SQL Editor

-- Create table for storing individual evaluation items/scores
create table if not exists public.evaluation_results (
  id uuid default uuid_generate_v4() primary key,
  evaluation_id uuid references public.evaluations(id) on delete cascade not null,
  category text not null, -- 'socializacion', 'obediencia', 'ansiedad', 'agresividad', 'miedos'
  item text not null, -- 'Reacción con otros perros', 'Respuesta a la llamada', etc.
  score integer check (score between 1 and 5), -- 1=Muy Mal, 5=Excelente
  observations text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Index for faster lookups
create index if not exists evaluation_results_evaluation_idx on public.evaluation_results(evaluation_id);

-- Enable RLS
alter table public.evaluation_results enable row level security;

-- Policies (same as evaluations - adiestradores manage, admins all)
create policy "Admins manage evaluation_results" on public.evaluation_results for all using (public.is_admin());
create policy "Adiestradores manage their evaluation_results" on public.evaluation_results for all using (
  public.is_adiestrador() and exists (
    select 1 from public.evaluations e 
    where e.id = evaluation_results.evaluation_id and e.city_id = public.get_user_city()
  )
);
create policy "Comerciales view evaluation_results" on public.evaluation_results for select using (public.is_comercial());

-- Add adiestrador_id to evaluations if not exists
alter table public.evaluations add column if not exists adiestrador_id uuid references public.profiles(id);
