# VFA — Virtual Football Association

Site oficial da VFA: liga amadora de futebol 3v3 no Roblox. Quatro ligas nacionais,
mata-mata, Libertadores, Champions League e a decisão Intercontinental — com tabelas
e estatísticas que se atualizam sozinhas a cada resultado registrado.

---

## Índice

1. [Como colocar no ar em 10 minutos](#1-como-colocar-no-ar-em-10-minutos)
2. [Variáveis de ambiente](#2-variáveis-de-ambiente)
3. [Como criar a aplicação no Discord](#3-como-criar-a-aplicação-no-discord)
4. [Comandos disponíveis](#4-comandos-disponíveis)
5. [Arquitetura](#5-arquitetura)
6. [Como o sistema funciona por dentro](#6-como-o-sistema-funciona-por-dentro)
7. [Regras configuráveis](#7-regras-configuráveis-nada-fixo-no-código)
8. [Integração com o Roblox](#8-integração-com-o-roblox)
9. [Segurança](#9-segurança)
10. [API interna](#10-api-interna)
11. [Trocar as cores da VFA](#11-trocar-as-cores-da-vfa)
12. [Deploy](#12-deploy)
13. [O que está pronto e o que depende de você](#13-o-que-está-pronto-e-o-que-depende-de-você)

---

## 1. Como colocar no ar em 10 minutos

Você precisa de **Node.js 20+** e de um banco **PostgreSQL** (o tier gratuito do
Supabase ou do Neon serve).

```bash
# 1. instalar dependências
npm install

# 2. configurar o ambiente
cp .env.example .env.local
#    abra .env.local e preencha DATABASE_URL, AUTH_SECRET e as chaves do Discord
#    (a seção 2 explica cada uma)

# 3. conferir se está tudo certo (testa a conexão com o banco de verdade)
npm run check:env

# 4. criar as tabelas
npm run db:migrate

# 5. popular com dados de demonstração (opcional, mas recomendado na primeira vez)
npm run db:seed

# 6. rodar
npm run dev
```

Abra <http://localhost:3000>.

O seed cria uma temporada inteira e coerente: 4 ligas, 24 clubes, 120 jogadores,
calendário completo com resultados, mata-mata das quatro ligas, Libertadores,
Champions League, final Intercontinental e notícias. Tudo aparece marcado como
dado de demonstração no site.

Para apagar só a demonstração e ficar com os dados reais da VFA:

```bash
npm run db:reset          # remove apenas o que foi criado pelo seed
npm run db:reset -- --all # limpa todo o conteúdo (mantém usuários e configurações)
```

---

## 2. Variáveis de ambiente

Todas ficam em `.env.local`. Esse arquivo **nunca** deve ir para o Git — o
`.gitignore` já cuida disso.

| Variável | Obrigatória | Para que serve |
|---|---|---|
| `DATABASE_URL` | sim | String de conexão do PostgreSQL. Use a versão **com pooler** (Supabase: *Connection string → URI*; Neon: *Pooled connection*). |
| `AUTH_SECRET` | sim | Chave que assina os cookies de sessão. Gere com `npx auth secret`. |
| `AUTH_DISCORD_ID` | sim | Client ID da aplicação criada no Discord. |
| `AUTH_DISCORD_SECRET` | sim | Client Secret da mesma aplicação. |
| `BOOTSTRAP_ADMIN_DISCORD_IDS` | recomendada | Seu ID numérico do Discord. Quem estiver nesta lista vira administrador automaticamente ao entrar. É assim que nasce o primeiro admin. |
| `NEXT_PUBLIC_SITE_URL` | não | URL pública do site. Usada nos metadados e no compartilhamento. |
| `CRON_SECRET` | não | Se definida, protege `/api/cron/publish` com `Authorization: Bearer <valor>`. |

Sem `AUTH_DISCORD_ID`/`AUTH_DISCORD_SECRET` o site sobe normalmente, mas a página
`/entrar` mostra um aviso explicando exatamente o que falta — nada de tela branca.

---

## 3. Como criar a aplicação no Discord

1. Acesse <https://discord.com/developers/applications> e clique em **New Application**.
2. Dê o nome `VFA` e confirme.
3. Vá em **OAuth2** no menu lateral.
4. Copie o **Client ID** → `AUTH_DISCORD_ID`.
5. Clique em **Reset Secret**, copie o valor → `AUTH_DISCORD_SECRET`.
6. Ainda em OAuth2, em **Redirects**, adicione exatamente:
   - `http://localhost:3000/api/auth/callback/discord` (desenvolvimento)
   - `https://SEU-DOMINIO/api/auth/callback/discord` (produção)
7. Salve.

**Para pegar o seu ID de usuário:** no Discord, vá em *Configurações → Avançado →
Modo desenvolvedor*, ative. Depois clique com o botão direito no seu perfil →
*Copiar ID do usuário*. Cole em `BOOTSTRAP_ADMIN_DISCORD_IDS`.

O site pede apenas o escopo `identify` — nome de usuário, apelido e avatar. Não
temos acesso ao e-mail, às mensagens nem à lista de servidores.

---

## 4. Comandos disponíveis

| Comando | O que faz |
|---|---|
| `npm run dev` | Servidor de desenvolvimento. |
| `npm run build` | Build de produção. |
| `npm run start` | Roda o build de produção. |
| `npm run check:env` | Confere as variáveis e testa a conexão com o banco. |
| `npm run db:generate` | Gera uma nova migration a partir de mudanças em `src/db/schema.ts`. |
| `npm run db:migrate` | Aplica as migrations pendentes. |
| `npm run db:push` | Sincroniza o schema direto no banco (só em desenvolvimento). |
| `npm run db:studio` | Abre o Drizzle Studio para inspecionar o banco. |
| `npm run db:seed` | Cria os dados de demonstração. |
| `npm run db:reset` | Remove os dados de demonstração (`-- --all` limpa tudo). |
| `npm run verify:engine` | Roda os testes do motor de classificação e do chaveamento (não precisa de banco). |
| `npm run typecheck` | Checagem de tipos. |
| `npm run lint` | ESLint. |

---

## 5. Arquitetura

| Camada | Escolha |
|---|---|
| Framework | Next.js 16 (App Router) + React 19 |
| Linguagem | TypeScript, modo estrito |
| Estilo | Tailwind CSS v4 |
| Animação | Framer Motion |
| Gráficos | Recharts |
| Banco | PostgreSQL |
| ORM | **Drizzle ORM** |
| Autenticação | Auth.js v5 com Discord OAuth2, sessão em banco |
| Validação | Zod |

### Por que Drizzle e não Prisma

O escopo sugeriu Prisma. A troca foi deliberada:

- **Zero binários.** O Prisma baixa engines nativos na instalação. O Drizzle é
  TypeScript puro — a instalação funciona em qualquer ambiente, inclusive em CI
  com rede restrita.
- **Migrations legíveis.** `drizzle/0000_init.sql` é SQL comum, revisável num
  pull request.
- **Cold start menor** em serverless, o que importa na Vercel.

O schema em `src/db/schema.ts` é declarativo e comentado; quem conhece Prisma se
localiza em minutos.

### Estrutura de pastas

```
drizzle/                    migrations SQL versionadas
scripts/                    migrate, seed, reset, check-env, verify-engine
src/
  app/
    (páginas públicas)      /, jogadores, clubes, classificacao, partidas,
                            competicoes, destaques, noticias, estatisticas
    admin/                  painel administrativo
    api/                    API REST pública e administrativa
  components/
    admin/                  telas de gestão (client components)
    common/                 imagens remotas com fallback
    domain/                 tabela, chaveamento, cards, gráficos
    layout/                 cabeçalho, rodapé, busca global
    ui/                     botão, card, modal, toast, skeleton, campos
  db/                       schema e conexão
  lib/
    engine/                 ← o núcleo do sistema
      config.ts             formato e validação das regras
      standings.ts          cálculo da tabela e desempates (funções puras)
      bracket.ts            planejamento do chaveamento (funções puras)
      generate.ts           geração de calendário e confrontos
      recompute.ts          recálculo das estatísticas
    roblox/                 serviço e sincronização com a API do Roblox
    queries.ts              leitura (todas as páginas passam por aqui)
    mutations.ts            escrita (todas as rotas passam por aqui)
    validators.ts           schemas Zod de tudo que entra
    rbac.ts                 autorização
  proxy.ts                  primeira barreira de /admin
```

---

## 6. Como o sistema funciona por dentro

### A regra que sustenta tudo

**Estatística não se edita. Estatística se calcula.**

A fonte da verdade são três tabelas: `matches`, `match_appearances` e
`match_events`. As tabelas `club_season_stats` e `player_season_stats` são caches
materializados, recalculados por `src/lib/engine/recompute.ts` sempre que um
resultado muda.

Isso elimina de vez a classe de bug em que a tabela de classificação e as
partidas discordam entre si. O preço é recalcular a competição inteira a cada
resultado — com 6 clubes por liga, irrelevante.

### O fluxo completo (item 35 do escopo)

```
admin cadastra jogador
   ↓ vinculado a um clube
clube pertence a uma liga
   ↓
admin registra o resultado de uma partida
   ↓ (uma transação: placar + escalações + eventos)
recomputeCompetition()
   ├─ recalcula a tabela aplicando pontuação e desempates configurados
   ├─ recalcula gols, assistências, cartões e aproveitamento de cada jogador
   └─ resolveChampion() define o campeão quando a competição termina
   ↓
advanceBracket() cria os confrontos da fase seguinte com os vencedores
   ↓
posição final na tabela + zonas de classificação
   ↓
populateContinental() monta a Libertadores / Champions com os classificados
   ↓
campeão de cada continental
   ↓
populateIntercontinental() monta a final entre os dois campeões
```

Cada seta desse diagrama é uma função com nome próprio, testável e comentada.

### O chaveamento de 6 clubes

O escopo pedia "quartas → semifinal → final" com 6 clubes por liga. Seis clubes
não preenchem uma chave de quartas, que pede oito. A solução implementada:

```
1º ────────────────────────┐
                           ├── Semifinal ──┐
4º ──┐                     │               │
     ├── Quartas ──────────┘               ├── FINAL
5º ──┘                                     │
                                           │
2º ────────────────────────┐               │
                           ├── Semifinal ──┘
3º ──┐                     │
     ├── Quartas ──────────┘
6º ──┘
```

O 1º e o 2º entram direto na semifinal (dois *byes*); 3º×6º e 4º×5º disputam as
quartas. O número de classificados e de byes é configurável: para usar só os 4
primeiros, mude para `qualifiers: 4, byes: 0` no painel — o gerador se ajusta
sozinho e nomeia as fases corretamente.

Uma configuração impossível (por exemplo 6 classificados sem bye) devolve uma
mensagem explicando o problema, em vez de gerar uma chave quebrada.

### Sobre a fase de grupos da Libertadores

O escopo pedia 8 clubes com "fase de grupos ou formato configurável" **e**
quartas de final. Os dois juntos não fecham: 8 clubes em 2 grupos de 4, com
quartas depois, classificam os 8 — a fase de grupos não elimina ninguém.

O padrão entregue é **mata-mata direto de 8 clubes** (quartas → semifinal →
final), que é exatamente a lista de fases pedida. A fase de grupos existe no
sistema e pode ser ligada pelo painel; nesse caso reduza `knockout.qualifiers`
para 4 e ela passa a eliminar de verdade.

---

## 7. Regras configuráveis (nada fixo no código)

Item 34 do escopo. Tudo abaixo mora no banco e é editado pelo painel:

**Por competição** (`/admin/competicoes`):

- pontos por vitória, empate e derrota;
- critérios de desempate, com a ordem definida por você (pontos, vitórias, saldo,
  gols marcados, gols sofridos, confronto direto, cartões, ordem alfabética);
- número de clubes e de turnos;
- mata-mata: quantos se classificam, quantos byes, jogo único ou ida e volta,
  disputa de terceiro lugar, critério de desempate do confronto, semeadura;
- fase de grupos: número de grupos, quantos avançam, turnos.

**Por liga** (`/admin/competicoes` → *Zonas de classificação*):

- rótulo, cor e intervalo de posições de cada faixa da tabela;
- competição de destino de cada faixa.

É a zona de classificação que faz "os 4 primeiros vão à Libertadores"
funcionar. Não existe `if (posicao <= 4)` em lugar nenhum do código.

**Globais** (`/admin/configuracoes`):

- paleta de cores do site;
- nome, nome completo, frase e logo da VFA;
- validade do cache do Roblox e liga/desliga da integração.

O confronto direto merece uma nota: quando três ou mais clubes empatam, o sistema
monta uma **minitabela** só com os jogos entre os envolvidos, em vez de comparar
dois a dois — comparação par a par pode ser cíclica (A vence B, B vence C, C
vence A) e produzir uma classificação incoerente.

---

## 8. Integração com o Roblox

Os endpoints usados são **públicos e não exigem chave de API**. Não há token para
vazar. Toda chamada acontece no servidor (`src/lib/roblox/service.ts`), nunca no
navegador.

O que é buscado e salvo: User ID, username, display name, avatar de corpo
inteiro, headshot, data de criação da conta, descrição e selo de verificação.
**Campo que a API não devolver simplesmente não aparece no site** — não existe
placeholder inventado.

### O risco que você precisa conhecer

A API pública do Roblox fica atrás do Cloudflare, que frequentemente **bloqueia
requisições vindas de IPs de datacenter**. Na prática: a integração pode
funcionar numa hospedagem e falhar em outra, sem que nada no código esteja
errado.

O sistema foi construído assumindo esse cenário:

- toda chamada tem timeout de 8 segundos e nunca derruba a requisição do usuário;
- o resultado fica em cache no banco, com validade configurável (padrão 24h);
- quando a API falha, o jogador **continua cadastrado** e o erro fica registrado,
  visível só para o administrador;
- o botão **"Atualizar dados Roblox"** força uma nova tentativa a qualquer
  momento, por jogador.

Se o seu host bloquear, as alternativas são hospedar em outro provedor ou colocar
um proxy próprio na frente. A estrutura já está pronta para os dois casos: basta
apontar as constantes de URL em `src/lib/roblox/service.ts`.

---

## 9. Segurança

| Item | Como foi resolvido |
|---|---|
| Autenticação | Discord OAuth2 via Auth.js, escopo mínimo (`identify`). |
| Sessão | Armazenada no banco, não em JWT — banir ou rebaixar alguém tem efeito na requisição seguinte, sem esperar token expirar. |
| Autorização | Três camadas independentes: `proxy.ts`, `requireAdmin()` no topo de cada página de `/admin` **antes de qualquer consulta**, e `adminRoute()` em toda rota de API. |
| Permissão no frontend | Nunca é fonte de verdade. Esconder o botão do menu é conveniência visual; quem chamar a rota direto continua barrado. |
| SQL Injection | Drizzle usa consultas parametrizadas em 100% do código. Não há concatenação de SQL. |
| XSS | O HTML das notícias é sanitizado no servidor antes de gravar **e** de novo na leitura (`src/lib/sanitize.ts`): sem `<script>`, sem handlers inline, sem `javascript:` em `href`/`src`. |
| Validação | Todo payload passa por um schema Zod antes de tocar no banco (`src/lib/validators.ts`). |
| Rate limiting | Por IP na busca pública, por usuário nas rotas administrativas. |
| Segredos | Só no servidor, sempre via variáveis de ambiente. Nenhum é exposto ao navegador. |
| Cabeçalhos | `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`, `Permissions-Policy`; `X-Powered-By` removido. |
| Auditoria | Toda ação administrativa grava uma linha em `audit_logs` com autor, ação e payload. |

Duas travas que valem menção porque protegem contra erro humano:

- não é possível deixar a liga **sem nenhum administrador ativo**, nem rebaixar a
  própria conta;
- não é possível excluir um clube que tenha partidas registradas — a mensagem
  explica que isso destruiria o histórico e sugere o caminho correto.

Sobre a proteção do `/admin`: no App Router, `layout` e `page` renderizam em
paralelo. Uma checagem só no layout deixa os dados da página serem buscados e
transmitidos antes do redirect fazer efeito. Por isso a checagem está **no topo
de cada página**, antes de qualquer consulta ao banco.

---

## 10. API interna

### Pública (leitura)

| Rota | Descrição |
|---|---|
| `GET /api/players` | Lista com filtros (`q`, `leagueId`, `clubId`, `nationId`, `position`) e paginação. |
| `GET /api/players/:slug` | Perfil, estatísticas da temporada e histórico. |
| `GET /api/clubs` | Lista de clubes. |
| `GET /api/clubs/:slug` | Clube, elenco, totais e partidas. |
| `GET /api/leagues` | Ligas com as zonas de classificação. |
| `GET /api/matches` | Partidas com filtros e paginação. |
| `GET /api/matches/:id` | Partida, eventos e escalações. |
| `GET /api/competitions` | Competições da temporada. |
| `GET /api/competitions/:slug` | Competição, participantes, fases, partidas e tabela. |
| `GET /api/standings` | Tabela de uma competição, ou de todas as ligas. |
| `GET /api/news` | Notícias publicadas. |
| `GET /api/news/:slug` | Notícia completa. |
| `GET /api/search?q=` | Busca global. |

### Administrativa (exige sessão com papel ADMIN)

```
POST   /api/admin/players                       PATCH/DELETE /api/admin/players/:id
POST   /api/admin/players/:id/roblox            POST   /api/admin/players/:id/transfer
POST   /api/admin/clubs                         PATCH/DELETE /api/admin/clubs/:id
POST   /api/admin/matches                       PATCH/DELETE /api/admin/matches/:id
POST   /api/admin/matches/:id/result
POST   /api/admin/competitions                  PATCH/DELETE /api/admin/competitions/:id
PUT    /api/admin/competitions/:id/teams
POST   /api/admin/competitions/:id/generate     POST   /api/admin/competitions/:id/populate
PUT    /api/admin/leagues/:id/zones
POST   /api/admin/news                          PATCH/DELETE /api/admin/news/:id
POST   /api/admin/seasons                       POST   /api/admin/seasons/:id/activate
PATCH  /api/admin/users/:id
GET/PUT /api/admin/settings
POST   /api/admin/recompute
```

Formato das respostas:

```jsonc
// sucesso
{ "ok": true, "data": { }, "meta": { } }

// erro
{ "ok": false, "error": "mensagem em português", "details": { "campo": "motivo" } }
```

---

## 11. Trocar as cores da VFA

Duas formas, e as duas mudam o site inteiro:

**Pelo painel** — `/admin/configuracoes` → *Identidade visual*. As cores viram
CSS variables no `<html>` em tempo de execução.

**No código** — `src/app/globals.css`, bloco `:root` no topo do arquivo. É o
único lugar do projeto onde existe um valor de cor escrito à mão. Nenhum
componente tem cor fixa: todos apontam para essas variáveis.

```css
:root {
  --vfa-accent: #00e08f;      /* destaque principal */
  --vfa-accent-alt: #1e6bff;  /* apoio, gradientes  */
  --vfa-bg: #070b12;          /* fundo              */
  --vfa-surface: #0e141f;     /* cards              */
  --vfa-fg: #e9eef7;          /* texto              */
  --vfa-border: #1c2534;      /* linhas             */
}
```

**Tipografia:** o site usa a pilha nativa do sistema — zero requisição de rede
para fontes. Para trocar por uma fonte do Google, importe de `next/font/google`
em `src/app/layout.tsx` e aponte `--font-display` para a variável dela. É o único
ponto que precisa mudar.

---

## 12. Deploy

### Vercel (caminho mais curto)

1. Suba o repositório para o GitHub.
2. Na Vercel: *Add New → Project* e importe o repositório.
3. Em *Environment Variables*, adicione as mesmas do `.env.local`.
4. Deploy.
5. Volte ao Discord Developer Portal e adicione a URL de produção em *Redirects*:
   `https://SEU-DOMINIO/api/auth/callback/discord`.
6. Rode as migrations contra o banco de produção:
   ```bash
   DATABASE_URL="postgresql://…produção…" npm run db:migrate
   ```

### Publicação agendada de notícias

Matérias agendadas são publicadas quando alguém abre o painel administrativo, o
que costuma bastar. Para não depender disso, chame `/api/cron/publish`
periodicamente. Na Vercel, crie `vercel.json`:

```json
{
  "crons": [{ "path": "/api/cron/publish", "schedule": "*/15 * * * *" }]
}
```

Defina `CRON_SECRET` se quiser proteger a rota.

---

## 13. O que está pronto e o que depende de você

### Verificado funcionando

Cada item abaixo foi testado com o sistema rodando contra um PostgreSQL real:

- estrutura completa do banco, com índices e separação por temporada;
- motor de classificação, com 17 verificações automatizadas (`npm run verify:engine`);
- gerador de calendário (turno e returno) e de chaveamento (com byes);
- CRUD de jogadores, clubes, partidas, competições, notícias e usuários;
- registro de resultado recalculando tabela, estatísticas, chaveamento e campeão;
- Libertadores, Champions League e Intercontinental disputadas de ponta a ponta
  pelo seed, com campeão definido em cada uma;
- transferências preservando o histórico;
- controle de permissões: usuário comum barrado nas rotas e sem acesso aos dados
  do painel;
- validação de entrada devolvendo mensagem por campo;
- páginas públicas, painel administrativo, busca global e API respondendo;
- build de produção limpo, zero erro de tipo, zero aviso de lint.

### Depende de credenciais suas

- **Login com Discord.** O fluxo está implementado e a interface avisa quando
  falta configuração, mas só funciona de ponta a ponta com o Client ID e o Secret
  da *sua* aplicação. Sem isso não há como testar — as credenciais são pessoais.
- **Dados reais do Roblox.** O seed usa usernames fictícios, que não existem na
  plataforma. Cadastre um jogador real e clique em *Atualizar dados Roblox* para
  ver avatar e display name chegarem.

### Escolhas que valem revisar

- **Escudos e logos por URL.** Não há upload de arquivos: o administrador cola o
  link da imagem. Adicionar um bucket S3 ou o Vercel Blob é uma extensão natural,
  mas é infraestrutura a mais para manter.
- **Rate limiting em memória.** Suficiente para o volume da VFA. Com várias
  instâncias, cada uma tem o próprio contador. Trocar por Redis é substituir um
  `Map` mantendo a mesma assinatura em `src/lib/api.ts`.
- **Editor de texto rico.** Usa `contenteditable` + `document.execCommand`,
  oficialmente obsoleto mas funcional em todos os navegadores, e sem trazer 200 kB
  de biblioteca. Se um dia precisar de mais, troque só
  `src/components/admin/rich-text-editor.tsx` — o resto do sistema só conhece a
  string de HTML que ele produz.

---

## Licença e avisos

Projeto feito sob medida para a VFA. Não é afiliado à Roblox Corporation. Os dados
de perfil vêm da API pública do Roblox e pertencem aos seus donos.
