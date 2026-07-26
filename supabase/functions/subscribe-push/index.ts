// Rodri Tips — Edge Function: subscribe-push
//
// Recebe pedidos diretos do browser (qualquer visitante, sem login) para
// registar ou remover a subscrição de notificações push. Corre com a chave
// admin (service role), por isso a tabela `push_subscriptions` não precisa
// de nenhuma política pública de RLS — só esta função lhe mexe.
//
// Chamado do frontend via `window.supabase.functions.invoke('subscribe-push', ...)`
// (ver js/script.js, função toggleNotifications) — o cliente autentica-se
// com a mesma chave pública (anon) já usada no resto do site.

import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY  = Deno.env.get("SUPABASE_SECRET_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS });

  const body = await req.json().catch(() => null);
  const endpoint = body?.endpoint;
  if (!endpoint) {
    return new Response(JSON.stringify({ error: 'endpoint em falta' }), { status: 400, headers: CORS_HEADERS });
  }

  const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_KEY);

  if (body.action === 'unsubscribe') {
    const { error } = await supabaseAdmin.from('push_subscriptions').delete().eq('endpoint', endpoint);
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: CORS_HEADERS });
    return new Response(JSON.stringify({ ok: true }), { headers: CORS_HEADERS });
  }

  const { p256dh, auth } = body;
  if (!p256dh || !auth) {
    return new Response(JSON.stringify({ error: 'p256dh/auth em falta' }), { status: 400, headers: CORS_HEADERS });
  }

  const { error } = await supabaseAdmin
    .from('push_subscriptions')
    .upsert({ endpoint, p256dh, auth }, { onConflict: 'endpoint' });
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: CORS_HEADERS });
  return new Response(JSON.stringify({ ok: true }), { headers: CORS_HEADERS });
});
