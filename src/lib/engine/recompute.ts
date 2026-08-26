/**
 * Recálculo das estatísticas materializadas.
 *
 * Regra do sistema: ninguém escreve em `club_season_stats` ou
 * `player_season_stats` à mão. Toda vez que um resultado, um evento ou uma
 * escalação muda, este módulo recalcula a competição inteira a partir das
 * partidas. É mais trabalho de CPU do que atualizar incrementalmente, mas
 * elimina de vez a classe de bug em que a tabela e as partidas discordam —
 * e com 6 clubes por liga o custo é irrelevante.
 */

import { and, eq, inArray } from 'drizzle-orm';

import { db } from '@/db';
import {
  clubSeasonStats,
  clubs,
  competitionRounds,
  competitionTeams,
  competitions,
  matchAppearances,
  matchEvents,
  matches,
  playerSeasonStats,
} from '@/db/schema';
import { parseConfig } from './config';
import {
  buildStandings,
  type DisciplineTotals,
  type FinishedMatch,
} from './standings';

/** Eventos que contam como gol do jogador que finalizou. */
const GOAL_TYPES = ['GOAL', 'PENALTY_GOAL'] as const;

type PlayerAccumulator = {
  playerId: string;
  clubId: string | null;
  matches: number;
  goals: number;
  assists: number;
  wins: number;
  draws: number;
  losses: number;
  minutes: number;
  yellowCards: number;
  redCards: number;
};

function emptyPlayer(playerId: string): PlayerAccumulator {
  return {
    playerId,
    clubId: null,
    matches: 0,
    goals: 0,
    assists: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    minutes: 0,
    yellowCards: 0,
    redCards: 0,
  };
}

/**
 * Recalcula tabela e estatísticas de uma competição.
 * Devolve a tabela final, que também é usada para definir o campeão.
 */
export async function recomputeCompetition(competitionId: string) {
  const [competition] = await db
    .select()
    .from(competitions)
    .where(eq(competitions.id, competitionId))
    .limit(1);

  if (!competition) return null;

  const config = parseConfig(competition.config);

  // ── Participantes ──
  const teams = await db
    .select({ clubId: competitionTeams.clubId, groupName: competitionTeams.groupName })
    .from(competitionTeams)
    .where(eq(competitionTeams.competitionId, competitionId));

  const clubIds = teams.map((team) => team.clubId);
  if (clubIds.length === 0) {
    // Competição sem participantes: limpa qualquer estatística órfã e sai.
    await db.delete(clubSeasonStats).where(eq(clubSeasonStats.competitionId, competitionId));
    await db.delete(playerSeasonStats).where(eq(playerSeasonStats.competitionId, competitionId));
    return { standings: [], config };
  }

  const clubRows = await db
    .select({ id: clubs.id, name: clubs.name })
    .from(clubs)
    .where(inArray(clubs.id, clubIds));
  const clubNames = new Map(clubRows.map((club) => [club.id, club.name]));

  // ── Partidas encerradas ──
  const allMatches = await db
    .select()
    .from(matches)
    .where(eq(matches.competitionId, competitionId));

  const finished = allMatches.filter(
    (m) => m.status === 'FINISHED' && m.homeScore !== null && m.awayScore !== null,
  );

  const matchIds = allMatches.map((m) => m.id);

  const events = matchIds.length
    ? await db.select().from(matchEvents).where(inArray(matchEvents.matchId, matchIds))
    : [];
  const appearances = matchIds.length
    ? await db.select().from(matchAppearances).where(inArray(matchAppearances.matchId, matchIds))
    : [];

  // ── Disciplina por clube (para os critérios de desempate por cartões) ──
  const discipline = new Map<string, DisciplineTotals>();
  const finishedIds = new Set(finished.map((m) => m.id));
  for (const event of events) {
    if (!finishedIds.has(event.matchId)) continue;
    const totals = discipline.get(event.clubId) ?? { yellowCards: 0, redCards: 0 };
    if (event.type === 'YELLOW_CARD') totals.yellowCards += 1;
    if (event.type === 'RED_CARD') totals.redCards += 1;
    discipline.set(event.clubId, totals);
  }

  // ── Tabela ──
  // A tabela de classificação só considera a fase de pontos corridos. Jogos de
  // mata-mata dentro da mesma competição não somam pontos na tabela.
  const roundRows = await db
    .select({ id: competitionRounds.id, type: competitionRounds.type })
    .from(competitionRounds)
    .where(eq(competitionRounds.competitionId, competitionId));
  const knockoutRoundIds = new Set(
    roundRows.filter((r) => r.type === 'KNOCKOUT').map((r) => r.id),
  );

  const leagueMatches: FinishedMatch[] = finished
    .filter((m) => !m.roundId || !knockoutRoundIds.has(m.roundId))
    .map((m) => ({
      homeClubId: m.homeClubId,
      awayClubId: m.awayClubId,
      homeScore: m.homeScore!,
      awayScore: m.awayScore!,
      kickoffAt: m.kickoffAt,
    }));

  const standings = buildStandings({
    clubIds,
    matches: leagueMatches,
    config,
    clubNames,
    discipline,
  });

  // ── Persistência da tabela ──
  await db.transaction(async (tx) => {
    await tx.delete(clubSeasonStats).where(eq(clubSeasonStats.competitionId, competitionId));
    if (standings.length > 0) {
      await tx.insert(clubSeasonStats).values(
        standings.map((row) => ({
          clubId: row.clubId,
          seasonId: competition.seasonId,
          competitionId,
          played: row.played,
          won: row.won,
          drawn: row.drawn,
          lost: row.lost,
          goalsFor: row.goalsFor,
          goalsAgainst: row.goalsAgainst,
          points: row.points,
          position: row.position,
          form: row.form,
        })),
      );
    }
  });

  // ── Estatísticas individuais ──
  // Aqui entram TODAS as partidas encerradas da competição, inclusive
  // mata-mata: gol de semifinal conta para a artilharia.
  const players = new Map<string, PlayerAccumulator>();
  const ensure = (playerId: string) => {
    const existing = players.get(playerId);
    if (existing) return existing;
    const created = emptyPlayer(playerId);
    players.set(playerId, created);
    return created;
  };

  const resultByMatch = new Map<string, { home: number; away: number }>();
  for (const m of finished) {
    resultByMatch.set(m.id, { home: m.homeScore!, away: m.awayScore! });
  }
  const homeClubByMatch = new Map(finished.map((m) => [m.id, m.homeClubId]));

  for (const appearance of appearances) {
    if (!finishedIds.has(appearance.matchId)) continue;
    const acc = ensure(appearance.playerId);
    acc.clubId = appearance.clubId;
    acc.matches += 1;
    acc.minutes += appearance.minutes;

    const result = resultByMatch.get(appearance.matchId);
    const homeClubId = homeClubByMatch.get(appearance.matchId);
    if (!result || !homeClubId) continue;

    const isHome = appearance.clubId === homeClubId;
    const own = isHome ? result.home : result.away;
    const opponent = isHome ? result.away : result.home;
    if (own > opponent) acc.wins += 1;
    else if (own < opponent) acc.losses += 1;
    else acc.draws += 1;
  }

  for (const event of events) {
    if (!finishedIds.has(event.matchId)) continue;

    if (event.playerId) {
      const acc = ensure(event.playerId);
      acc.clubId ??= event.clubId;
      if ((GOAL_TYPES as readonly string[]).includes(event.type)) acc.goals += 1;
      if (event.type === 'YELLOW_CARD') acc.yellowCards += 1;
      if (event.type === 'RED_CARD') acc.redCards += 1;
      // Gol contra conta para o placar, mas não para a artilharia do jogador.
    }

    if (event.assistPlayerId && (GOAL_TYPES as readonly string[]).includes(event.type)) {
      const acc = ensure(event.assistPlayerId);
      acc.clubId ??= event.clubId;
      acc.assists += 1;
    }
  }

  await db.transaction(async (tx) => {
    await tx.delete(playerSeasonStats).where(eq(playerSeasonStats.competitionId, competitionId));
    const rows = [...players.values()];
    if (rows.length > 0) {
      await tx.insert(playerSeasonStats).values(
        rows.map((row) => ({
          playerId: row.playerId,
          seasonId: competition.seasonId,
          competitionId,
          clubId: row.clubId,
          matches: row.matches,
          goals: row.goals,
          assists: row.assists,
          wins: row.wins,
          draws: row.draws,
          losses: row.losses,
          minutes: row.minutes,
          yellowCards: row.yellowCards,
          redCards: row.redCards,
        })),
      );
    }
  });

  // ── Campeão ──
  await resolveChampion(competitionId);

  return { standings, config };
}

/**
 * Define o campeão da competição.
 *  • Mata-mata: vencedor da última fase, quando ela já terminou.
 *  • Pontos corridos: líder da tabela, quando todas as partidas acabaram.
 * Enquanto houver jogo pendente, o campeão volta a ser nulo — evita "campeão"
 * aparecendo no meio da competição.
 */
export async function resolveChampion(competitionId: string) {
  const [competition] = await db
    .select()
    .from(competitions)
    .where(eq(competitions.id, competitionId))
    .limit(1);
  if (!competition) return;

  const allMatches = await db
    .select()
    .from(matches)
    .where(eq(matches.competitionId, competitionId));

  if (allMatches.length === 0) {
    await db
      .update(competitions)
      .set({ championClubId: null })
      .where(eq(competitions.id, competitionId));
    return;
  }

  const rounds = await db
    .select()
    .from(competitionRounds)
    .where(eq(competitionRounds.competitionId, competitionId));

  const knockoutRounds = rounds
    .filter((r) => r.type === 'KNOCKOUT')
    .sort((a, b) => b.order - a.order);

  let championClubId: string | null = null;

  if (knockoutRounds.length > 0) {
    const finalRound = knockoutRounds[0];
    // O confronto de índice 0 é a final; um eventual índice 1 é a disputa de
    // terceiro lugar e não define campeão.
    const finalMatches = allMatches
      .filter((m) => m.roundId === finalRound.id)
      .sort((a, b) => (a.bracketSlot ?? 0) - (b.bracketSlot ?? 0));
    const decider = finalMatches[0];

    if (decider && decider.status === 'FINISHED' && decider.homeScore !== null && decider.awayScore !== null) {
      championClubId = winnerOf(decider);
    }
  } else {
    const pending = allMatches.some(
      (m) => m.status === 'SCHEDULED' || m.status === 'LIVE' || m.status === 'POSTPONED',
    );
    if (!pending) {
      const [leader] = await db
        .select({ clubId: clubSeasonStats.clubId })
        .from(clubSeasonStats)
        .where(and(eq(clubSeasonStats.competitionId, competitionId), eq(clubSeasonStats.position, 1)))
        .limit(1);
      championClubId = leader?.clubId ?? null;
    }
  }

  await db
    .update(competitions)
    .set({
      championClubId,
      status: championClubId ? 'FINISHED' : competition.status,
    })
    .where(eq(competitions.id, competitionId));
}

/** Vencedor de um confronto eliminatório, considerando pênaltis. */
export function winnerOf(match: {
  homeClubId: string;
  awayClubId: string;
  homeScore: number | null;
  awayScore: number | null;
  homePenalties: number | null;
  awayPenalties: number | null;
}): string | null {
  if (match.homeScore === null || match.awayScore === null) return null;
  if (match.homeScore > match.awayScore) return match.homeClubId;
  if (match.homeScore < match.awayScore) return match.awayClubId;

  if (match.homePenalties !== null && match.awayPenalties !== null) {
    if (match.homePenalties > match.awayPenalties) return match.homeClubId;
    if (match.homePenalties < match.awayPenalties) return match.awayClubId;
  }

  // Empate sem pênaltis registrados: sem vencedor. A próxima fase fica com a
  // vaga em aberto em vez de escolher um clube arbitrariamente.
  return null;
}

/** Recalcula a competição de uma partida específica. */
export async function recomputeForMatch(matchId: string) {
  const [match] = await db
    .select({ competitionId: matches.competitionId })
    .from(matches)
    .where(eq(matches.id, matchId))
    .limit(1);
  if (!match) return;
  await recomputeCompetition(match.competitionId);
}

/** Recalcula todas as competições de uma temporada. */
export async function recomputeSeason(seasonId: string) {
  const rows = await db
    .select({ id: competitions.id })
    .from(competitions)
    .where(eq(competitions.seasonId, seasonId));
  for (const row of rows) {
    await recomputeCompetition(row.id);
  }
}
