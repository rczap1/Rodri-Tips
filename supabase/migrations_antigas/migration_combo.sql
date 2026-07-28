-- Rodri Tips — migração: apostas combinadas
-- Corre isto no SQL Editor do teu projeto Supabase já existente
-- (o schema.sql original só serve para criar a tabela do zero, não migra)

alter table public.bets
  add column if not exists bet_type text not null default 'simple'
    check (bet_type in ('simple', 'combo'));

alter table public.bets
  add column if not exists legs jsonb;

-- Apostas combinadas não preenchem p1/p2/bet ao nível do bilhete (fica em `legs`)
alter table public.bets alter column p1 drop not null;
alter table public.bets alter column p2 drop not null;
alter table public.bets alter column bet drop not null;

-- Limpeza do bónus 22bet (já removido do site)
alter table public.bets drop column if exists is_bonus;
