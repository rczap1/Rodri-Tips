// Rodri Tips — Edge Function: send-telegram
//
// Recebe { text } (chamada interna a partir de public.telegram_send(), ver
// supabase/migration_telegram_notifications.sql) e envia a mensagem ao canal
// de Telegram.
//
// Existe como Edge Function em vez de uma chamada direta do pg_net para
// api.telegram.org porque essa chamada direta mostrou-se pouco fiável em
// produção (timeouts no handshake TLS mesmo com 15s de margem — ver
// net._http_response). As chamadas para dentro do próprio domínio
// supabase.co (como a `send-push`) nunca falharam nos mesmos logs, por isso
// o Telegram passa a ser enviado a partir daqui, tal como o push.

const BOT_TOKEN      = Deno.env.get("TELEGRAM_BOT_TOKEN")!;
const CHAT_ID         = Deno.env.get("TELEGRAM_CHAT_ID")!;
const WEBHOOK_SECRET  = Deno.env.get("WEBHOOK_SECRET");

Deno.serve(async (req) => {
  if (WEBHOOK_SECRET && req.headers.get('x-webhook-secret') !== WEBHOOK_SECRET) {
    return new Response('Unauthorized', { status: 401 });
  }

  const payload = await req.json().catch(() => null);
  const text = payload?.text;
  if (!text) return new Response('Payload sem texto', { status: 400 });

  const resp = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: CHAT_ID, text }),
  });
  const data = await resp.json().catch(() => null);

  return new Response(JSON.stringify(data), {
    status: resp.status,
    headers: { 'Content-Type': 'application/json' },
  });
});
