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

# Meu Projeto HTML

## 📁 Estrutura do Projeto

```
rodri tips/
│
├── index.html          # Ficheiro principal HTML
├── css/
│   └── style.css       # Estilos CSS
├── js/
│   └── script.js       # Código JavaScript
├── assets/             # Pasta para imagens e ficheiros
└── README.md           # Este ficheiro
```

## 📝 Descrição dos Ficheiros

### 1. **index.html** 
- **O quê**: Ficheiro principal da sua página web
- **Para quê**: Contém a estrutura e conteúdo HTML
- **Inclui**: Header, navegação, secções de conteúdo, footer
- **Importante**: É o ficheiro que você abre no navegador

### 2. **css/style.css**
- **O quê**: Ficheiro de estilos
- **Para quê**: Define a aparência visual (cores, fontes, layouts)
- **Inclui**: Estilos para header, navegação, conteúdo, botões e footer
- **Benefício**: Separar o estilo do HTML torna o código mais organizado

### 3. **js/script.js**
- **O quê**: Ficheiro de JavaScript
- **Para quê**: Adiciona interatividade à página
- **Inclui**: Eventos de clique, mensagens de console, funções
- **Exemplo**: Clique no botão para ver uma mensagem

### 4. **assets/**
- **O quê**: Pasta para guardar ficheiros adicionais
- **Para quê**: Organizar imagens, ícones, vídeos, etc.
- **Uso**: Crie subpastas como `images/`, `icons/`, `videos/`

### 5. **README.md**
- **O quê**: Ficheiro de documentação
- **Para quê**: Explica o projeto para você e outros desenvolvedores
- **Inclui**: Instruções, estrutura, informações úteis

## 🚀 Como Começar

1. Abra o ficheiro `index.html` num navegador web
2. Veja a página funcionar
3. Modifique o conteúdo em `index.html`
4. Personalize as cores e estilos em `css/style.css`
5. Adicione lógica em `js/script.js`

## 💡 Dicas

- Use a pasta `assets/` para guardar imagens
- Mantenha os ficheiros CSS e JS separados (melhor organização)
- Sempre use nomes descritivos para as suas classes e IDs
- Teste a página em diferentes navegadores

## 📚 Próximos Passos

- Adicione mais secções ao seu site
- Crie um formulário de contacto
- Adicione imagens com a pasta `assets/`
- Implemente mais funcionalidades em JavaScript

---

Divirta-se criando! 🎉

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
- `btn-outline`: variante outline com borda `--accent` (usar para Criar conta / Voltar)
- `btn-cancel` / `btn-save`: já existentes para modais
- adicionar `full` para largura total (ex.: `class="btn-add full"`)

Não uses estilos inline para cores/bordas — usa estas classes e variáveis.

Se queres, faço um commit com qualquer outro botão inline que encontrares para substituí-los automaticamente.
