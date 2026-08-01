-- Rodri Tips — migração: apostas futuras (outrights)
-- Corre isto no SQL Editor do teu projeto Supabase já existente

alter table public.bets
  add column if not exists is_future boolean not null default false;

alter table public.bets
  add column if not exists expected_result_date date;
