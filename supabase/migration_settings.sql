-- Rodri Tips — migração: valor da unidade partilhado
-- Corre isto no SQL Editor do teu projeto Supabase já existente
--
-- Até agora o "1u = X€" ficava só no localStorage do teu browser — por isso
-- não se mantinha ao abrir noutro separador/dispositivo. Passa a viver aqui,
-- tal como as apostas.

create table if not exists public.settings (
  id         uuid primary key default gen_random_uuid(),
  unit_value numeric not null default 10 check (unit_value > 0),
  updated_at timestamptz not null default now()
);

-- Semeia a linha única com o valor atual (20€), só se a tabela estiver vazia
insert into public.settings (unit_value)
select 20
where not exists (select 1 from public.settings);

alter table public.settings enable row level security;

create policy "settings_select_public" on public.settings for select using (true);

create policy "settings_update_admin" on public.settings for update
  using (auth.jwt() ->> 'email' = 'rodrigofcarvalho421@gmail.com')
  with check (auth.jwt() ->> 'email' = 'rodrigofcarvalho421@gmail.com');
