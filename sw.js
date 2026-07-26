/* ═══════════════════════════════════════════
   RODRI TIPS — service worker
   Cache do "app shell" para experiência PWA/offline básica
   + notificações push (ver Supabase Edge Function send-push)
   ═══════════════════════════════════════════ */

const CACHE_NAME = 'rodri-tips-v3';
const CORE_ASSETS = [
  './',
  './index.html',
  './css/style.css',
  './js/script.js',
  './manifest.json',
  './favicon-16.png',
  './favicon-32.png',
  './favicon-48.png',
  './apple-touch-icon-180.png',
  './pwa-icon-192.png',
  './pwa-icon-512.png',
  './pwa-maskable-192.png',
  './pwa-maskable-512.png',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      // cache:'reload' ignora o cache HTTP do browser ao popular a cache do
      // service worker — sem isto, um deploy novo podia ficar preso a
      // ficheiros antigos se o servidor não mandar cabeçalhos de cache claros.
      // Cada ficheiro falha por si só (.catch) — um asset em falta não deve
      // impedir a instalação do resto da app.
      .then(cache => Promise.all(CORE_ASSETS.map(url =>
        fetch(url, { cache: 'reload' }).then(res => cache.put(url, res)).catch(() => {})
      )))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Só intercetamos GETs do próprio site (app shell). Pedidos a outras origens
// (Supabase, Google Fonts, etc.) seguem direto para a rede — não queremos
// cachear dados de apostas nem arriscar servir respostas antigas da API.
//
// Network-first: tenta sempre a rede primeiro (para nunca ficar preso a uma
// versão antiga depois de um deploy) — só usa a cache quando está offline.
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;

  event.respondWith(
    // cache:'no-store' ignora o Cache-Control do GitHub Pages (max-age=600) —
    // sem isto, "network-first" ainda podia devolver uma resposta antiga
    // guardada pelo próprio browser até o max-age expirar.
    fetch(req, { cache: 'no-store' })
      .then(res => {
        // clone tem de ser síncrono aqui — se esperarmos pelo caches.open()
        // (assíncrono) antes de clonar, o browser já pode ter começado a
        // consumir o body de "res" para entregar à página, e o clone falha
        // com "Response body is already used"
        const resToCache = res.clone();
        if (res.ok) caches.open(CACHE_NAME).then(cache => cache.put(req, resToCache));
        return res;
      })
      .catch(() => caches.match(req))
  );
});

// ── PUSH NOTIFICATIONS ───────────────────────
self.addEventListener('push', event => {
  let data = { title: 'Rodri Tips', body: 'Nova atualização.', url: './#pending' };
  try { data = { ...data, ...event.data.json() }; } catch (e) { /* payload não é JSON, usa defaults */ }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: './pwa-icon-192.png',
      badge: './favicon-48.png',
      data: { url: data.url },
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const targetUrl = new URL(event.notification.data?.url || './', self.location).href;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if (client.url.startsWith(self.location.origin) && 'focus' in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      return self.clients.openWindow(targetUrl);
    })
  );
});
