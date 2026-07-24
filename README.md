# Rodri Tips — Bet Tracker

## ⚙️ Setup (Supabase)

O site guarda as apostas no [Supabase](https://supabase.com) (Postgres + Auth), partilhadas
publicamente em modo leitura — só o admin (login) pode criar/editar/apagar.

1. Cria um projeto grátis em supabase.com.
2. No SQL Editor, corre o ficheiro [`supabase/schema.sql`](supabase/schema.sql) (cria a
   tabela `bets` e as políticas de segurança — RLS).
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

## 📁 Estrutura do Projeto

```
Rodri-Tips/
│
├── index.html              # HTML principal (nav, páginas, modais)
├── css/style.css           # Estilos
├── js/script.js            # Lógica da app (dados, render, auth)
├── server.py                # Servidor local só para testes
└── supabase/
    ├── schema.sql           # Cria a tabela `bets` do zero + RLS
    └── migration_combo.sql  # Migração para quem já tinha a tabela antiga
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
