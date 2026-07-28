# Rodri Tips — Bet Tracker

## ⚙️ Setup (Supabase)

O site guarda as apostas no [Supabase](https://supabase.com) (Postgres + Auth), partilhadas
publicamente em modo leitura — só o admin (login) pode criar/editar/apagar.

1. Cria um projeto grátis em supabase.com.
2. No SQL Editor, corre o ficheiro [`supabase/schema.sql`](supabase/schema.sql) — já
   inclui tudo (tabela `bets`, `settings`, combinadas, casa de apostas) para uma
   instalação de raiz. Os ficheiros em `supabase/migrations_antigas/` só servem
   para quem já tinha o projeto antes dessas colunas existirem — não são
   precisos numa instalação nova.
3. Em Authentication → Users, cria o utilizador admin com o teu email e uma password.
4. Em Settings → API, copia o **Project URL** e a **anon public key**.
5. Cola-os em [`index.html`](index.html), nas constantes `SUPABASE_URL` e `SUPABASE_ANON_KEY`
   (procura por `SUBSTITUI-PELO-TEU-PROJECT-ID`).

A anon key é segura para expor no frontend — a proteção real de escrita está nas RLS
policies do Supabase, não no JavaScript.

## 🚀 Deploy (GitHub Pages)

Repo → Settings → Pages → Source: **Deploy from branch**, branch `main`, pasta `/(root)`.
O site fica em `https://rczap1.github.io/Rodri-Tips/`.

---

## 📲 PWA (instalar como app)

O site é instalável (manifest.json + service worker):

- **Android/desktop (Chrome/Edge)**: aparece um botão "📲 Instalar" na nav quando o
  browser deteta que dá para instalar.
- **iPhone (Safari)**: não há botão automático — Safari não suporta essa API.
  Aparece uma dica na primeira visita a explicar: **Partilhar → Adicionar ao
  Ecrã Principal**. É este passo que permite mais tarde receber notificações
  push no iOS (ver abaixo).

Não precisa de nenhum setup extra — funciona assim que o `index.html`, o
`manifest.json` e o `sw.js` estão publicados.

## 🔔 Notificações — Telegram (canal principal, recomendado)

Avisa automaticamente um canal/grupo de Telegram sempre que colocas uma
aposta nova (Pending) ou resolves uma pendente (Win/Lost/Void). Não precisa
de Edge Function nem deploy — é só SQL correndo no Supabase.

1. Fala com **@BotFather** no Telegram → `/newbot` → dá-te o **BOT_TOKEN**.
2. Cria um canal ou grupo, adiciona o bot como admin.
3. Envia uma mensagem qualquer no canal, depois visita
   `https://api.telegram.org/bot<BOT_TOKEN>/getUpdates` no browser e procura
   `"chat":{"id": ...}` — esse número é o **CHAT_ID** (alternativa: usar
   `@myidbot`/`@userinfobot`).
4. Abre [`supabase/migration_telegram_notifications.sql`](supabase/migration_telegram_notifications.sql),
   substitui `<BOT_TOKEN>` e `<CHAT_ID>` (só na cópia que colas no SQL
   Editor — **não faças commit** dos valores reais) e corre o ficheiro.

Pronto — a partir daí, cada aposta nova/resolvida cai automaticamente no canal.

## 🔔 Notificações — Push no browser (extra opcional)

Além do Telegram, quem instalar a PWA (ver acima) pode ativar notificações
nativas do browser/telemóvel clicando em "🔔 Notificações" na nav. Esta parte
já precisa de uma Edge Function (o envio exige uma chave privada que não pode
estar no frontend):

1. Gera um par de chaves VAPID: `npx web-push generate-vapid-keys`.
2. Cola a chave pública em [`index.html`](index.html), na constante
   `VAPID_PUBLIC_KEY` (procura por `<VAPID_PUBLIC_KEY>`).
3. Faz login/link e deploy da function:
   ```bash
   npx supabase@latest login
   npx supabase@latest link --project-ref <o-teu-project-ref>
   npx supabase@latest functions deploy send-push --no-verify-jwt
   npx supabase@latest functions deploy subscribe-push
   npx supabase@latest secrets set VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... WEBHOOK_SECRET=...
   ```
   (`WEBHOOK_SECRET` é uma string aleatória à tua escolha — serve para o
   trigger SQL provar à function que o pedido é legítimo.)
4. Abre [`supabase/migration_push_notifications.sql`](supabase/migration_push_notifications.sql),
   substitui `<PROJECT-REF>` e `<WEBHOOK_SECRET>` (mesmo cuidado: só na cópia
   colada no SQL Editor, nunca commitar os valores reais) e corre o ficheiro.

Testa a function localmente antes do deploy real com
`npx supabase functions serve send-push --no-verify-jwt` + `curl` (exemplo em
comentário no topo de `supabase/functions/send-push/index.ts`).

---

## 📁 Estrutura do Projeto

```
Rodri-Tips/
│
├── index.html                            # HTML principal (nav, páginas, modais)
├── manifest.json                         # Manifest da PWA
├── sw.js                                 # Service worker (cache offline + push)
├── css/style.css                         # Estilos
├── js/script.js                          # Lógica da app (dados, render, auth, PWA, push)
├── server.py                             # Servidor local só para testes
└── supabase/
    ├── schema.sql                        # Schema completo — usar numa instalação nova
    ├── migration_telegram_notifications.sql  # Migração: avisos via Telegram
    ├── migration_telegram_monthly_recap.sql   # Migração: balanço mensal no Telegram
    ├── migration_push_notifications.sql      # Migração: notificações push (opcional)
    ├── functions/send-push/index.ts      # Edge Function que envia o push (opcional)
    ├── functions/subscribe-push/index.ts # Edge Function que regista subscrições push
    └── migrations_antigas/               # Só para quem já tinha o projeto antes
                                           # destas colunas existirem no schema.sql
```

## Design System (Paleta & Botões)

Paleta de cores (definida em `css/style.css` como variáveis CSS):

- `--accent`: #aaee33  (Ações primárias — verde)
- `--tennis`: #aaee33  (Ténis)
- `--handball`: #33bbee (Andebol)
- `--mma`: #ee3344     (MMA)
- `--football`: #f97316 (Futebol)
- `--win`: #4ade80     (Ganho)
- `--loss`: #f87171    (Perda)
- `--pending`: #fbbf24 (Pendente)
- `--bg`: #0a0a0f      (Background site)
- `--surface`: #111118 (Cartões / superfícies)
- `--text`: #eeeef8    (Texto principal)
- `--muted`: #5a5a78   (Texto secundário)

Botões — classes recomendadas:

- `btn-add`: ação primária (usar para Guardar, Entrar, +Nova Aposta)
- `btn-cancel` / `btn-save`: já existentes para modais
- `btn-neutral`: ação secundária (ex.: Logout)
- adicionar `full` para largura total (ex.: `class="btn-add full"`)

Não uses estilos inline para cores/bordas — usa estas classes e variáveis.
