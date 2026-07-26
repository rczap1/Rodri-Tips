-- Rodri Tips — migração: notificações push no browser (extra opcional)
-- Corre isto no SQL Editor DEPOIS de fazeres o deploy da Edge Function
-- `send-push` (ver README.md, secção "Push no browser").
--
-- ⚠️  ATENÇÃO: substitui <PROJECT-REF> e <WEBHOOK_SECRET> pelos valores reais
-- SÓ na cópia que colas no SQL Editor. NÃO faças commit deste ficheiro com
-- os valores reais preenchidos.

create extension if not exists pg_net;

-- 1. Tabela de subscrições push (uma linha por browser/dispositivo que aceitou)
create table if not exists public.push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  endpoint   text not null unique,
  p256dh     text not null,
  auth       text not null,
  created_at timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;

-- Sem NENHUMA política pública (insert/update/select/delete) — o browser
-- nunca mexe diretamente nesta tabela. Todas as escritas passam pela Edge
-- Function `subscribe-push` (chave admin, ignora RLS) e as leituras para
-- enviar os pushes passam pela `send-push` (também chave admin).
-- Ver supabase/functions/subscribe-push/index.ts e js/script.js (toggleNotifications).

-- 2. Funções que chamam a Edge Function `send-push` via pg_net diretamente
-- (mesmo mecanismo já usado no Telegram — não depende do schema
-- supabase_functions nem de criares nada pela UI de Webhooks do Dashboard)
create or replace function public.notify_push_new_bet()
returns trigger
language plpgsql
security definer
as $$
begin
  perform net.http_post(
    url     := 'https://<PROJECT-REF>.supabase.co/functions/v1/send-push',
    body    := jsonb_build_object('type', 'INSERT', 'table', 'bets', 'record', to_jsonb(NEW)),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-webhook-secret', '<WEBHOOK_SECRET>')
  );
  return NEW;
end;
$$;

drop trigger if exists on_bet_pending_insert_push on public.bets;
create trigger on_bet_pending_insert_push
  after insert on public.bets
  for each row
  when (NEW.result = 'Pending')
  execute function public.notify_push_new_bet();

create or replace function public.notify_push_resolved()
returns trigger
language plpgsql
security definer
as $$
begin
  perform net.http_post(
    url     := 'https://<PROJECT-REF>.supabase.co/functions/v1/send-push',
    body    := jsonb_build_object(
      'type', 'UPDATE', 'table', 'bets',
      'record', to_jsonb(NEW), 'old_record', to_jsonb(OLD)
    ),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-webhook-secret', '<WEBHOOK_SECRET>')
  );
  return NEW;
end;
$$;

drop trigger if exists on_bet_resolved_update_push on public.bets;
create trigger on_bet_resolved_update_push
  after update on public.bets
  for each row
  when (OLD.result = 'Pending' and NEW.result <> 'Pending')
  execute function public.notify_push_resolved();
