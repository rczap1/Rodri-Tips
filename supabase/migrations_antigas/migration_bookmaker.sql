-- Rodri Tips — migração: casa de apostas
-- Corre isto no SQL Editor do teu projeto Supabase já existente

alter table public.bets
  add column if not exists bookmaker text;
