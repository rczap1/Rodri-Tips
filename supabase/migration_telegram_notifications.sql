-- Rodri Tips — migração: notificações via Telegram
-- Corre isto no SQL Editor do teu projeto Supabase já existente
--
-- Avisa automaticamente um canal/grupo de Telegram sempre que:
--   1) uma aposta nova é criada com resultado "Pending" (para copiarem a tempo)
--   2) uma aposta pendente é resolvida (Win/Lost/Void)
--
-- Não precisa de Edge Function nem de deploy — é só uma chamada HTTP direta
-- do Postgres para a API do Telegram, usando a extensão pg_net.
--
-- ⚠️  ATENÇÃO: substitui <BOT_TOKEN> e <CHAT_ID> abaixo pelos valores reais
-- SÓ na cópia que colas no SQL Editor. NÃO faças commit deste ficheiro com
-- os valores reais preenchidos — o token do bot é um segredo (quem o tiver
-- consegue enviar mensagens como o teu bot).
--
-- Como obter os valores:
--   1. Fala com @BotFather no Telegram → /newbot → dá-te o BOT_TOKEN.
--   2. Cria um canal/grupo, adiciona o bot como admin.
--   3. Envia uma mensagem qualquer no canal, depois visita
--      https://api.telegram.org/bot<BOT_TOKEN>/getUpdates
--      e procura o campo "chat":{"id": ...} — esse número é o CHAT_ID
--      (ou usa @myidbot / @userinfobot para grupos).

create extension if not exists pg_net;

-- Função central de envio — só aqui é que o token/chat aparecem
create or replace function public.telegram_send(msg text)
returns void
language plpgsql
security definer
as $$
begin
  perform net.http_post(
    url     := 'https://api.telegram.org/bot<BOT_TOKEN>/sendMessage',
    body    := jsonb_build_object('chat_id', '<CHAT_ID>', 'text', msg),
    headers := '{"Content-Type": "application/json"}'::jsonb
  );
end;
$$;

-- Aposta nova (Pending)
create or replace function public.notify_telegram_new_bet()
returns trigger
language plpgsql
security definer
as $$
declare
  msg          text;
  sport_icon   text;
  sport_label  text;
  legs_text    text := '';
  leg          jsonb;
  potential    numeric;
begin
  sport_icon := case NEW.sport
    when 'Tennis'   then '🎾'
    when 'Handball' then '🤾'
    when 'MMA'      then '🥊'
    when 'Football' then '⚽'
    else '🏆'
  end;
  sport_label := case NEW.sport
    when 'Tennis'   then 'Ténis'
    when 'Handball' then 'Andebol'
    when 'MMA'      then 'MMA'
    when 'Football' then 'Futebol'
    else NEW.sport
  end;
  potential := round(NEW.units * NEW.odds, 2);

  if NEW.bet_type = 'combo' then
    for leg in select * from jsonb_array_elements(coalesce(NEW.legs, '[]'::jsonb))
    loop
      legs_text := legs_text || format(
        E'\n%s vs %s — %s%s',
        coalesce(leg->>'p1', '—'), coalesce(leg->>'p2', '—'), coalesce(leg->>'bet', '—'),
        case when coalesce(leg->>'comp', '') <> '' then format(' (%s)', leg->>'comp') else '' end
      );
    end loop;

    msg := format(
      E'🧩 Nova combinada — %s %s%s\nOdd Total @%s · %su',
      sport_icon, sport_label, legs_text, NEW.odds, NEW.units
    );
  else
    msg := format(
      E'🎯 Nova aposta — %s %s\n%s vs %s\n%s @%s · %su',
      sport_icon, sport_label,
      coalesce(NEW.p1, '—'), coalesce(NEW.p2, '—'),
      coalesce(NEW.bet, '—'), NEW.odds, NEW.units
    );

    if coalesce(NEW.comp, '') <> '' then
      msg := msg || format(E'\n🏆 %s', NEW.comp);
    end if;

    if coalesce(NEW.player, '') <> '' then
      msg := msg || format(
        E'\n👤 %s%s',
        NEW.player,
        case when coalesce(NEW.pteam, '') <> '' then format(' (%s)', NEW.pteam) else '' end
      );
    end if;
  end if;

  if coalesce(NEW.bookmaker, '') <> '' then
    msg := msg || format(E'\n🏠 %s', NEW.bookmaker);
  end if;

  msg := msg || format(E'\n📈 Retorno potencial: %su', potential);

  perform public.telegram_send(msg);
  return NEW;
end;
$$;

-- Aposta resolvida (Win/Lost/Void)
create or replace function public.notify_telegram_resolved()
returns trigger
language plpgsql
security definer
as $$
declare
  msg          text;
  sport_icon   text;
  sport_label  text;
  result_icon  text;
  result_label text;
  legs_text    text := '';
  leg          jsonb;
  leg_icon     text;
  profit       numeric;
begin
  sport_icon := case NEW.sport
    when 'Tennis'   then '🎾'
    when 'Handball' then '🤾'
    when 'MMA'      then '🥊'
    when 'Football' then '⚽'
    else '🏆'
  end;
  sport_label := case NEW.sport
    when 'Tennis'   then 'Ténis'
    when 'Handball' then 'Andebol'
    when 'MMA'      then 'MMA'
    when 'Football' then 'Futebol'
    else NEW.sport
  end;

  result_icon  := case NEW.result when 'Win' then '✅' when 'Lost' then '❌' when 'Void' then '↩️' else '' end;
  result_label := case NEW.result when 'Win' then 'Aposta Ganha' when 'Lost' then 'Aposta Perdida' when 'Void' then 'Aposta Anulada' else NEW.result end;
  profit       := case NEW.result when 'Win' then round(NEW.units * NEW.odds - NEW.units, 2) when 'Lost' then -NEW.units else 0 end;

  if NEW.bet_type = 'combo' then
    for leg in select * from jsonb_array_elements(coalesce(NEW.legs, '[]'::jsonb))
    loop
      leg_icon := case leg->>'result' when 'Win' then '✅' when 'Lost' then '❌' when 'Void' then '↩️' else '⏳' end;
      legs_text := legs_text || format(
        E'\n%s %s vs %s — %s%s',
        leg_icon, coalesce(leg->>'p1', '—'), coalesce(leg->>'p2', '—'), coalesce(leg->>'bet', '—'),
        case when coalesce(leg->>'comp', '') <> '' then format(' (%s)', leg->>'comp') else '' end
      );
    end loop;

    msg := format(
      E'%s %s — Combinada %s %s%s\nOdd Total @%s · %su',
      result_icon, result_label, sport_icon, sport_label, legs_text, NEW.odds, NEW.units
    );
  else
    msg := format(
      E'%s %s — %s %s\n%s vs %s\n%s @%s · %su',
      result_icon, result_label, sport_icon, sport_label,
      coalesce(NEW.p1, '—'), coalesce(NEW.p2, '—'),
      coalesce(NEW.bet, '—'), NEW.odds, NEW.units
    );

    if coalesce(NEW.comp, '') <> '' then
      msg := msg || format(E'\n🏆 %s', NEW.comp);
    end if;

    if coalesce(NEW.player, '') <> '' then
      msg := msg || format(
        E'\n👤 %s%s',
        NEW.player,
        case when coalesce(NEW.pteam, '') <> '' then format(' (%s)', NEW.pteam) else '' end
      );
    end if;
  end if;

  if coalesce(NEW.bookmaker, '') <> '' then
    msg := msg || format(E'\n🏠 %s', NEW.bookmaker);
  end if;

  msg := msg || format(E'\n📊 Resultado: %s%su', case when profit >= 0 then '+' else '' end, profit);

  perform public.telegram_send(msg);
  return NEW;
end;
$$;

drop trigger if exists on_bet_pending_insert on public.bets;
create trigger on_bet_pending_insert
  after insert on public.bets
  for each row
  when (NEW.result = 'Pending')
  execute function public.notify_telegram_new_bet();

drop trigger if exists on_bet_resolved_update on public.bets;
create trigger on_bet_resolved_update
  after update on public.bets
  for each row
  when (OLD.result = 'Pending' and NEW.result <> 'Pending')
  execute function public.notify_telegram_resolved();
