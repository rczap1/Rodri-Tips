-- Rodri Tips — migração: balanço mensal via Telegram
-- Corre isto DEPOIS de supabase/migration_telegram_notifications.sql
-- (reaproveita a função public.telegram_send já criada por esse ficheiro).
--
-- No dia 1 de cada mês, às 10h, envia ao canal um resumo do mês anterior:
-- lucro em unidades, ROI e win rate — no total e separado por desporto.
-- Só em unidades (nunca em €) e só desportos com apostas fechadas nesse mês.
--
-- ⚠️ Se o "create extension pg_cron" abaixo der erro de permissões, ativa a
-- extensão manualmente em Database → Extensions → pg_cron no Dashboard do
-- Supabase, e volta a correr este ficheiro.

create extension if not exists pg_cron with schema extensions;

create or replace function public.telegram_monthly_recap()
returns void
language plpgsql
security definer
as $$
declare
  period_start date := date_trunc('month', now() - interval '1 month')::date;
  period_end   date := date_trunc('month', now())::date; -- exclusivo
  month_names  text[] := array['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                                'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  month_label  text := month_names[extract(month from period_start)::int] || ' ' || extract(year from period_start)::text;
  sport_row    record;
  sport_lines  text := '';
  total_profit numeric := 0;
  total_units  numeric := 0;
  total_wins   int := 0;
  total_losses int := 0;
  msg          text;
begin
  for sport_row in
    select
      b.sport,
      sum(case when b.result = 'Win' then (b.units * b.odds - b.units) when b.result = 'Lost' then -b.units else 0 end) as profit,
      sum(case when b.result <> 'Void' then b.units else 0 end) as units_out,
      count(*) filter (where b.result = 'Win')  as wins,
      count(*) filter (where b.result = 'Lost') as losses
    from public.bets b
    where b.result <> 'Pending'
      and b.date >= period_start and b.date < period_end
    group by b.sport
  loop
    total_profit := total_profit + sport_row.profit;
    total_units  := total_units  + sport_row.units_out;
    total_wins   := total_wins   + sport_row.wins;
    total_losses := total_losses + sport_row.losses;

    sport_lines := sport_lines || format(
      E'\n%s %s: %s%su · ROI %s%% · %sW/%sL',
      case sport_row.sport
        when 'Tennis' then '🎾' when 'Handball' then '🤾'
        when 'MMA' then '🥊' when 'Football' then '⚽'
        when 'Basketball' then '🏀' when 'AmericanFootball' then '🏈' else '🏆'
      end,
      case sport_row.sport
        when 'Tennis' then 'Ténis' when 'Handball' then 'Andebol'
        when 'MMA' then 'MMA' when 'Football' then 'Futebol'
        when 'Basketball' then 'Basquetebol' when 'AmericanFootball' then 'Futebol Americano' else sport_row.sport
      end,
      case when sport_row.profit >= 0 then '+' else '' end, round(sport_row.profit, 2),
      case when sport_row.units_out > 0 then round(sport_row.profit / sport_row.units_out * 100, 1) else 0 end,
      sport_row.wins, sport_row.losses
    );
  end loop;

  -- Sem apostas fechadas no mês anterior: não envia nada
  if sport_lines = '' then
    return;
  end if;

  msg := format(
    E'📅 Balanço de %s\n\nTotal: %s%su · ROI %s%% · %sW/%sL%s',
    month_label,
    case when total_profit >= 0 then '+' else '' end, round(total_profit, 2),
    case when total_units > 0 then round(total_profit / total_units * 100, 1) else 0 end,
    total_wins, total_losses,
    sport_lines
  );

  perform public.telegram_send(msg);
end;
$$;

-- Agenda (idempotente — pode correr este ficheiro várias vezes sem duplicar o job)
do $$
begin
  if exists (select 1 from cron.job where jobname = 'telegram-monthly-recap') then
    perform cron.unschedule('telegram-monthly-recap');
  end if;
end $$;

select cron.schedule(
  'telegram-monthly-recap',
  '0 10 1 * *', -- dia 1 de cada mês, às 10h
  $$select public.telegram_monthly_recap();$$
);
