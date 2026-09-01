/**
 * VFA — Virtual Football Association
 * Schema do banco de dados (PostgreSQL via Drizzle ORM).
 *
 * Princípios de modelagem:
 *  1. A fonte da verdade das estatísticas são `matches` + `matchAppearances` +
 *     `matchEvents`. As tabelas `playerSeasonStats` e `clubSeasonStats` são
 *     caches materializados, recalculados por `src/lib/engine/recompute.ts`
 *     sempre que um resultado muda. Ninguém edita estatística à mão.
 *  2. Regras de competição (pontuação, desempate, vagas, formato do mata-mata,
 *     cores das zonas) moram no banco — `appSettings`, `competitions.config` e
 *     `qualificationZones` — nunca fixas no código.
 *  3. Todo dado estatístico é particionado por temporada para não misturar
 *     históricos entre 2026, 2027, 2028...
 */

import { relations, sql } from 'drizzle-orm';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import type { AdapterAccountType } from 'next-auth/adapters';

const id = () =>
  text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());

const createdAt = () => timestamp('created_at', { withTimezone: true }).defaultNow().notNull();
const updatedAt = () =>
  timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date());

/* ══════════════════════════════════════════════════════════════
   ENUMS
   ══════════════════════════════════════════════════════════════ */

export const roleEnum = pgEnum('role', ['USER', 'ADMIN']);
export const continentEnum = pgEnum('continent', [
  'SOUTH_AMERICA',
  'EUROPE',
  'NORTH_AMERICA',
  'AFRICA',
  'ASIA',
  'OCEANIA',
]);
/**
 * Posições em campo.
 *
 * A ordem aqui é a do ATAQUE para o GOL, na sequência exata em que a VFA as
 * listou. A versão anterior ia do gol para o ataque, seguindo a convenção de
 * escalação — mas convenção genérica perde para a preferência de quem
 * administra a liga, e é essa ordem que aparece em todo menu do site.
 *
 * Mudar a ordem do enum no PostgreSQL exigiria recriar o tipo. Não vale: a
 * ordem de exibição é decidida por `POSITION_ORDER` em src/lib/utils.ts, que
 * é onde o site lê. O enum guarda os valores; ele não precisa guardar gosto.
 */
export const positionEnum = pgEnum('position', [
  'GOALKEEPER',
  'DEFENDER',
  'DEFENSIVE_MIDFIELDER',
  'MIDFIELDER',
  'ATTACKING_MIDFIELDER',
  'FORWARD',
]);
export const competitionTypeEnum = pgEnum('competition_type', [
  'LEAGUE',
  'LEAGUE_PLAYOFF',
  'CONTINENTAL',
  'INTERCONTINENTAL',
  'CUP',
]);
export const competitionStatusEnum = pgEnum('competition_status', [
  'DRAFT',
  'UPCOMING',
  'IN_PROGRESS',
  'FINISHED',
]);
export const roundTypeEnum = pgEnum('round_type', ['REGULAR', 'GROUP', 'KNOCKOUT']);
export const matchStatusEnum = pgEnum('match_status', [
  'SCHEDULED',
  'LIVE',
  'FINISHED',
  'POSTPONED',
  'CANCELLED',
]);
export const matchEventTypeEnum = pgEnum('match_event_type', [
  'GOAL',
  'OWN_GOAL',
  'PENALTY_GOAL',
  'PENALTY_MISS',
  'YELLOW_CARD',
  'RED_CARD',
]);
export const transferTypeEnum = pgEnum('transfer_type', [
  'SIGNING',
  'TRANSFER',
  'LOAN',
  'RELEASE',
]);
export const newsStatusEnum = pgEnum('news_status', ['DRAFT', 'SCHEDULED', 'PUBLISHED']);

/* ══════════════════════════════════════════════════════════════
   AUTENTICAÇÃO — Discord OAuth2 via Auth.js
   ══════════════════════════════════════════════════════════════ */

export const users = pgTable(
  'users',
  {
    id: id(),
    name: text('name'),
    email: text('email').unique(),
    emailVerified: timestamp('email_verified', { withTimezone: true }),
    image: text('image'),

    // Espelho dos dados do Discord, preenchido no primeiro login.
    discordId: text('discord_id').unique(),
    discordUsername: text('discord_username'),
    discordGlobalName: text('discord_global_name'),

    /** Papel do usuário. Só o backend lê isto — nunca confiar no frontend. */
    role: roleEnum('role').default('USER').notNull(),
    isBanned: boolean('is_banned').default(false).notNull(),

    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('users_role_idx').on(t.role)],
);

export const accounts = pgTable(
  'accounts',
  {
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: text('type').$type<AdapterAccountType>().notNull(),
    provider: text('provider').notNull(),
    providerAccountId: text('provider_account_id').notNull(),
    refresh_token: text('refresh_token'),
    access_token: text('access_token'),
    expires_at: integer('expires_at'),
    token_type: text('token_type'),
    scope: text('scope'),
    id_token: text('id_token'),
    session_state: text('session_state'),
  },
  (t) => [
    primaryKey({ columns: [t.provider, t.providerAccountId] }),
    index('accounts_user_idx').on(t.userId),
  ],
);

export const sessions = pgTable('sessions', {
  sessionToken: text('session_token').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  expires: timestamp('expires', { withTimezone: true }).notNull(),
});

export const verificationTokens = pgTable(
  'verification_tokens',
  {
    identifier: text('identifier').notNull(),
    token: text('token').notNull(),
    expires: timestamp('expires', { withTimezone: true }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.identifier, t.token] })],
);

/** Trilha de auditoria de tudo que um administrador altera. */
export const auditLogs = pgTable(
  'audit_logs',
  {
    id: id(),
    userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),
    action: text('action').notNull(),
    entity: text('entity').notNull(),
    entityId: text('entity_id'),
    payload: jsonb('payload'),
    createdAt: createdAt(),
  },
  (t) => [
    index('audit_entity_idx').on(t.entity, t.entityId),
    index('audit_created_idx').on(t.createdAt),
  ],
);

/* ══════════════════════════════════════════════════════════════
   ESTRUTURA DA LIGA
   ══════════════════════════════════════════════════════════════ */

export const nations = pgTable('nations', {
  id: id(),
  code: text('code').notNull().unique(), // ISO-3166 alpha-2
  name: text('name').notNull(),
  flagEmoji: text('flag_emoji').notNull(),
});

export const seasons = pgTable(
  'seasons',
  {
    id: id(),
    year: integer('year').notNull().unique(),
    name: text('name').notNull(),
    /** Só uma temporada fica ativa por vez — garantido em `setActiveSeason()`. */
    isActive: boolean('is_active').default(false).notNull(),
    isArchived: boolean('is_archived').default(false).notNull(),
    startDate: timestamp('start_date', { withTimezone: true }),
    endDate: timestamp('end_date', { withTimezone: true }),
    /** Frase de apoio do hero da home. */
    tagline: text('tagline'),
    bannerUrl: text('banner_url'),
    createdAt: createdAt(),
  },
  (t) => [index('seasons_active_idx').on(t.isActive)],
);

export const leagues = pgTable(
  'leagues',
  {
    id: id(),
    slug: text('slug').notNull().unique(),
    name: text('name').notNull(),
    shortName: text('short_name').notNull(),
    logoUrl: text('logo_url'),
    /** Cor de destaque da liga (hex). Cai para o accent global se vazio. */
    accent: text('accent'),
    continent: continentEnum('continent').notNull(),
    nationId: text('nation_id').references(() => nations.id, { onDelete: 'set null' }),
    sortOrder: integer('sort_order').default(0).notNull(),
  },
  (t) => [index('leagues_continent_idx').on(t.continent)],
);

/**
 * Faixas de classificação da tabela (ex.: 1º–4º → Libertadores).
 * Rótulo, cor e intervalo são 100% editáveis pelo administrador — o item 10
 * do escopo não vira `if (position <= 4)` em lugar nenhum.
 */
export const qualificationZones = pgTable(
  'qualification_zones',
  {
    id: id(),
    leagueId: text('league_id')
      .notNull()
      .references(() => leagues.id, { onDelete: 'cascade' }),
    label: text('label').notNull(),
    color: text('color').notNull(),
    fromPosition: integer('from_position').notNull(),
    toPosition: integer('to_position').notNull(),
    /** Slug da competição de destino, quando houver. */
    targetSlug: text('target_slug'),
    sortOrder: integer('sort_order').default(0).notNull(),
  },
  (t) => [index('zones_league_idx').on(t.leagueId)],
);

export const clubs = pgTable(
  'clubs',
  {
    id: id(),
    slug: text('slug').notNull().unique(),
    name: text('name').notNull(),
    shortName: text('short_name').notNull(),
    /** Três letras para tabelas compactas e chaveamentos. */
    abbreviation: text('abbreviation').notNull(),
    logoUrl: text('logo_url'),
    primaryColor: text('primary_color').default('#e5e7eb').notNull(),
    secondaryColor: text('secondary_color').default('#0b0f17').notNull(),
    ownerName: text('owner_name'),
    /**
     * Capitão do clube. Referência circular clubs ↔ players — o Drizzle
     * resolve emitindo a FK num ALTER TABLE depois de criar as duas tabelas.
     */
    captainId: text('captain_id').references((): AnyPgColumn => players.id, {
      onDelete: 'set null',
    }),
    leagueId: text('league_id')
      .notNull()
      .references(() => leagues.id, { onDelete: 'restrict' }),
    nationId: text('nation_id').references(() => nations.id, { onDelete: 'set null' }),
    foundedAt: timestamp('founded_at', { withTimezone: true }),
    stadium: text('stadium'),
    isDemo: boolean('is_demo').default(false).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('clubs_league_idx').on(t.leagueId)],
);

/**
 * Participação de um clube numa temporada. Mantém o histórico correto mesmo
 * quando o clube muda de liga em temporadas seguintes.
 */
export const clubSeasonMemberships = pgTable(
  'club_season_memberships',
  {
    id: id(),
    clubId: text('club_id')
      .notNull()
      .references(() => clubs.id, { onDelete: 'cascade' }),
    seasonId: text('season_id')
      .notNull()
      .references(() => seasons.id, { onDelete: 'cascade' }),
    leagueId: text('league_id')
      .notNull()
      .references(() => leagues.id, { onDelete: 'cascade' }),
  },
  (t) => [
    uniqueIndex('club_season_unique').on(t.clubId, t.seasonId),
    index('club_season_league_idx').on(t.seasonId, t.leagueId),
  ],
);

export const players = pgTable(
  'players',
  {
    id: id(),
    slug: text('slug').notNull().unique(),
    /** Nome exibido no site. Cai para `robloxDisplayName` quando vazio. */
    displayName: text('display_name').notNull(),
    nationId: text('nation_id').references(() => nations.id, { onDelete: 'set null' }),
    currentClubId: text('current_club_id').references(() => clubs.id, { onDelete: 'set null' }),
    shirtNumber: integer('shirt_number'),
    position: positionEnum('position').default('MIDFIELDER').notNull(),

    /**
     * Nota geral do jogador, de 1 a 99, digitada pelo administrador.
     *
     * O RANK (Elite X, Gold A…) não fica aqui: é derivado desta nota em
     * src/lib/ranks.ts. Guardar os dois abriria espaço para eles divergirem —
     * bastaria alguém editar a nota e esquecer o rank.
     *
     * Nulo é um estado legítimo: jogador recém-cadastrado ainda não foi
     * avaliado, e isso é diferente de ter nota zero.
     */
    overall: integer('overall'),
    isActive: boolean('is_active').default(true).notNull(),
    isDemo: boolean('is_demo').default(false).notNull(),
    joinedAt: timestamp('joined_at', { withTimezone: true }),

    // ── Dados públicos do Roblox, preenchidos por src/lib/roblox/service.ts ──
    robloxUsername: text('roblox_username').notNull().unique(),
    robloxUserId: text('roblox_user_id').unique(),
    robloxDisplayName: text('roblox_display_name'),
    robloxAvatarUrl: text('roblox_avatar_url'),
    robloxHeadshotUrl: text('roblox_headshot_url'),
    robloxCreatedAt: timestamp('roblox_created_at', { withTimezone: true }),
    robloxDescription: text('roblox_description'),
    robloxIsVerified: boolean('roblox_is_verified'),
    /** Última sincronização bem-sucedida. Governa o TTL do cache. */
    robloxSyncedAt: timestamp('roblox_synced_at', { withTimezone: true }),
    /** Último erro de sincronização. Visível apenas no painel admin. */
    robloxSyncError: text('roblox_sync_error'),

    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('players_club_idx').on(t.currentClubId),
    index('players_position_idx').on(t.position),
    index('players_nation_idx').on(t.nationId),
  ],
);

/* ══════════════════════════════════════════════════════════════
   COMPETIÇÕES
   ══════════════════════════════════════════════════════════════ */

export const competitions = pgTable(
  'competitions',
  {
    id: id(),
    slug: text('slug').notNull().unique(),
    name: text('name').notNull(),
    shortName: text('short_name'),
    type: competitionTypeEnum('type').notNull(),
    status: competitionStatusEnum('status').default('DRAFT').notNull(),
    seasonId: text('season_id')
      .notNull()
      .references(() => seasons.id, { onDelete: 'cascade' }),
    leagueId: text('league_id').references(() => leagues.id, { onDelete: 'set null' }),
    logoUrl: text('logo_url'),
    accent: text('accent'),
    /** Competição que alimenta esta (ex.: liga → playoff → continental). */
    parentSlug: text('parent_slug'),
    championClubId: text('champion_club_id').references(() => clubs.id, { onDelete: 'set null' }),
    sortOrder: integer('sort_order').default(0).notNull(),
    isDemo: boolean('is_demo').default(false).notNull(),

    /**
     * Regras da competição. Formato validado em `src/lib/engine/config.ts`.
     * Pontuação, critérios de desempate, número de classificados e formato do
     * mata-mata vivem aqui — nunca no código das páginas.
     */
    config: jsonb('config').default(sql`'{}'::jsonb`).notNull(),

    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('competitions_season_type_idx').on(t.seasonId, t.type),
    index('competitions_league_idx').on(t.leagueId),
  ],
);

export const competitionTeams = pgTable(
  'competition_teams',
  {
    id: id(),
    competitionId: text('competition_id')
      .notNull()
      .references(() => competitions.id, { onDelete: 'cascade' }),
    clubId: text('club_id')
      .notNull()
      .references(() => clubs.id, { onDelete: 'cascade' }),
    /** Grupo, quando o formato tiver fase de grupos. */
    groupName: text('group_name'),
    /** Cabeça de chave / posição de entrada no chaveamento. */
    seed: integer('seed'),
    eliminated: boolean('eliminated').default(false).notNull(),
  },
  (t) => [
    uniqueIndex('competition_team_unique').on(t.competitionId, t.clubId),
    index('competition_team_group_idx').on(t.competitionId, t.groupName),
  ],
);

export const competitionRounds = pgTable(
  'competition_rounds',
  {
    id: id(),
    competitionId: text('competition_id')
      .notNull()
      .references(() => competitions.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    type: roundTypeEnum('type').default('KNOCKOUT').notNull(),
    /** Ordem cronológica: fases maiores acontecem depois. */
    order: integer('order').notNull(),
    /** 1 = jogo único, 2 = ida e volta. */
    legs: integer('legs').default(1).notNull(),
    /** Número de confrontos esperados nesta fase. */
    slots: integer('slots').default(0).notNull(),
  },
  (t) => [
    uniqueIndex('round_slug_unique').on(t.competitionId, t.slug),
    index('round_order_idx').on(t.competitionId, t.order),
  ],
);

/* ══════════════════════════════════════════════════════════════
   PARTIDAS
   ══════════════════════════════════════════════════════════════ */

export const matches = pgTable(
  'matches',
  {
    id: id(),
    seasonId: text('season_id')
      .notNull()
      .references(() => seasons.id, { onDelete: 'cascade' }),
    competitionId: text('competition_id')
      .notNull()
      .references(() => competitions.id, { onDelete: 'cascade' }),
    roundId: text('round_id').references(() => competitionRounds.id, { onDelete: 'set null' }),
    homeClubId: text('home_club_id')
      .notNull()
      .references(() => clubs.id, { onDelete: 'cascade' }),
    awayClubId: text('away_club_id')
      .notNull()
      .references(() => clubs.id, { onDelete: 'cascade' }),
    homeScore: integer('home_score'),
    awayScore: integer('away_score'),
    homePenalties: integer('home_penalties'),
    awayPenalties: integer('away_penalties'),
    status: matchStatusEnum('status').default('SCHEDULED').notNull(),
    kickoffAt: timestamp('kickoff_at', { withTimezone: true }).notNull(),
    venue: text('venue'),
    /** Rodada, em competições de pontos corridos. */
    matchday: integer('matchday'),
    /** Posição do confronto dentro da fase de mata-mata. */
    bracketSlot: integer('bracket_slot'),
    /** Jogo de ida (1) ou volta (2). */
    leg: integer('leg').default(1).notNull(),
    notes: text('notes'),
    isDemo: boolean('is_demo').default(false).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('matches_season_status_idx').on(t.seasonId, t.status),
    index('matches_competition_matchday_idx').on(t.competitionId, t.matchday),
    index('matches_kickoff_idx').on(t.kickoffAt),
  ],
);

export const matchAppearances = pgTable(
  'match_appearances',
  {
    id: id(),
    matchId: text('match_id')
      .notNull()
      .references(() => matches.id, { onDelete: 'cascade' }),
    playerId: text('player_id')
      .notNull()
      .references(() => players.id, { onDelete: 'cascade' }),
    clubId: text('club_id')
      .notNull()
      .references(() => clubs.id, { onDelete: 'cascade' }),
    minutes: integer('minutes').default(0).notNull(),
    started: boolean('started').default(true).notNull(),
  },
  (t) => [
    uniqueIndex('appearance_unique').on(t.matchId, t.playerId),
    index('appearance_player_idx').on(t.playerId),
  ],
);

export const matchEvents = pgTable(
  'match_events',
  {
    id: id(),
    matchId: text('match_id')
      .notNull()
      .references(() => matches.id, { onDelete: 'cascade' }),
    clubId: text('club_id')
      .notNull()
      .references(() => clubs.id, { onDelete: 'cascade' }),
    playerId: text('player_id').references(() => players.id, { onDelete: 'set null' }),
    assistPlayerId: text('assist_player_id').references(() => players.id, { onDelete: 'set null' }),
    type: matchEventTypeEnum('type').notNull(),
    minute: integer('minute'),
    detail: text('detail'),
  },
  (t) => [
    index('events_match_idx').on(t.matchId),
    index('events_player_type_idx').on(t.playerId, t.type),
  ],
);

/* ══════════════════════════════════════════════════════════════
   ESTATÍSTICAS MATERIALIZADAS
   Recalculadas por src/lib/engine/recompute.ts. Nunca editadas à mão.
   ══════════════════════════════════════════════════════════════ */

export const clubSeasonStats = pgTable(
  'club_season_stats',
  {
    id: id(),
    clubId: text('club_id')
      .notNull()
      .references(() => clubs.id, { onDelete: 'cascade' }),
    seasonId: text('season_id')
      .notNull()
      .references(() => seasons.id, { onDelete: 'cascade' }),
    competitionId: text('competition_id')
      .notNull()
      .references(() => competitions.id, { onDelete: 'cascade' }),

    played: integer('played').default(0).notNull(),
    won: integer('won').default(0).notNull(),
    drawn: integer('drawn').default(0).notNull(),
    lost: integer('lost').default(0).notNull(),
    goalsFor: integer('goals_for').default(0).notNull(),
    goalsAgainst: integer('goals_against').default(0).notNull(),
    points: integer('points').default(0).notNull(),
    position: integer('position').default(0).notNull(),
    /** Últimos 5 resultados, do mais recente para o mais antigo: "WDLWW". */
    form: text('form').default('').notNull(),

    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('club_stat_unique').on(t.clubId, t.competitionId),
    index('club_stat_position_idx').on(t.competitionId, t.position),
    index('club_stat_season_idx').on(t.seasonId),
  ],
);

export const playerSeasonStats = pgTable(
  'player_season_stats',
  {
    id: id(),
    playerId: text('player_id')
      .notNull()
      .references(() => players.id, { onDelete: 'cascade' }),
    seasonId: text('season_id')
      .notNull()
      .references(() => seasons.id, { onDelete: 'cascade' }),
    competitionId: text('competition_id')
      .notNull()
      .references(() => competitions.id, { onDelete: 'cascade' }),
    /** Clube pelo qual o jogador acumulou estes números nesta competição. */
    clubId: text('club_id').references(() => clubs.id, { onDelete: 'set null' }),

    matches: integer('matches').default(0).notNull(),
    goals: integer('goals').default(0).notNull(),
    assists: integer('assists').default(0).notNull(),
    wins: integer('wins').default(0).notNull(),
    draws: integer('draws').default(0).notNull(),
    losses: integer('losses').default(0).notNull(),
    minutes: integer('minutes').default(0).notNull(),
    yellowCards: integer('yellow_cards').default(0).notNull(),
    redCards: integer('red_cards').default(0).notNull(),

    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('player_stat_unique').on(t.playerId, t.competitionId),
    index('player_stat_goals_idx').on(t.competitionId, t.goals),
    index('player_stat_season_idx').on(t.seasonId),
  ],
);

/* ══════════════════════════════════════════════════════════════
   TRANSFERÊNCIAS E HISTÓRICO
   ══════════════════════════════════════════════════════════════ */

export const transfers = pgTable(
  'transfers',
  {
    id: id(),
    playerId: text('player_id')
      .notNull()
      .references(() => players.id, { onDelete: 'cascade' }),
    fromClubId: text('from_club_id').references(() => clubs.id, { onDelete: 'set null' }),
    toClubId: text('to_club_id').references(() => clubs.id, { onDelete: 'set null' }),
    seasonId: text('season_id')
      .notNull()
      .references(() => seasons.id, { onDelete: 'cascade' }),
    type: transferTypeEnum('type').default('TRANSFER').notNull(),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).defaultNow().notNull(),
    note: text('note'),
    /** Administrador responsável. O registro nunca é apagado. */
    createdById: text('created_by_id').references(() => users.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
  },
  (t) => [
    index('transfers_player_idx').on(t.playerId, t.occurredAt),
    index('transfers_season_idx').on(t.seasonId),
  ],
);

/* ══════════════════════════════════════════════════════════════
   VFA NEWS
   ══════════════════════════════════════════════════════════════ */

export const newsCategories = pgTable('news_categories', {
  id: id(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  color: text('color').default('#e5e7eb').notNull(),
  sortOrder: integer('sort_order').default(0).notNull(),
});

export const news = pgTable(
  'news',
  {
    id: id(),
    slug: text('slug').notNull().unique(),
    title: text('title').notNull(),
    subtitle: text('subtitle'),
    excerpt: text('excerpt'),
    /** HTML sanitizado no servidor antes de gravar. Ver src/lib/sanitize.ts. */
    content: text('content').notNull(),

    /**
     * Versões em inglês e espanhol — opcionais.
     *
     * Colunas ao lado, e não uma tabela `news_translations` separada. Uma
     * tabela por tradução é o desenho certo quando o número de idiomas cresce
     * ou varia por instalação; aqui são três, fixos, decididos no código. Com
     * colunas, ler uma matéria continua sendo uma consulta só — sem join, sem
     * risco de trazer a versão errada — e a escolha do idioma vira uma
     * expressão em memória.
     *
     * Vazio significa "não traduzido", e o site cai no português. É melhor
     * mostrar a matéria em português do que esconder a notícia de quem está
     * lendo em inglês.
     */
    titleEn: text('title_en'),
    subtitleEn: text('subtitle_en'),
    excerptEn: text('excerpt_en'),
    contentEn: text('content_en'),

    titleEs: text('title_es'),
    subtitleEs: text('subtitle_es'),
    excerptEs: text('excerpt_es'),
    contentEs: text('content_es'),

    coverImageUrl: text('cover_image_url'),
    categoryId: text('category_id').references(() => newsCategories.id, { onDelete: 'set null' }),
    authorId: text('author_id').references(() => users.id, { onDelete: 'set null' }),
    status: newsStatusEnum('status').default('DRAFT').notNull(),
    isFeatured: boolean('is_featured').default(false).notNull(),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    scheduledFor: timestamp('scheduled_for', { withTimezone: true }),
    isDemo: boolean('is_demo').default(false).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('news_status_published_idx').on(t.status, t.publishedAt),
    index('news_category_idx').on(t.categoryId),
  ],
);

/* ══════════════════════════════════════════════════════════════
   CONFIGURAÇÃO GLOBAL
   ══════════════════════════════════════════════════════════════ */

/**
 * Chave-valor para regras e identidade editáveis pelo administrador.
 * Chaves conhecidas em `src/lib/settings.ts`.
 */
export const appSettings = pgTable('app_settings', {
  key: text('key').primaryKey(),
  value: jsonb('value').notNull(),
  updatedAt: updatedAt(),
});

/* ══════════════════════════════════════════════════════════════
   RELAÇÕES (para a query API relacional do Drizzle)
   ══════════════════════════════════════════════════════════════ */

export const usersRelations = relations(users, ({ many }) => ({
  accounts: many(accounts),
  sessions: many(sessions),
  news: many(news),
  transfers: many(transfers),
  auditLogs: many(auditLogs),
}));

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, { fields: [accounts.userId], references: [users.id] }),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  user: one(users, { fields: [auditLogs.userId], references: [users.id] }),
}));

export const nationsRelations = relations(nations, ({ many }) => ({
  players: many(players),
  clubs: many(clubs),
  leagues: many(leagues),
}));

export const seasonsRelations = relations(seasons, ({ many }) => ({
  competitions: many(competitions),
  matches: many(matches),
  clubStats: many(clubSeasonStats),
  playerStats: many(playerSeasonStats),
  transfers: many(transfers),
  memberships: many(clubSeasonMemberships),
}));

export const leaguesRelations = relations(leagues, ({ one, many }) => ({
  nation: one(nations, { fields: [leagues.nationId], references: [nations.id] }),
  clubs: many(clubs),
  competitions: many(competitions),
  zones: many(qualificationZones),
}));

export const qualificationZonesRelations = relations(qualificationZones, ({ one }) => ({
  league: one(leagues, { fields: [qualificationZones.leagueId], references: [leagues.id] }),
}));

export const clubsRelations = relations(clubs, ({ one, many }) => ({
  league: one(leagues, { fields: [clubs.leagueId], references: [leagues.id] }),
  nation: one(nations, { fields: [clubs.nationId], references: [nations.id] }),
  captain: one(players, { fields: [clubs.captainId], references: [players.id] }),
  squad: many(players),
  homeMatches: many(matches, { relationName: 'homeClub' }),
  awayMatches: many(matches, { relationName: 'awayClub' }),
  seasonStats: many(clubSeasonStats),
  competitionTeams: many(competitionTeams),
  memberships: many(clubSeasonMemberships),
}));

export const clubSeasonMembershipsRelations = relations(clubSeasonMemberships, ({ one }) => ({
  club: one(clubs, { fields: [clubSeasonMemberships.clubId], references: [clubs.id] }),
  season: one(seasons, { fields: [clubSeasonMemberships.seasonId], references: [seasons.id] }),
  league: one(leagues, { fields: [clubSeasonMemberships.leagueId], references: [leagues.id] }),
}));

export const playersRelations = relations(players, ({ one, many }) => ({
  nation: one(nations, { fields: [players.nationId], references: [nations.id] }),
  currentClub: one(clubs, { fields: [players.currentClubId], references: [clubs.id] }),
  seasonStats: many(playerSeasonStats),
  appearances: many(matchAppearances),
  events: many(matchEvents, { relationName: 'eventPlayer' }),
  assists: many(matchEvents, { relationName: 'eventAssist' }),
  transfers: many(transfers),
}));

export const competitionsRelations = relations(competitions, ({ one, many }) => ({
  season: one(seasons, { fields: [competitions.seasonId], references: [seasons.id] }),
  league: one(leagues, { fields: [competitions.leagueId], references: [leagues.id] }),
  champion: one(clubs, { fields: [competitions.championClubId], references: [clubs.id] }),
  teams: many(competitionTeams),
  rounds: many(competitionRounds),
  matches: many(matches),
  clubStats: many(clubSeasonStats),
  playerStats: many(playerSeasonStats),
}));

export const competitionTeamsRelations = relations(competitionTeams, ({ one }) => ({
  competition: one(competitions, {
    fields: [competitionTeams.competitionId],
    references: [competitions.id],
  }),
  club: one(clubs, { fields: [competitionTeams.clubId], references: [clubs.id] }),
}));

export const competitionRoundsRelations = relations(competitionRounds, ({ one, many }) => ({
  competition: one(competitions, {
    fields: [competitionRounds.competitionId],
    references: [competitions.id],
  }),
  matches: many(matches),
}));

export const matchesRelations = relations(matches, ({ one, many }) => ({
  season: one(seasons, { fields: [matches.seasonId], references: [seasons.id] }),
  competition: one(competitions, {
    fields: [matches.competitionId],
    references: [competitions.id],
  }),
  round: one(competitionRounds, { fields: [matches.roundId], references: [competitionRounds.id] }),
  homeClub: one(clubs, {
    fields: [matches.homeClubId],
    references: [clubs.id],
    relationName: 'homeClub',
  }),
  awayClub: one(clubs, {
    fields: [matches.awayClubId],
    references: [clubs.id],
    relationName: 'awayClub',
  }),
  events: many(matchEvents),
  appearances: many(matchAppearances),
}));

export const matchAppearancesRelations = relations(matchAppearances, ({ one }) => ({
  match: one(matches, { fields: [matchAppearances.matchId], references: [matches.id] }),
  player: one(players, { fields: [matchAppearances.playerId], references: [players.id] }),
  club: one(clubs, { fields: [matchAppearances.clubId], references: [clubs.id] }),
}));

export const matchEventsRelations = relations(matchEvents, ({ one }) => ({
  match: one(matches, { fields: [matchEvents.matchId], references: [matches.id] }),
  club: one(clubs, { fields: [matchEvents.clubId], references: [clubs.id] }),
  player: one(players, {
    fields: [matchEvents.playerId],
    references: [players.id],
    relationName: 'eventPlayer',
  }),
  assistPlayer: one(players, {
    fields: [matchEvents.assistPlayerId],
    references: [players.id],
    relationName: 'eventAssist',
  }),
}));

export const clubSeasonStatsRelations = relations(clubSeasonStats, ({ one }) => ({
  club: one(clubs, { fields: [clubSeasonStats.clubId], references: [clubs.id] }),
  season: one(seasons, { fields: [clubSeasonStats.seasonId], references: [seasons.id] }),
  competition: one(competitions, {
    fields: [clubSeasonStats.competitionId],
    references: [competitions.id],
  }),
}));

export const playerSeasonStatsRelations = relations(playerSeasonStats, ({ one }) => ({
  player: one(players, { fields: [playerSeasonStats.playerId], references: [players.id] }),
  season: one(seasons, { fields: [playerSeasonStats.seasonId], references: [seasons.id] }),
  competition: one(competitions, {
    fields: [playerSeasonStats.competitionId],
    references: [competitions.id],
  }),
  club: one(clubs, { fields: [playerSeasonStats.clubId], references: [clubs.id] }),
}));

export const transfersRelations = relations(transfers, ({ one }) => ({
  player: one(players, { fields: [transfers.playerId], references: [players.id] }),
  fromClub: one(clubs, { fields: [transfers.fromClubId], references: [clubs.id] }),
  toClub: one(clubs, { fields: [transfers.toClubId], references: [clubs.id] }),
  season: one(seasons, { fields: [transfers.seasonId], references: [seasons.id] }),
  createdBy: one(users, { fields: [transfers.createdById], references: [users.id] }),
}));

export const newsRelations = relations(news, ({ one }) => ({
  category: one(newsCategories, { fields: [news.categoryId], references: [newsCategories.id] }),
  author: one(users, { fields: [news.authorId], references: [users.id] }),
}));

export const newsCategoriesRelations = relations(newsCategories, ({ many }) => ({
  news: many(news),
}));

/* ══════════════════════════════════════════════════════════════
   TIPOS INFERIDOS
   ══════════════════════════════════════════════════════════════ */

export type User = typeof users.$inferSelect;
export type Nation = typeof nations.$inferSelect;
export type Season = typeof seasons.$inferSelect;
export type League = typeof leagues.$inferSelect;
export type QualificationZone = typeof qualificationZones.$inferSelect;
export type Club = typeof clubs.$inferSelect;
export type Player = typeof players.$inferSelect;
export type Competition = typeof competitions.$inferSelect;
export type CompetitionTeam = typeof competitionTeams.$inferSelect;
export type CompetitionRound = typeof competitionRounds.$inferSelect;
export type Match = typeof matches.$inferSelect;
export type MatchEvent = typeof matchEvents.$inferSelect;
export type MatchAppearance = typeof matchAppearances.$inferSelect;
export type ClubSeasonStat = typeof clubSeasonStats.$inferSelect;
export type PlayerSeasonStat = typeof playerSeasonStats.$inferSelect;
export type Transfer = typeof transfers.$inferSelect;
export type News = typeof news.$inferSelect;
export type NewsCategory = typeof newsCategories.$inferSelect;
export type AppSetting = typeof appSettings.$inferSelect;

export type Role = (typeof roleEnum.enumValues)[number];
export type PositionValue = (typeof positionEnum.enumValues)[number];
export type MatchStatusValue = (typeof matchStatusEnum.enumValues)[number];
export type MatchEventTypeValue = (typeof matchEventTypeEnum.enumValues)[number];
export type CompetitionTypeValue = (typeof competitionTypeEnum.enumValues)[number];
export type CompetitionStatusValue = (typeof competitionStatusEnum.enumValues)[number];
export type TransferTypeValue = (typeof transferTypeEnum.enumValues)[number];
export type NewsStatusValue = (typeof newsStatusEnum.enumValues)[number];
export type ContinentValue = (typeof continentEnum.enumValues)[number];
export type RoundTypeValue = (typeof roundTypeEnum.enumValues)[number];
