/**
 * Validação de entrada — item 27 do escopo.
 *
 * Todo payload que chega em rota administrativa passa por um destes schemas
 * ANTES de tocar no banco. É isto que garante que o backend não confia em nada
 * que o frontend mandou, inclusive nos campos que a interface nem exibe.
 */

import { z } from 'zod';

import { competitionConfigSchema } from './engine/config';

const hexColor = z
  .string()
  .regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, 'Use uma cor em hexadecimal, ex.: #00e08f');

const optionalUrl = z
  .string()
  .trim()
  .url('Informe uma URL válida.')
  .or(z.literal(''))
  .nullish()
  .transform((value) => (value ? value : null));

const optionalText = z
  .string()
  .trim()
  .or(z.literal(''))
  .nullish()
  .transform((value) => (value ? value : null));

const isoDate = z
  .string()
  .datetime({ offset: true })
  .or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/))
  .nullish()
  .transform((value) => (value ? new Date(value) : null));

/* ── Jogadores ─────────────────────────────────────────────── */

export const POSITIONS = ['GOALKEEPER', 'DEFENDER', 'MIDFIELDER', 'FORWARD'] as const;

export const playerCreateSchema = z.object({
  displayName: z.string().trim().min(2, 'O nome precisa de pelo menos 2 caracteres.').max(60),
  /**
   * Regras de username do Roblox: 3 a 20 caracteres, letras, números e no
   * máximo um underline, que não pode ficar nas pontas.
   */
  robloxUsername: z
    .string()
    .trim()
    .min(3, 'Username do Roblox tem no mínimo 3 caracteres.')
    .max(20, 'Username do Roblox tem no máximo 20 caracteres.')
    .regex(
      /^(?!_)(?!.*__)[A-Za-z0-9_]+(?<!_)$/,
      'Username inválido. Use letras, números e no máximo um underline no meio.',
    ),
  nationId: optionalText,
  currentClubId: optionalText,
  shirtNumber: z.coerce.number().int().min(1).max(99).nullish(),
  position: z.enum(POSITIONS).default('MIDFIELDER'),
  isActive: z.boolean().default(true),
  joinedAt: isoDate,
  /** Busca os dados do Roblox logo após criar. */
  syncRoblox: z.boolean().default(true),
});

export const playerUpdateSchema = playerCreateSchema.partial().extend({
  displayName: z.string().trim().min(2).max(60).optional(),
});

/* ── Clubes ────────────────────────────────────────────────── */

export const clubCreateSchema = z.object({
  name: z.string().trim().min(2, 'O nome do clube precisa de pelo menos 2 caracteres.').max(60),
  shortName: z.string().trim().min(2).max(30),
  abbreviation: z
    .string()
    .trim()
    .min(2, 'A sigla tem 2 ou 3 letras.')
    .max(3)
    .transform((value) => value.toUpperCase()),
  leagueId: z.string().min(1, 'Escolha a liga do clube.'),
  nationId: optionalText,
  logoUrl: optionalUrl,
  primaryColor: hexColor.default('#e5e7eb'),
  secondaryColor: hexColor.default('#0b0f17'),
  ownerName: optionalText,
  captainId: optionalText,
  stadium: optionalText,
  foundedAt: isoDate,
});

export const clubUpdateSchema = clubCreateSchema.partial();

/* ── Ligas e zonas de classificação ────────────────────────── */

export const CONTINENTS = [
  'SOUTH_AMERICA',
  'EUROPE',
  'NORTH_AMERICA',
  'AFRICA',
  'ASIA',
  'OCEANIA',
] as const;

export const leagueSchema = z.object({
  name: z.string().trim().min(2).max(60),
  shortName: z.string().trim().min(2).max(30),
  continent: z.enum(CONTINENTS),
  nationId: optionalText,
  logoUrl: optionalUrl,
  accent: hexColor.nullish(),
  sortOrder: z.coerce.number().int().min(0).max(999).default(0),
});

export const qualificationZoneSchema = z
  .object({
    label: z.string().trim().min(2).max(40),
    color: hexColor,
    fromPosition: z.coerce.number().int().min(1).max(64),
    toPosition: z.coerce.number().int().min(1).max(64),
    targetSlug: optionalText,
    sortOrder: z.coerce.number().int().min(0).max(99).default(0),
  })
  .refine((zone) => zone.fromPosition <= zone.toPosition, {
    message: 'A posição inicial precisa ser menor ou igual à final.',
    path: ['toPosition'],
  });

export const qualificationZonesSchema = z.object({
  leagueId: z.string().min(1),
  zones: z.array(qualificationZoneSchema).max(10),
});

/* ── Temporadas ────────────────────────────────────────────── */

export const seasonSchema = z.object({
  year: z.coerce.number().int().min(2000).max(2200),
  name: z.string().trim().min(2).max(60),
  tagline: optionalText,
  bannerUrl: optionalUrl,
  startDate: isoDate,
  endDate: isoDate,
});

/* ── Competições ───────────────────────────────────────────── */

export const COMPETITION_TYPES = [
  'LEAGUE',
  'LEAGUE_PLAYOFF',
  'CONTINENTAL',
  'INTERCONTINENTAL',
  'CUP',
] as const;

export const COMPETITION_STATUSES = ['DRAFT', 'UPCOMING', 'IN_PROGRESS', 'FINISHED'] as const;

export const competitionSchema = z.object({
  name: z.string().trim().min(2).max(80),
  shortName: optionalText,
  type: z.enum(COMPETITION_TYPES),
  status: z.enum(COMPETITION_STATUSES).default('DRAFT'),
  seasonId: z.string().min(1, 'Escolha a temporada.'),
  leagueId: optionalText,
  parentSlug: optionalText,
  logoUrl: optionalUrl,
  accent: hexColor.nullish(),
  sortOrder: z.coerce.number().int().min(0).max(999).default(0),
  config: competitionConfigSchema,
});

export const competitionTeamsSchema = z.object({
  clubIds: z.array(z.string().min(1)).min(2, 'Uma competição precisa de pelo menos 2 clubes.'),
  /** Grupo de cada clube, quando o formato tiver fase de grupos. */
  groups: z.record(z.string(), z.string()).optional(),
});

export const generateFixturesSchema = z.object({
  /** Data e hora da primeira rodada. */
  startAt: z.string().datetime({ offset: true }),
  /** Dias entre uma rodada e a seguinte. */
  daysBetweenRounds: z.coerce.number().int().min(1).max(30).default(7),
  /** Apaga as partidas existentes antes de gerar. */
  replaceExisting: z.boolean().default(false),
  venue: optionalText,
});

/* ── Partidas ──────────────────────────────────────────────── */

export const MATCH_STATUSES = ['SCHEDULED', 'LIVE', 'FINISHED', 'POSTPONED', 'CANCELLED'] as const;
export const MATCH_EVENT_TYPES = [
  'GOAL',
  'OWN_GOAL',
  'PENALTY_GOAL',
  'PENALTY_MISS',
  'YELLOW_CARD',
  'RED_CARD',
] as const;

export const matchCreateSchema = z
  .object({
    competitionId: z.string().min(1, 'Escolha a competição.'),
    roundId: optionalText,
    homeClubId: z.string().min(1, 'Escolha o clube mandante.'),
    awayClubId: z.string().min(1, 'Escolha o clube visitante.'),
    kickoffAt: z.string().datetime({ offset: true }),
    venue: optionalText,
    matchday: z.coerce.number().int().min(1).max(200).nullish(),
    bracketSlot: z.coerce.number().int().min(0).max(64).nullish(),
    leg: z.coerce.number().int().min(1).max(2).default(1),
    status: z.enum(MATCH_STATUSES).default('SCHEDULED'),
    notes: optionalText,
  })
  .refine((match) => match.homeClubId !== match.awayClubId, {
    message: 'Um clube não pode jogar contra ele mesmo.',
    path: ['awayClubId'],
  });

export const matchUpdateSchema = z.object({
  roundId: optionalText,
  homeClubId: z.string().min(1).optional(),
  awayClubId: z.string().min(1).optional(),
  kickoffAt: z.string().datetime({ offset: true }).optional(),
  venue: optionalText,
  matchday: z.coerce.number().int().min(1).max(200).nullish(),
  leg: z.coerce.number().int().min(1).max(2).optional(),
  status: z.enum(MATCH_STATUSES).optional(),
  notes: optionalText,
});

export const matchEventSchema = z.object({
  clubId: z.string().min(1),
  playerId: optionalText,
  assistPlayerId: optionalText,
  type: z.enum(MATCH_EVENT_TYPES),
  minute: z.coerce.number().int().min(0).max(200).nullish(),
  detail: optionalText,
});

export const matchAppearanceSchema = z.object({
  playerId: z.string().min(1),
  clubId: z.string().min(1),
  minutes: z.coerce.number().int().min(0).max(200).default(0),
  started: z.boolean().default(true),
});

/**
 * Registro de resultado. Recebe placar, escalações e eventos de uma vez, para
 * que a partida inteira seja gravada numa transação só — nada de tabela
 * atualizada pela metade se a conexão cair no meio.
 */
export const matchResultSchema = z
  .object({
    homeScore: z.coerce.number().int().min(0).max(99),
    awayScore: z.coerce.number().int().min(0).max(99),
    homePenalties: z.coerce.number().int().min(0).max(99).nullish(),
    awayPenalties: z.coerce.number().int().min(0).max(99).nullish(),
    status: z.enum(MATCH_STATUSES).default('FINISHED'),
    events: z.array(matchEventSchema).max(100).default([]),
    appearances: z.array(matchAppearanceSchema).max(60).default([]),
  })
  .refine(
    (result) =>
      (result.homePenalties === null || result.homePenalties === undefined) ===
      (result.awayPenalties === null || result.awayPenalties === undefined),
    { message: 'Informe os pênaltis dos dois lados ou de nenhum.', path: ['awayPenalties'] },
  );

/* ── Transferências ────────────────────────────────────────── */

export const TRANSFER_TYPES = ['SIGNING', 'TRANSFER', 'LOAN', 'RELEASE'] as const;

export const transferSchema = z.object({
  playerId: z.string().min(1),
  toClubId: optionalText,
  seasonId: z.string().min(1),
  type: z.enum(TRANSFER_TYPES).default('TRANSFER'),
  occurredAt: z.string().datetime({ offset: true }).optional(),
  note: optionalText,
});

/* ── Notícias ──────────────────────────────────────────────── */

export const NEWS_STATUSES = ['DRAFT', 'SCHEDULED', 'PUBLISHED'] as const;

export const newsSchema = z
  .object({
    title: z.string().trim().min(4, 'O título precisa de pelo menos 4 caracteres.').max(140),
    subtitle: optionalText,
    excerpt: optionalText,
    content: z.string().min(1, 'A notícia não pode ficar vazia.'),
    coverImageUrl: optionalUrl,
    categoryId: optionalText,
    status: z.enum(NEWS_STATUSES).default('DRAFT'),
    isFeatured: z.boolean().default(false),
    scheduledFor: z.string().datetime({ offset: true }).nullish(),
  })
  .refine((news) => news.status !== 'SCHEDULED' || Boolean(news.scheduledFor), {
    message: 'Escolha a data e hora da publicação agendada.',
    path: ['scheduledFor'],
  });

export const newsCategorySchema = z.object({
  name: z.string().trim().min(2).max(40),
  color: hexColor.default('#e5e7eb'),
  sortOrder: z.coerce.number().int().min(0).max(99).default(0),
});

/* ── Usuários ──────────────────────────────────────────────── */

export const userUpdateSchema = z.object({
  role: z.enum(['USER', 'ADMIN']).optional(),
  isBanned: z.boolean().optional(),
});

/* ── Configurações ─────────────────────────────────────────── */

export const settingUpdateSchema = z.object({
  key: z.enum(['brand', 'site', 'roblox']),
  value: z.unknown(),
});

/* ── Tipos exportados ──────────────────────────────────────── */

export type PlayerCreateInput = z.infer<typeof playerCreateSchema>;
export type PlayerUpdateInput = z.infer<typeof playerUpdateSchema>;
export type ClubCreateInput = z.infer<typeof clubCreateSchema>;
export type CompetitionInput = z.infer<typeof competitionSchema>;
export type MatchCreateInput = z.infer<typeof matchCreateSchema>;
export type MatchResultInput = z.infer<typeof matchResultSchema>;
export type NewsInput = z.infer<typeof newsSchema>;
export type TransferInput = z.infer<typeof transferSchema>;
