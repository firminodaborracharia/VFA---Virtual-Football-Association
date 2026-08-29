/**
 * Camada de leitura do site.
 *
 * Todas as páginas públicas consultam o banco por aqui, e não com SQL espalhado
 * pelos componentes. Isso mantém as regras num lugar só (temporada ativa,
 * ordenação, o que é "publicado") e evita consultas divergentes entre páginas
 * que mostram o mesmo dado.
 */

import { and, asc, count, desc, eq, gte, ilike, inArray, isNotNull, lte, or, sql } from 'drizzle-orm';
import { alias, type AnyPgColumn } from 'drizzle-orm/pg-core';
import { cache } from 'react';

import { db } from '@/db';
import type { Locale } from '@/lib/i18n/dictionaries';
import {
  clubSeasonMemberships,
  clubSeasonStats,
  clubs,
  matchAppearances,
  competitionRounds,
  competitionTeams,
  competitions,
  leagues,
  matchEvents,
  matches,
  nations,
  news,
  newsCategories,
  players,
  playerSeasonStats,
  qualificationZones,
  seasons,
  transfers,
  users,
} from '@/db/schema';
import type { PositionValue } from '@/db/schema';

/* ── Aliases ──────────────────────────────────────────────────
   A tabela `clubs` entra duas vezes na mesma consulta de partidas (mandante e
   visitante), e `players` idem em eventos (autor do gol e da assistência).
   Cada join precisa do seu próprio nome.                                  */

const clubsAlias = (name: string) => alias(clubs, name);
const playersAlias = (name: string) => alias(players, name);

/* ── Temporadas ────────────────────────────────────────────── */

/**
 * A temporada ativa é a primeira coisa que quase toda página pergunta, e a
 * resposta não muda no meio de uma requisição. `cache()` do React garante uma
 * ida ao banco por requisição em vez de uma por chamada.
 */
export const getActiveSeason = cache(async () => {
  const [active] = await db.select().from(seasons).where(eq(seasons.isActive, true)).limit(1);

  if (active) return active;

  // Sem temporada marcada como ativa, cai para a mais recente — o site nunca
  // fica vazio só porque alguém esqueceu de ativar.
  const [latest] = await db.select().from(seasons).orderBy(desc(seasons.year)).limit(1);
  return latest ?? null;
});

export async function listSeasons() {
  return db.select().from(seasons).orderBy(desc(seasons.year));
}

export async function getSeasonByYear(year: number) {
  const [season] = await db.select().from(seasons).where(eq(seasons.year, year)).limit(1);
  return season ?? null;
}

/* ── Ligas ─────────────────────────────────────────────────── */

export async function listLeagues() {
  return db
    .select({
      id: leagues.id,
      slug: leagues.slug,
      name: leagues.name,
      shortName: leagues.shortName,
      logoUrl: leagues.logoUrl,
      accent: leagues.accent,
      continent: leagues.continent,
      sortOrder: leagues.sortOrder,
      nationCode: nations.code,
      nationFlag: nations.flagEmoji,
    })
    .from(leagues)
    .leftJoin(nations, eq(leagues.nationId, nations.id))
    .orderBy(asc(leagues.sortOrder), asc(leagues.name));
}

export async function getLeagueBySlug(slug: string) {
  const [league] = await db
    .select({
      id: leagues.id,
      slug: leagues.slug,
      name: leagues.name,
      shortName: leagues.shortName,
      logoUrl: leagues.logoUrl,
      accent: leagues.accent,
      continent: leagues.continent,
      nationCode: nations.code,
      nationFlag: nations.flagEmoji,
      nationName: nations.name,
    })
    .from(leagues)
    .leftJoin(nations, eq(leagues.nationId, nations.id))
    .where(eq(leagues.slug, slug))
    .limit(1);

  return league ?? null;
}

export async function getQualificationZones(leagueId: string) {
  return db
    .select()
    .from(qualificationZones)
    .where(eq(qualificationZones.leagueId, leagueId))
    .orderBy(asc(qualificationZones.sortOrder), asc(qualificationZones.fromPosition));
}

/* ── Competições ───────────────────────────────────────────── */

export type CompetitionSummary = Awaited<ReturnType<typeof listCompetitions>>[number];

export async function listCompetitions(seasonId: string) {
  return db
    .select({
      id: competitions.id,
      slug: competitions.slug,
      name: competitions.name,
      shortName: competitions.shortName,
      type: competitions.type,
      status: competitions.status,
      logoUrl: competitions.logoUrl,
      accent: competitions.accent,
      sortOrder: competitions.sortOrder,
      leagueId: competitions.leagueId,
      leagueSlug: leagues.slug,
      leagueName: leagues.name,
      championId: competitions.championClubId,
      championName: clubs.name,
      championLogo: clubs.logoUrl,
      championSlug: clubs.slug,
    })
    .from(competitions)
    .leftJoin(leagues, eq(competitions.leagueId, leagues.id))
    .leftJoin(clubs, eq(competitions.championClubId, clubs.id))
    .where(eq(competitions.seasonId, seasonId))
    .orderBy(asc(competitions.sortOrder), asc(competitions.name));
}

export async function getCompetitionBySlug(slug: string) {
  const [competition] = await db
    .select()
    .from(competitions)
    .where(eq(competitions.slug, slug))
    .limit(1);
  return competition ?? null;
}

/** Competição de pontos corridos de uma liga numa temporada. */
export async function getLeagueCompetition(leagueId: string, seasonId: string) {
  const [competition] = await db
    .select()
    .from(competitions)
    .where(
      and(
        eq(competitions.leagueId, leagueId),
        eq(competitions.seasonId, seasonId),
        eq(competitions.type, 'LEAGUE'),
      ),
    )
    .limit(1);
  return competition ?? null;
}

/* ── Classificação ─────────────────────────────────────────── */

export type StandingEntry = {
  position: number;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
  form: string;
  club: {
    id: string;
    slug: string;
    name: string;
    shortName: string;
    abbreviation: string;
    logoUrl: string | null;
  };
};

export async function getStandings(competitionId: string): Promise<StandingEntry[]> {
  const rows = await db
    .select({
      position: clubSeasonStats.position,
      played: clubSeasonStats.played,
      won: clubSeasonStats.won,
      drawn: clubSeasonStats.drawn,
      lost: clubSeasonStats.lost,
      goalsFor: clubSeasonStats.goalsFor,
      goalsAgainst: clubSeasonStats.goalsAgainst,
      points: clubSeasonStats.points,
      form: clubSeasonStats.form,
      clubId: clubs.id,
      clubSlug: clubs.slug,
      clubName: clubs.name,
      clubShortName: clubs.shortName,
      clubAbbreviation: clubs.abbreviation,
      clubLogo: clubs.logoUrl,
    })
    .from(clubSeasonStats)
    .innerJoin(clubs, eq(clubSeasonStats.clubId, clubs.id))
    .where(eq(clubSeasonStats.competitionId, competitionId))
    .orderBy(asc(clubSeasonStats.position));

  return rows.map((row) => ({
    position: row.position,
    played: row.played,
    won: row.won,
    drawn: row.drawn,
    lost: row.lost,
    goalsFor: row.goalsFor,
    goalsAgainst: row.goalsAgainst,
    goalDifference: row.goalsFor - row.goalsAgainst,
    points: row.points,
    form: row.form,
    club: {
      id: row.clubId,
      slug: row.clubSlug,
      name: row.clubName,
      shortName: row.clubShortName,
      abbreviation: row.clubAbbreviation,
      logoUrl: row.clubLogo,
    },
  }));
}

/* ── Clubes ────────────────────────────────────────────────── */

export async function listClubs(filters: { leagueId?: string; search?: string } = {}) {
  const conditions = [];
  if (filters.leagueId) conditions.push(eq(clubs.leagueId, filters.leagueId));
  if (filters.search) conditions.push(ilike(clubs.name, `%${filters.search}%`));

  return db
    .select({
      id: clubs.id,
      slug: clubs.slug,
      name: clubs.name,
      shortName: clubs.shortName,
      abbreviation: clubs.abbreviation,
      logoUrl: clubs.logoUrl,
      primaryColor: clubs.primaryColor,
      ownerName: clubs.ownerName,
      isDemo: clubs.isDemo,
      leagueId: clubs.leagueId,
      leagueSlug: leagues.slug,
      leagueName: leagues.name,
      leagueAccent: leagues.accent,
      nationFlag: nations.flagEmoji,
      nationName: nations.name,
    })
    .from(clubs)
    .innerJoin(leagues, eq(clubs.leagueId, leagues.id))
    .leftJoin(nations, eq(clubs.nationId, nations.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(asc(leagues.sortOrder), asc(clubs.name));
}

export async function getClubBySlug(slug: string) {
  const [club] = await db
    .select({
      id: clubs.id,
      slug: clubs.slug,
      name: clubs.name,
      shortName: clubs.shortName,
      abbreviation: clubs.abbreviation,
      logoUrl: clubs.logoUrl,
      primaryColor: clubs.primaryColor,
      secondaryColor: clubs.secondaryColor,
      ownerName: clubs.ownerName,
      captainId: clubs.captainId,
      stadium: clubs.stadium,
      foundedAt: clubs.foundedAt,
      isDemo: clubs.isDemo,
      leagueId: clubs.leagueId,
      leagueSlug: leagues.slug,
      leagueName: leagues.name,
      leagueAccent: leagues.accent,
      nationName: nations.name,
      nationFlag: nations.flagEmoji,
    })
    .from(clubs)
    .innerJoin(leagues, eq(clubs.leagueId, leagues.id))
    .leftJoin(nations, eq(clubs.nationId, nations.id))
    .where(eq(clubs.slug, slug))
    .limit(1);

  return club ?? null;
}

export async function getClubSquad(clubId: string) {
  return db
    .select({
      id: players.id,
      slug: players.slug,
      displayName: players.displayName,
      shirtNumber: players.shirtNumber,
      position: players.position,
      robloxUsername: players.robloxUsername,
      robloxHeadshotUrl: players.robloxHeadshotUrl,
      robloxAvatarUrl: players.robloxAvatarUrl,
      isActive: players.isActive,
      nationFlag: nations.flagEmoji,
      nationName: nations.name,
    })
    .from(players)
    .leftJoin(nations, eq(players.nationId, nations.id))
    .where(eq(players.currentClubId, clubId))
    .orderBy(asc(players.shirtNumber), asc(players.displayName));
}

/** Números do clube na temporada, somando todas as competições. */
export async function getClubSeasonTotals(clubId: string, seasonId: string) {
  const [row] = await db
    .select({
      played: sql<number>`coalesce(sum(${clubSeasonStats.played}), 0)::int`,
      won: sql<number>`coalesce(sum(${clubSeasonStats.won}), 0)::int`,
      drawn: sql<number>`coalesce(sum(${clubSeasonStats.drawn}), 0)::int`,
      lost: sql<number>`coalesce(sum(${clubSeasonStats.lost}), 0)::int`,
      goalsFor: sql<number>`coalesce(sum(${clubSeasonStats.goalsFor}), 0)::int`,
      goalsAgainst: sql<number>`coalesce(sum(${clubSeasonStats.goalsAgainst}), 0)::int`,
      points: sql<number>`coalesce(sum(${clubSeasonStats.points}), 0)::int`,
    })
    .from(clubSeasonStats)
    .where(and(eq(clubSeasonStats.clubId, clubId), eq(clubSeasonStats.seasonId, seasonId)));

  return (
    row ?? { played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, points: 0 }
  );
}

/* ── Jogadores ─────────────────────────────────────────────── */

export type PlayerFilters = {
  leagueId?: string;
  clubId?: string;
  nationId?: string;
  /** Deriva do enum do schema: acrescentar uma posição não exige tocar aqui. */
  position?: PositionValue;
  search?: string;
  limit?: number;
  offset?: number;
};

export async function listPlayers(filters: PlayerFilters = {}) {
  const conditions = [];
  if (filters.clubId) conditions.push(eq(players.currentClubId, filters.clubId));
  if (filters.nationId) conditions.push(eq(players.nationId, filters.nationId));
  if (filters.position) conditions.push(eq(players.position, filters.position));
  if (filters.leagueId) conditions.push(eq(clubs.leagueId, filters.leagueId));
  if (filters.search) {
    const term = `%${filters.search}%`;
    conditions.push(
      or(
        ilike(players.displayName, term),
        ilike(players.robloxUsername, term),
        ilike(players.robloxDisplayName, term),
        ilike(clubs.name, term),
      ),
    );
  }

  const where = conditions.length ? and(...conditions) : undefined;

  const rows = await db
    .select({
      id: players.id,
      slug: players.slug,
      displayName: players.displayName,
      shirtNumber: players.shirtNumber,
      position: players.position,
      robloxUsername: players.robloxUsername,
      robloxUserId: players.robloxUserId,
      robloxHeadshotUrl: players.robloxHeadshotUrl,
      robloxAvatarUrl: players.robloxAvatarUrl,
      isActive: players.isActive,
      isDemo: players.isDemo,
      clubId: clubs.id,
      clubSlug: clubs.slug,
      clubName: clubs.name,
      clubAbbreviation: clubs.abbreviation,
      clubLogo: clubs.logoUrl,
      leagueId: leagues.id,
      leagueName: leagues.name,
      nationFlag: nations.flagEmoji,
      nationName: nations.name,
      nationId: nations.id,
    })
    .from(players)
    .leftJoin(clubs, eq(players.currentClubId, clubs.id))
    .leftJoin(leagues, eq(clubs.leagueId, leagues.id))
    .leftJoin(nations, eq(players.nationId, nations.id))
    .where(where)
    .orderBy(asc(players.displayName))
    .limit(filters.limit ?? 60)
    .offset(filters.offset ?? 0);

  const [total] = await db
    .select({ value: count() })
    .from(players)
    .leftJoin(clubs, eq(players.currentClubId, clubs.id))
    .where(where);

  return { rows, total: total?.value ?? 0 };
}

export async function getPlayerBySlug(slug: string) {
  const [player] = await db
    .select({
      id: players.id,
      slug: players.slug,
      displayName: players.displayName,
      shirtNumber: players.shirtNumber,
      position: players.position,
      isActive: players.isActive,
      isDemo: players.isDemo,
      joinedAt: players.joinedAt,
      robloxUsername: players.robloxUsername,
      robloxUserId: players.robloxUserId,
      robloxDisplayName: players.robloxDisplayName,
      robloxAvatarUrl: players.robloxAvatarUrl,
      robloxHeadshotUrl: players.robloxHeadshotUrl,
      robloxCreatedAt: players.robloxCreatedAt,
      robloxDescription: players.robloxDescription,
      robloxIsVerified: players.robloxIsVerified,
      robloxSyncedAt: players.robloxSyncedAt,
      clubId: clubs.id,
      clubSlug: clubs.slug,
      clubName: clubs.name,
      clubAbbreviation: clubs.abbreviation,
      clubLogo: clubs.logoUrl,
      clubPrimary: clubs.primaryColor,
      leagueSlug: leagues.slug,
      leagueName: leagues.name,
      nationName: nations.name,
      nationFlag: nations.flagEmoji,
    })
    .from(players)
    .leftJoin(clubs, eq(players.currentClubId, clubs.id))
    .leftJoin(leagues, eq(clubs.leagueId, leagues.id))
    .leftJoin(nations, eq(players.nationId, nations.id))
    .where(eq(players.slug, slug))
    .limit(1);

  return player ?? null;
}

/** Estatísticas do jogador competição a competição, dentro de uma temporada. */
export async function getPlayerStats(playerId: string, seasonId?: string) {
  const conditions = [eq(playerSeasonStats.playerId, playerId)];
  if (seasonId) conditions.push(eq(playerSeasonStats.seasonId, seasonId));

  return db
    .select({
      matches: playerSeasonStats.matches,
      goals: playerSeasonStats.goals,
      assists: playerSeasonStats.assists,
      wins: playerSeasonStats.wins,
      draws: playerSeasonStats.draws,
      losses: playerSeasonStats.losses,
      minutes: playerSeasonStats.minutes,
      yellowCards: playerSeasonStats.yellowCards,
      redCards: playerSeasonStats.redCards,
      competitionId: competitions.id,
      competitionName: competitions.name,
      competitionSlug: competitions.slug,
      competitionType: competitions.type,
      seasonYear: seasons.year,
      seasonId: seasons.id,
    })
    .from(playerSeasonStats)
    .innerJoin(competitions, eq(playerSeasonStats.competitionId, competitions.id))
    .innerJoin(seasons, eq(playerSeasonStats.seasonId, seasons.id))
    .where(and(...conditions))
    .orderBy(desc(seasons.year), asc(competitions.sortOrder));
}

/** Histórico de clubes do jogador — item 21 do escopo. */
export async function getPlayerHistory(playerId: string) {
  const toClub = clubsAlias('to_club');
  const fromClub = clubsAlias('from_club');

  return db
    .select({
      id: transfers.id,
      type: transfers.type,
      occurredAt: transfers.occurredAt,
      note: transfers.note,
      seasonYear: seasons.year,
      seasonId: seasons.id,
      toClubSlug: toClub.slug,
      toClubName: toClub.name,
      toClubLogo: toClub.logoUrl,
      toClubAbbr: toClub.abbreviation,
      fromClubSlug: fromClub.slug,
      fromClubName: fromClub.name,
      fromClubLogo: fromClub.logoUrl,
    })
    .from(transfers)
    .innerJoin(seasons, eq(transfers.seasonId, seasons.id))
    .leftJoin(toClub, eq(transfers.toClubId, toClub.id))
    .leftJoin(fromClub, eq(transfers.fromClubId, fromClub.id))
    .where(eq(transfers.playerId, playerId))
    .orderBy(desc(transfers.occurredAt));
}

/* ── Partidas ──────────────────────────────────────────────── */

export type MatchFilters = {
  seasonId?: string;
  competitionId?: string;
  leagueId?: string;
  clubId?: string;
  status?: 'SCHEDULED' | 'LIVE' | 'FINISHED' | 'POSTPONED' | 'CANCELLED';
  from?: Date;
  to?: Date;
  limit?: number;
  offset?: number;
  order?: 'asc' | 'desc';
};

export async function listMatches(filters: MatchFilters = {}) {
  const homeAlias = clubsAlias('home_club');
  const awayAlias = clubsAlias('away_club');

  const conditions = [];
  if (filters.seasonId) conditions.push(eq(matches.seasonId, filters.seasonId));
  if (filters.competitionId) conditions.push(eq(matches.competitionId, filters.competitionId));
  if (filters.status) conditions.push(eq(matches.status, filters.status));
  if (filters.from) conditions.push(gte(matches.kickoffAt, filters.from));
  if (filters.to) conditions.push(lte(matches.kickoffAt, filters.to));
  if (filters.leagueId) conditions.push(eq(competitions.leagueId, filters.leagueId));
  if (filters.clubId) {
    conditions.push(
      or(eq(matches.homeClubId, filters.clubId), eq(matches.awayClubId, filters.clubId)),
    );
  }

  const where = conditions.length ? and(...conditions) : undefined;
  const ordering = filters.order === 'desc' ? desc(matches.kickoffAt) : asc(matches.kickoffAt);

  const rows = await db
    .select({
      id: matches.id,
      kickoffAt: matches.kickoffAt,
      status: matches.status,
      homeScore: matches.homeScore,
      awayScore: matches.awayScore,
      homePenalties: matches.homePenalties,
      awayPenalties: matches.awayPenalties,
      matchday: matches.matchday,
      venue: matches.venue,
      leg: matches.leg,
      competitionId: competitions.id,
      competitionName: competitions.name,
      competitionSlug: competitions.slug,
      competitionType: competitions.type,
      competitionAccent: competitions.accent,
      roundName: competitionRounds.name,
      homeId: homeAlias.id,
      homeSlug: homeAlias.slug,
      homeName: homeAlias.name,
      homeShort: homeAlias.shortName,
      homeAbbr: homeAlias.abbreviation,
      homeLogo: homeAlias.logoUrl,
      awayId: awayAlias.id,
      awaySlug: awayAlias.slug,
      awayName: awayAlias.name,
      awayShort: awayAlias.shortName,
      awayAbbr: awayAlias.abbreviation,
      awayLogo: awayAlias.logoUrl,
    })
    .from(matches)
    .innerJoin(competitions, eq(matches.competitionId, competitions.id))
    .innerJoin(homeAlias, eq(matches.homeClubId, homeAlias.id))
    .innerJoin(awayAlias, eq(matches.awayClubId, awayAlias.id))
    .leftJoin(competitionRounds, eq(matches.roundId, competitionRounds.id))
    .where(where)
    .orderBy(ordering)
    .limit(filters.limit ?? 30)
    .offset(filters.offset ?? 0);

  const [total] = await db
    .select({ value: count() })
    .from(matches)
    .innerJoin(competitions, eq(matches.competitionId, competitions.id))
    .where(where);

  return { rows, total: total?.value ?? 0 };
}

export type MatchRow = Awaited<ReturnType<typeof listMatches>>['rows'][number];

export async function getMatchById(id: string) {
  const homeAlias = clubsAlias('home_club');
  const awayAlias = clubsAlias('away_club');

  const [match] = await db
    .select({
      id: matches.id,
      kickoffAt: matches.kickoffAt,
      status: matches.status,
      homeScore: matches.homeScore,
      awayScore: matches.awayScore,
      homePenalties: matches.homePenalties,
      awayPenalties: matches.awayPenalties,
      matchday: matches.matchday,
      venue: matches.venue,
      notes: matches.notes,
      leg: matches.leg,
      seasonId: matches.seasonId,
      competitionId: competitions.id,
      competitionName: competitions.name,
      competitionSlug: competitions.slug,
      competitionType: competitions.type,
      competitionAccent: competitions.accent,
      roundName: competitionRounds.name,
      homeId: homeAlias.id,
      homeSlug: homeAlias.slug,
      homeName: homeAlias.name,
      homeShort: homeAlias.shortName,
      homeAbbr: homeAlias.abbreviation,
      homeLogo: homeAlias.logoUrl,
      homeColor: homeAlias.primaryColor,
      awayId: awayAlias.id,
      awaySlug: awayAlias.slug,
      awayName: awayAlias.name,
      awayShort: awayAlias.shortName,
      awayAbbr: awayAlias.abbreviation,
      awayLogo: awayAlias.logoUrl,
      awayColor: awayAlias.primaryColor,
    })
    .from(matches)
    .innerJoin(competitions, eq(matches.competitionId, competitions.id))
    .innerJoin(homeAlias, eq(matches.homeClubId, homeAlias.id))
    .innerJoin(awayAlias, eq(matches.awayClubId, awayAlias.id))
    .leftJoin(competitionRounds, eq(matches.roundId, competitionRounds.id))
    .where(eq(matches.id, id))
    .limit(1);

  return match ?? null;
}

export async function getMatchEvents(matchId: string) {
  const scorer = playersAlias('scorer');
  const assistant = playersAlias('assistant');

  return db
    .select({
      id: matchEvents.id,
      type: matchEvents.type,
      minute: matchEvents.minute,
      detail: matchEvents.detail,
      clubId: matchEvents.clubId,
      playerId: scorer.id,
      playerName: scorer.displayName,
      playerSlug: scorer.slug,
      assistId: assistant.id,
      assistName: assistant.displayName,
      assistSlug: assistant.slug,
    })
    .from(matchEvents)
    .leftJoin(scorer, eq(matchEvents.playerId, scorer.id))
    .leftJoin(assistant, eq(matchEvents.assistPlayerId, assistant.id))
    .where(eq(matchEvents.matchId, matchId))
    .orderBy(asc(matchEvents.minute));
}

/* ── Rankings e destaques ──────────────────────────────────── */

export type RankingMetric =
  | 'goals'
  | 'assists'
  | 'matches'
  | 'wins'
  | 'minutes'
  | 'cards'
  | 'goalsPerMatch';

export async function getPlayerRanking(
  metric: RankingMetric,
  options: { seasonId: string; competitionId?: string; leagueId?: string; clubId?: string; limit?: number } ,
) {
  const conditions = [eq(playerSeasonStats.seasonId, options.seasonId)];
  if (options.competitionId) {
    conditions.push(eq(playerSeasonStats.competitionId, options.competitionId));
  }
  if (options.clubId) conditions.push(eq(playerSeasonStats.clubId, options.clubId));
  if (options.leagueId) conditions.push(eq(clubs.leagueId, options.leagueId));

  const totals = {
    matches: sql<number>`sum(${playerSeasonStats.matches})::int`,
    goals: sql<number>`sum(${playerSeasonStats.goals})::int`,
    assists: sql<number>`sum(${playerSeasonStats.assists})::int`,
    wins: sql<number>`sum(${playerSeasonStats.wins})::int`,
    minutes: sql<number>`sum(${playerSeasonStats.minutes})::int`,
    yellowCards: sql<number>`sum(${playerSeasonStats.yellowCards})::int`,
    redCards: sql<number>`sum(${playerSeasonStats.redCards})::int`,
  };

  const orderExpression = {
    goals: sql`sum(${playerSeasonStats.goals}) desc, sum(${playerSeasonStats.matches}) asc`,
    assists: sql`sum(${playerSeasonStats.assists}) desc, sum(${playerSeasonStats.matches}) asc`,
    matches: sql`sum(${playerSeasonStats.matches}) desc`,
    wins: sql`sum(${playerSeasonStats.wins}) desc`,
    minutes: sql`sum(${playerSeasonStats.minutes}) desc`,
    cards: sql`(sum(${playerSeasonStats.yellowCards}) + sum(${playerSeasonStats.redCards}) * 2) desc`,
    goalsPerMatch: sql`case when sum(${playerSeasonStats.matches}) >= 3 then sum(${playerSeasonStats.goals})::numeric / sum(${playerSeasonStats.matches}) else 0 end desc`,
  }[metric];

  return db
    .select({
      playerId: players.id,
      playerSlug: players.slug,
      playerName: players.displayName,
      robloxHeadshotUrl: players.robloxHeadshotUrl,
      robloxAvatarUrl: players.robloxAvatarUrl,
      position: players.position,
      nationFlag: nations.flagEmoji,
      clubSlug: clubs.slug,
      clubName: clubs.name,
      clubAbbr: clubs.abbreviation,
      clubLogo: clubs.logoUrl,
      ...totals,
    })
    .from(playerSeasonStats)
    .innerJoin(players, eq(playerSeasonStats.playerId, players.id))
    .leftJoin(clubs, eq(playerSeasonStats.clubId, clubs.id))
    .leftJoin(nations, eq(players.nationId, nations.id))
    .where(and(...conditions))
    .groupBy(
      players.id,
      players.slug,
      players.displayName,
      players.robloxHeadshotUrl,
      players.robloxAvatarUrl,
      players.position,
      nations.flagEmoji,
      clubs.slug,
      clubs.name,
      clubs.abbreviation,
      clubs.logoUrl,
    )
    .orderBy(orderExpression)
    .limit(options.limit ?? 10);
}

/* ── Notícias ──────────────────────────────────────────────── */


/* ── Notícias em três idiomas ──────────────────────────────────
   O idioma é escolhido no BANCO, com `coalesce`, e não em JavaScript depois
   de trazer tudo. Duas razões: a consulta devolve as mesmas colunas em
   qualquer idioma — nenhuma página precisa saber que tradução existe — e o
   `coalesce` já implementa a regra de queda para o português sem um `if`
   espalhado por cada componente.

   `nullif(campo, '')` antes do coalesce é necessário: um campo salvo vazio
   pelo formulário chega como string vazia, não NULL, e sem isso a matéria
   apareceria com o título em branco em vez de cair no português.          */

function localized(
  base: AnyPgColumn,
  english: AnyPgColumn,
  spanish: AnyPgColumn,
  locale: Locale,
) {
  if (locale === 'en') return sql<string>`coalesce(nullif(${english}, ''), ${base})`;
  if (locale === 'es') return sql<string>`coalesce(nullif(${spanish}, ''), ${base})`;
  return sql<string>`${base}`;
}

export async function listNews(options: {
  limit?: number;
  offset?: number;
  categorySlug?: string;
  includeUnpublished?: boolean;
  /** Idioma da leitura. Sem tradução preenchida, cai no português. */
  locale?: Locale;
} = {}) {
  const locale = options.locale ?? 'pt';
  const conditions = [];

  if (!options.includeUnpublished) {
    // "Publicada" significa status PUBLISHED e data de publicação no passado.
    // Notícias agendadas simplesmente não aparecem até a hora chegar.
    conditions.push(eq(news.status, 'PUBLISHED'));
    conditions.push(isNotNull(news.publishedAt));
    conditions.push(lte(news.publishedAt, new Date()));
  }
  if (options.categorySlug) conditions.push(eq(newsCategories.slug, options.categorySlug));

  const where = conditions.length ? and(...conditions) : undefined;

  const rows = await db
    .select({
      id: news.id,
      slug: news.slug,
      title: localized(news.title, news.titleEn, news.titleEs, locale),
      subtitle: localized(news.subtitle, news.subtitleEn, news.subtitleEs, locale),
      excerpt: localized(news.excerpt, news.excerptEn, news.excerptEs, locale),
      coverImageUrl: news.coverImageUrl,
      publishedAt: news.publishedAt,
      isFeatured: news.isFeatured,
      isDemo: news.isDemo,
      status: news.status,
      categoryName: newsCategories.name,
      categorySlug: newsCategories.slug,
      categoryColor: newsCategories.color,
    })
    .from(news)
    .leftJoin(newsCategories, eq(news.categoryId, newsCategories.id))
    .where(where)
    .orderBy(desc(news.publishedAt), desc(news.createdAt))
    .limit(options.limit ?? 12)
    .offset(options.offset ?? 0);

  const [total] = await db
    .select({ value: count() })
    .from(news)
    .leftJoin(newsCategories, eq(news.categoryId, newsCategories.id))
    .where(where);

  return { rows, total: total?.value ?? 0 };
}

export async function getNewsBySlug(slug: string, locale: Locale = 'pt') {
  const [article] = await db
    .select({
      id: news.id,
      slug: news.slug,
      title: localized(news.title, news.titleEn, news.titleEs, locale),
      subtitle: localized(news.subtitle, news.subtitleEn, news.subtitleEs, locale),
      excerpt: localized(news.excerpt, news.excerptEn, news.excerptEs, locale),
      content: localized(news.content, news.contentEn, news.contentEs, locale),
      coverImageUrl: news.coverImageUrl,
      publishedAt: news.publishedAt,
      status: news.status,
      isDemo: news.isDemo,
      categoryName: newsCategories.name,
      categorySlug: newsCategories.slug,
      categoryColor: newsCategories.color,
    })
    .from(news)
    .leftJoin(newsCategories, eq(news.categoryId, newsCategories.id))
    .where(eq(news.slug, slug))
    .limit(1);

  return article ?? null;
}

export async function listNewsCategories() {
  return db
    .select()
    .from(newsCategories)
    .orderBy(asc(newsCategories.sortOrder), asc(newsCategories.name));
}

/* ── Nações ────────────────────────────────────────────────── */

export async function listNations() {
  return db.select().from(nations).orderBy(asc(nations.name));
}

/* ── Participantes de competição ───────────────────────────── */

export async function getCompetitionTeams(competitionId: string) {
  return db
    .select({
      id: competitionTeams.id,
      groupName: competitionTeams.groupName,
      seed: competitionTeams.seed,
      eliminated: competitionTeams.eliminated,
      clubId: clubs.id,
      clubSlug: clubs.slug,
      clubName: clubs.name,
      clubShort: clubs.shortName,
      clubAbbr: clubs.abbreviation,
      clubLogo: clubs.logoUrl,
      leagueName: leagues.name,
      nationFlag: nations.flagEmoji,
    })
    .from(competitionTeams)
    .innerJoin(clubs, eq(competitionTeams.clubId, clubs.id))
    .innerJoin(leagues, eq(clubs.leagueId, leagues.id))
    .leftJoin(nations, eq(clubs.nationId, nations.id))
    .where(eq(competitionTeams.competitionId, competitionId))
    .orderBy(asc(competitionTeams.seed), asc(clubs.name));
}

export async function getCompetitionRounds(competitionId: string) {
  return db
    .select()
    .from(competitionRounds)
    .where(eq(competitionRounds.competitionId, competitionId))
    .orderBy(asc(competitionRounds.order));
}

/** Todas as competições em que um conjunto de clubes participa. */
export async function getClubCompetitions(clubId: string, seasonId: string) {
  return db
    .select({
      id: competitions.id,
      slug: competitions.slug,
      name: competitions.name,
      type: competitions.type,
      status: competitions.status,
      accent: competitions.accent,
      logoUrl: competitions.logoUrl,
    })
    .from(competitionTeams)
    .innerJoin(competitions, eq(competitionTeams.competitionId, competitions.id))
    .where(and(eq(competitionTeams.clubId, clubId), eq(competitions.seasonId, seasonId)))
    .orderBy(asc(competitions.sortOrder));
}

/* ── Contagens do painel ───────────────────────────────────── */

export async function getCounts() {
  const [playerCount] = await db.select({ value: count() }).from(players);
  const [clubCount] = await db.select({ value: count() }).from(clubs);
  const [matchCount] = await db.select({ value: count() }).from(matches);
  const [newsCount] = await db.select({ value: count() }).from(news);
  const [competitionCount] = await db.select({ value: count() }).from(competitions);

  return {
    players: playerCount?.value ?? 0,
    clubs: clubCount?.value ?? 0,
    matches: matchCount?.value ?? 0,
    news: newsCount?.value ?? 0,
    competitions: competitionCount?.value ?? 0,
  };
}

/* ── Linha do tempo do jogador ─────────────────────────────── */

export type PlayerTimelineEntry = {
  matchId: string;
  kickoffAt: Date;
  matchday: number | null;
  competitionName: string;
  opponentName: string;
  opponentAbbr: string;
  opponentLogo: string | null;
  isHome: boolean;
  homeScore: number | null;
  awayScore: number | null;
  result: 'W' | 'D' | 'L';
  goals: number;
  assists: number;
  minutes: number;
  yellowCards: number;
  redCards: number;
};

/**
 * Partida a partida do jogador numa temporada — alimenta o gráfico de evolução
 * da página de perfil (item 5 do escopo).
 */
export async function getPlayerTimeline(
  playerId: string,
  seasonId: string,
): Promise<PlayerTimelineEntry[]> {
  const homeAlias = clubsAlias('tl_home');
  const awayAlias = clubsAlias('tl_away');

  const appearances = await db
    .select({
      matchId: matches.id,
      kickoffAt: matches.kickoffAt,
      matchday: matches.matchday,
      minutes: matchAppearances.minutes,
      playerClubId: matchAppearances.clubId,
      homeScore: matches.homeScore,
      awayScore: matches.awayScore,
      homeId: homeAlias.id,
      homeName: homeAlias.shortName,
      homeAbbr: homeAlias.abbreviation,
      homeLogo: homeAlias.logoUrl,
      awayId: awayAlias.id,
      awayName: awayAlias.shortName,
      awayAbbr: awayAlias.abbreviation,
      awayLogo: awayAlias.logoUrl,
      competitionName: competitions.name,
    })
    .from(matchAppearances)
    .innerJoin(matches, eq(matchAppearances.matchId, matches.id))
    .innerJoin(competitions, eq(matches.competitionId, competitions.id))
    .innerJoin(homeAlias, eq(matches.homeClubId, homeAlias.id))
    .innerJoin(awayAlias, eq(matches.awayClubId, awayAlias.id))
    .where(
      and(
        eq(matchAppearances.playerId, playerId),
        eq(matches.seasonId, seasonId),
        eq(matches.status, 'FINISHED'),
      ),
    )
    .orderBy(asc(matches.kickoffAt));

  if (appearances.length === 0) return [];

  const matchIds = appearances.map((row) => row.matchId);

  const events = await db
    .select({
      matchId: matchEvents.matchId,
      type: matchEvents.type,
      playerId: matchEvents.playerId,
      assistPlayerId: matchEvents.assistPlayerId,
    })
    .from(matchEvents)
    .where(inArray(matchEvents.matchId, matchIds));

  const perMatch = new Map<
    string,
    { goals: number; assists: number; yellowCards: number; redCards: number }
  >();

  for (const event of events) {
    const bucket = perMatch.get(event.matchId) ?? {
      goals: 0,
      assists: 0,
      yellowCards: 0,
      redCards: 0,
    };

    if (event.playerId === playerId) {
      if (event.type === 'GOAL' || event.type === 'PENALTY_GOAL') bucket.goals += 1;
      if (event.type === 'YELLOW_CARD') bucket.yellowCards += 1;
      if (event.type === 'RED_CARD') bucket.redCards += 1;
    }
    if (
      event.assistPlayerId === playerId &&
      (event.type === 'GOAL' || event.type === 'PENALTY_GOAL')
    ) {
      bucket.assists += 1;
    }

    perMatch.set(event.matchId, bucket);
  }

  return appearances.map((row) => {
    const isHome = row.playerClubId === row.homeId;
    const own = isHome ? row.homeScore : row.awayScore;
    const against = isHome ? row.awayScore : row.homeScore;

    const result: 'W' | 'D' | 'L' =
      own === null || against === null ? 'D' : own > against ? 'W' : own < against ? 'L' : 'D';

    const stats = perMatch.get(row.matchId) ?? {
      goals: 0,
      assists: 0,
      yellowCards: 0,
      redCards: 0,
    };

    return {
      matchId: row.matchId,
      kickoffAt: row.kickoffAt,
      matchday: row.matchday,
      competitionName: row.competitionName,
      opponentName: isHome ? row.awayName : row.homeName,
      opponentAbbr: isHome ? row.awayAbbr : row.homeAbbr,
      opponentLogo: isHome ? row.awayLogo : row.homeLogo,
      isHome,
      homeScore: row.homeScore,
      awayScore: row.awayScore,
      result,
      minutes: row.minutes,
      ...stats,
    };
  });
}

/** Escalações de uma partida, agrupadas por clube. */
export async function getMatchAppearances(matchId: string) {
  return db
    .select({
      id: matchAppearances.id,
      clubId: matchAppearances.clubId,
      minutes: matchAppearances.minutes,
      started: matchAppearances.started,
      playerId: players.id,
      playerSlug: players.slug,
      playerName: players.displayName,
      shirtNumber: players.shirtNumber,
      position: players.position,
      robloxHeadshotUrl: players.robloxHeadshotUrl,
      robloxAvatarUrl: players.robloxAvatarUrl,
    })
    .from(matchAppearances)
    .innerJoin(players, eq(matchAppearances.playerId, players.id))
    .where(eq(matchAppearances.matchId, matchId))
    .orderBy(desc(matchAppearances.started), asc(players.shirtNumber), asc(players.displayName));
}

/** Partidas de uma competição, no formato usado pelo chaveamento. */
export async function getCompetitionMatches(competitionId: string) {
  const homeAlias = clubsAlias('bracket_home');
  const awayAlias = clubsAlias('bracket_away');

  return db
    .select({
      id: matches.id,
      roundId: matches.roundId,
      bracketSlot: matches.bracketSlot,
      status: matches.status,
      kickoffAt: matches.kickoffAt,
      matchday: matches.matchday,
      homeScore: matches.homeScore,
      awayScore: matches.awayScore,
      homePenalties: matches.homePenalties,
      awayPenalties: matches.awayPenalties,
      homeId: homeAlias.id,
      homeSlug: homeAlias.slug,
      homeName: homeAlias.name,
      homeShort: homeAlias.shortName,
      homeAbbr: homeAlias.abbreviation,
      homeLogo: homeAlias.logoUrl,
      awayId: awayAlias.id,
      awaySlug: awayAlias.slug,
      awayName: awayAlias.name,
      awayShort: awayAlias.shortName,
      awayAbbr: awayAlias.abbreviation,
      awayLogo: awayAlias.logoUrl,
    })
    .from(matches)
    .innerJoin(homeAlias, eq(matches.homeClubId, homeAlias.id))
    .innerJoin(awayAlias, eq(matches.awayClubId, awayAlias.id))
    .where(eq(matches.competitionId, competitionId))
    .orderBy(asc(matches.bracketSlot), asc(matches.kickoffAt));
}

/** Lista completa de clubes para o painel (todos os campos editáveis). */
export async function listClubsAdmin() {
  return db
    .select({
      id: clubs.id,
      slug: clubs.slug,
      name: clubs.name,
      shortName: clubs.shortName,
      abbreviation: clubs.abbreviation,
      logoUrl: clubs.logoUrl,
      primaryColor: clubs.primaryColor,
      secondaryColor: clubs.secondaryColor,
      ownerName: clubs.ownerName,
      captainId: clubs.captainId,
      stadium: clubs.stadium,
      foundedAt: clubs.foundedAt,
      leagueId: clubs.leagueId,
      leagueName: leagues.name,
      nationId: clubs.nationId,
    })
    .from(clubs)
    .innerJoin(leagues, eq(clubs.leagueId, leagues.id))
    .orderBy(asc(leagues.sortOrder), asc(clubs.name));
}

/** Usuários cadastrados, para a tela de permissões. */
export async function listUsers() {
  return db
    .select({
      id: users.id,
      name: users.name,
      image: users.image,
      discordId: users.discordId,
      discordUsername: users.discordUsername,
      discordGlobalName: users.discordGlobalName,
      role: users.role,
      isBanned: users.isBanned,
      createdAt: users.createdAt,
    })
    .from(users)
    .orderBy(desc(users.role), asc(users.createdAt));
}

/** Notícias para o painel, incluindo rascunhos e agendadas. */
export async function listNewsAdmin() {
  return db
    .select({
      id: news.id,
      slug: news.slug,
      title: news.title,
      subtitle: news.subtitle,
      excerpt: news.excerpt,
      content: news.content,
      // O painel recebe TODAS as versões, sem `coalesce`: quem edita precisa
      // ver o que está de fato gravado em cada idioma, inclusive o que está
      // vazio. A queda para o português é regra de leitura do site, não do
      // formulário — ali ela esconderia o campo por preencher.
      titleEn: news.titleEn,
      subtitleEn: news.subtitleEn,
      excerptEn: news.excerptEn,
      contentEn: news.contentEn,
      titleEs: news.titleEs,
      subtitleEs: news.subtitleEs,
      excerptEs: news.excerptEs,
      contentEs: news.contentEs,
      coverImageUrl: news.coverImageUrl,
      status: news.status,
      isFeatured: news.isFeatured,
      publishedAt: news.publishedAt,
      scheduledFor: news.scheduledFor,
      updatedAt: news.updatedAt,
      categoryId: news.categoryId,
      categoryName: newsCategories.name,
      categoryColor: newsCategories.color,
    })
    .from(news)
    .leftJoin(newsCategories, eq(news.categoryId, newsCategories.id))
    .orderBy(desc(news.updatedAt));
}

/** Competições com todos os campos e participantes, para o painel. */
export async function listCompetitionsAdmin(seasonId: string) {
  const rows = await db
    .select({
      id: competitions.id,
      slug: competitions.slug,
      name: competitions.name,
      shortName: competitions.shortName,
      type: competitions.type,
      status: competitions.status,
      leagueId: competitions.leagueId,
      parentSlug: competitions.parentSlug,
      accent: competitions.accent,
      logoUrl: competitions.logoUrl,
      sortOrder: competitions.sortOrder,
      config: competitions.config,
      championClubId: competitions.championClubId,
      championName: clubs.name,
    })
    .from(competitions)
    .leftJoin(clubs, eq(competitions.championClubId, clubs.id))
    .where(eq(competitions.seasonId, seasonId))
    .orderBy(asc(competitions.sortOrder), asc(competitions.name));

  if (rows.length === 0) return [];

  const teams = await db
    .select({ competitionId: competitionTeams.competitionId, clubId: competitionTeams.clubId })
    .from(competitionTeams)
    .where(
      inArray(
        competitionTeams.competitionId,
        rows.map((row) => row.id),
      ),
    );

  const byCompetition = new Map<string, string[]>();
  for (const team of teams) {
    const list = byCompetition.get(team.competitionId) ?? [];
    list.push(team.clubId);
    byCompetition.set(team.competitionId, list);
  }

  return rows.map((row) => ({ ...row, teamIds: byCompetition.get(row.id) ?? [] }));
}

/**
 * Números da temporada para a faixa do hero.
 *
 * Uma consulta só, com subselects, em vez de cinco idas ao banco: é a primeira
 * coisa que a home renderiza e o custo precisa ser desprezível.
 */
export const getSeasonTotals = cache(async (seasonId: string) => {
  const [row] = await db
    .select({
      clubs: sql<number>`(
        select count(distinct ${clubSeasonMemberships.clubId})::int
        from ${clubSeasonMemberships}
        where ${clubSeasonMemberships.seasonId} = ${seasonId}
      )`,
      players: sql<number>`(select count(*)::int from ${players} where ${players.isActive} = true)`,
      matchesPlayed: sql<number>`(
        select count(*)::int from ${matches}
        where ${matches.seasonId} = ${seasonId} and ${matches.status} = 'FINISHED'
      )`,
      goals: sql<number>`(
        select coalesce(sum(${clubSeasonStats.goalsFor}), 0)::int
        from ${clubSeasonStats}
        where ${clubSeasonStats.seasonId} = ${seasonId}
      )`,
    })
    .from(seasons)
    .where(eq(seasons.id, seasonId))
    .limit(1);

  return row ?? { clubs: 0, players: 0, matchesPlayed: 0, goals: 0 };
});
