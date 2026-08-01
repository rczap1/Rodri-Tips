// Rodri Tips — Edge Function: send-push
//
// Recebe o payload de um Database Webhook (trigger em `public.bets`, ver
// supabase/migration_push_notifications.sql) e envia notificações push a
// todos os browsers subscritos em `push_subscriptions`.
//
// Usa `npm:web-push` — mesma biblioteca usada para gerar as chaves VAPID
// (`npx web-push generate-vapid-keys`), por isso o formato das chaves bate
// certo. (Já tentámos `jsr:@negrel/webpush` primeiro; falhava em runtime com
// "Failed to execute 'importKey'" porque espera as chaves em formato JWK,
// não no formato base64url que o `web-push` gera.)

import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const SUPABASE_URL   = Deno.env.get("SUPABASE_URL")!;
// Projeto usa o novo sistema de chaves (confirmado no painel "Connect to your
// project" do Dashboard: SUPABASE_SECRET_KEY) — cai para o nome legado só por
// segurança, caso o projeto seja migrado de volta.
const SERVICE_KEY    = Deno.env.get("SUPABASE_SECRET_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const WEBHOOK_SECRET = Deno.env.get("WEBHOOK_SECRET");
const VAPID_PUBLIC_KEY  = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY")!;

const SPORT_ICON: Record<string, string> = { Tennis: '🎾', Handball: '🤾', MMA: '🥊', Football: '⚽' };
const SPORT_LABEL: Record<string, string> = { Tennis: 'Ténis', Handball: 'Andebol', MMA: 'MMA', Football: 'Futebol' };
const RESULT_ICON: Record<string, string> = { Win: '✅', Lost: '❌', Void: '↩️' };
const RESULT_LABEL: Record<string, string> = { Win: 'Aposta Ganha', Lost: 'Aposta Perdida', Void: 'Aposta Anulada' };
const LEG_ICON: Record<string, string> = { Win: '✅', Lost: '❌', Void: '↩️', Pending: '⏳' };

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function legLine(leg: any, withIcon: boolean) {
  const prefix = withIcon ? `${LEG_ICON[leg.result] ?? '⏳'} ` : '';
  const compSuffix = leg.comp ? ` (${leg.comp})` : '';
  return `${prefix}${leg.p1} vs ${leg.p2} — ${leg.bet}${compSuffix}`;
}

// Mesma informação que as mensagens de Telegram (ver
// supabase/migration_telegram_notifications.sql) — só omite dinheiro (€).
function buildMessage(payload: any) {
  const record = payload.record;
  const icon = SPORT_ICON[record.sport] ?? '🏆';
  const sportLabel = SPORT_LABEL[record.sport] ?? record.sport;
  const isCombo = record.bet_type === 'combo';

  if (payload.type === 'INSERT') {
    // Futuras não revelam nada — mantém a curiosidade, tal como no Telegram
    if (record.is_future) {
      let body = 'Consulta o site para veres os detalhes.';
      if (record.expected_result_date) body += `\n📅 Resultado esperado: ${record.expected_result_date}`;
      return { title: '🔮 Nova aposta futura!', body, url: './#futures' };
    }

    const potential = round2(record.units * record.odds);

    if (isCombo) {
      const legsText = (record.legs ?? []).map((l: any) => legLine(l, false)).join('\n');
      let body = `${legsText}\nOdd Total @${record.odds} · ${record.units}u`;
      if (record.bookmaker) body += `\n🏠 ${record.bookmaker}`;
      body += `\n📈 Retorno potencial: ${potential}u`;
      return { title: `🧩 Nova combinada — ${icon} ${sportLabel}`, body, url: './#pending' };
    }

    let body = `${record.p1} vs ${record.p2}\n${record.bet} @${record.odds} · ${record.units}u`;
    if (record.comp) body += `\n🏆 ${record.comp}`;
    if (record.player) body += `\n👤 ${record.player}${record.pteam ? ` (${record.pteam})` : ''}`;
    if (record.bookmaker) body += `\n🏠 ${record.bookmaker}`;
    body += `\n📈 Retorno potencial: ${potential}u`;
    return { title: `🎯 Nova aposta — ${icon} ${sportLabel}`, body, url: './#pending' };
  }

  // UPDATE → aposta resolvida
  const ic = RESULT_ICON[record.result] ?? '';
  const label = RESULT_LABEL[record.result] ?? record.result;
  const profit = record.result === 'Win' ? round2(record.units * record.odds - record.units)
    : record.result === 'Lost' ? -record.units : 0;
  const profitStr = `${profit >= 0 ? '+' : ''}${profit}u`;

  if (isCombo) {
    const legsText = (record.legs ?? []).map((l: any) => legLine(l, true)).join('\n');
    let body = `${legsText}\nOdd Total @${record.odds} · ${record.units}u`;
    if (record.bookmaker) body += `\n🏠 ${record.bookmaker}`;
    body += `\n📊 Resultado: ${profitStr}`;
    return { title: `${ic} ${label} — Combinada ${icon} ${sportLabel}`, body, url: './#history' };
  }

  if (record.is_future) {
    let body = `${record.bet} @${record.odds} · ${record.units}u`;
    if (record.comp) body += `\n🏆 ${record.comp}`;
    if (record.bookmaker) body += `\n🏠 ${record.bookmaker}`;
    body += `\n📊 Resultado: ${profitStr}`;
    return { title: `${ic} ${label} — Futura ${icon} ${sportLabel}`, body, url: './#futures' };
  }

  let body = `${record.p1} vs ${record.p2}\n${record.bet} @${record.odds} · ${record.units}u`;
  if (record.comp) body += `\n🏆 ${record.comp}`;
  if (record.player) body += `\n👤 ${record.player}${record.pteam ? ` (${record.pteam})` : ''}`;
  if (record.bookmaker) body += `\n🏠 ${record.bookmaker}`;
  body += `\n📊 Resultado: ${profitStr}`;
  return { title: `${ic} ${label} — ${icon} ${sportLabel}`, body, url: './#history' };
}

Deno.serve(async (req) => {
  if (WEBHOOK_SECRET && req.headers.get('x-webhook-secret') !== WEBHOOK_SECRET) {
    return new Response('Unauthorized', { status: 401 });
  }

  const payload = await req.json().catch(() => null);
  const record = payload?.record;
  if (!record) return new Response('Payload sem record', { status: 400 });

  // Segurança extra: só notifica INSERTs realmente Pending (backfills
  // históricos já entram resolvidos e não devem gerar notificação)
  if (payload.type === 'INSERT' && record.result !== 'Pending') {
    return new Response('Ignorado (não é Pending)', { status: 200 });
  }

  const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_KEY);
  const { data: subs, error } = await supabaseAdmin.from('push_subscriptions').select('*');
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });

  const { title, body, url } = buildMessage(payload);
  const message = JSON.stringify({ title, body, url });

  webpush.setVapidDetails(
    'mailto:rodrigofcarvalho421@gmail.com',
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY,
  );

  const results = await Promise.allSettled((subs ?? []).map(async (sub) => {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        message,
      );
    } catch (e: any) {
      if (e?.statusCode === 404 || e?.statusCode === 410) {
        await supabaseAdmin.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
      }
      throw e;
    }
  }));

  const sent = results.filter(r => r.status === 'fulfilled').length;
  return new Response(JSON.stringify({ sent, total: (subs ?? []).length }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
