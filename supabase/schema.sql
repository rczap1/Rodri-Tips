-- Rodri Tips — schema Supabase
-- Corre este ficheiro inteiro no SQL Editor do teu projeto Supabase
-- (https://app.supabase.com/project/_/sql/new)

-- 1. Tabela de apostas
create table if not exists public.bets (
  id         uuid primary key default gen_random_uuid(),
  date       date not null,
  sport      text not null check (sport in ('Tennis','Handball','MMA','Football')),
  comp       text,
  p1         text,
  p2         text,
  event      text,
  bet        text,
  units      numeric not null check (units > 0),
  odds       numeric not null check (odds >= 1.01),
  result     text not null default 'Pending' check (result in ('Pending','Win','Lost','Void')),
  player     text,
  pteam      text,
  bet_type   text not null default 'simple' check (bet_type in ('simple','combo')),
  legs       jsonb,
  created_at timestamptz not null default now()
);

-- 2. Row Level Security
alter table public.bets enable row level security;

-- Qualquer visitante (mesmo sem login) pode ler tudo — site público read-only
create policy "bets_select_public"
  on public.bets for select
  using (true);

-- Só o admin (autenticado com este email) pode criar apostas
create policy "bets_insert_admin"
  on public.bets for insert
  with check (auth.jwt() ->> 'email' = 'rodrigofcarvalho421@gmail.com');

-- Só o admin pode editar apostas
create policy "bets_update_admin"
  on public.bets for update
  using (auth.jwt() ->> 'email' = 'rodrigofcarvalho421@gmail.com')
  with check (auth.jwt() ->> 'email' = 'rodrigofcarvalho421@gmail.com');

-- Só o admin pode apagar apostas
create policy "bets_delete_admin"
  on public.bets for delete
  using (auth.jwt() ->> 'email' = 'rodrigofcarvalho421@gmail.com');

-- 3. Depois de correr isto:
--    Authentication > Users > Add user
--    email: rodrigofcarvalho421@gmail.com
--    define uma password — é essa que vais usar no Login do site.
