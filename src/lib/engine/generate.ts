/**
 * Geração automática de confrontos — itens 9, 11, 12, 13 e 34 do escopo.
 *
 * Tudo aqui lê a configuração da competição (`competitions.config`) e as zonas
 * de classificação da liga. Nenhum número mágico: trocar "4 vagas na
 * Libertadores" para 3 é editar a zona no painel, não o código.
 */

import { and, asc, eq, inArray } from 'drizzle-orm';

import { db } from '@/db';
import {
  clubSeasonStats,
  clubs,
  competitionRounds,
  competitionTeams,
  competitions,
  matches,
  qualificationZones,
} from '@/db/schema';
import { slugify } from '@/lib/utils';
import { planBracket, roundRobin, seededShuffle, type BracketSource } from './bracket';
import { parseConfig } from './config';
import { recomputeCompetition, winnerOf } from './recompute';

export type GenerateOptions = {
  startAt: Date;
  daysBetweenRounds: number;
  replaceExisting: boolean;
  venue?: string | null;
};

export type GenerateResult = {
  created: number;
  removed: number;
  warnings: string[];
};

/* ══════════════════════════════════════════════════════════════
   FASE DE PONTOS CORRIDOS
   ══════════════════════════════════════════════════════════════ */

/**
 * Gera o calendário de uma competição de pontos corridos.
 * O número de turnos vem de `config.rounds` (2 = turno e returno).
 */
export async function generateLeagueFixtures(
  competitionId: string,
  options: GenerateOptions,
): Promise<GenerateResult> {
  const warnings: string[] = [];

  const [competition] = await db
    .select()
    .from(competitions)
    .where(eq(competitions.id, competitionId))
    .limit(1);

  if (!competition) throw new Error('Competição não encontrada.');

  const config = parseConfig(competition.config);

  const teams = await db
    .select({ clubId: competitionTeams.clubId })
    .from(competitionTeams)
    .where(eq(competitionTeams.competitionId, competitionId));

  if (teams.length < 2) {
    throw new Error('Defina pelo menos 2 clubes participantes antes de gerar a tabela.');
  }

  if (teams.length !== config.teamCount) {
    warnings.push(
      `A configuração prevê ${config.teamCount} clubes, mas a competição tem ${teams.length}. O calendário foi gerado com os clubes realmente cadastrados.`,
    );
  }

  let removed = 0;
  if (options.replaceExisting) {
    // Só apaga partidas da fase de pontos corridos; chaveamento já jogado fica.
    const knockoutRounds = await db
      .select({ id: competitionRounds.id })
      .from(competitionRounds)
      .where(
        and(
          eq(competitionRounds.competitionId, competitionId),
          eq(competitionRounds.type, 'KNOCKOUT'),
        ),
      );
    const protectedRounds = new Set(knockoutRounds.map((round) => round.id));

    const existing = await db
      .select({ id: matches.id, roundId: matches.roundId })
      .from(matches)
      .where(eq(matches.competitionId, competitionId));

    const removable = existing
      .filter((match) => !match.roundId || !protectedRounds.has(match.roundId))
      .map((match) => match.id);

    if (removable.length > 0) {
      await db.delete(matches).where(inArray(matches.id, removable));
      removed = removable.length;
    }
  }

  const fixtures = roundRobin(
    teams.map((team) => team.clubId),
    config.rounds,
  );

  if (fixtures.length === 0) {
    throw new Error('Não foi possível montar o calendário com os clubes informados.');
  }

  const values = fixtures.map((fixture) => ({
    seasonId: competition.seasonId,
    competitionId,
    homeClubId: fixture.home,
    awayClubId: fixture.away,
    matchday: fixture.matchday,
    kickoffAt: addDays(options.startAt, (fixture.matchday - 1) * options.daysBetweenRounds),
    venue: options.venue ?? null,
    status: 'SCHEDULED' as const,
  }));

  await db.insert(matches).values(values);
  await recomputeCompetition(competitionId);

  return { created: values.length, removed, warnings };
}

/* ══════════════════════════════════════════════════════════════
   MATA-MATA
   ══════════════════════════════════════════════════════════════ */

/**
 * Cria as fases e os confrontos do mata-mata.
 *
 * Os classificados saem, nesta ordem de preferência:
 *   1. do `seed` definido manualmente em `competition_teams`;
 *   2. da posição final na competição-pai (`parentSlug`), quando houver;
 *   3. da posição na tabela desta mesma competição.
 *
 * Confrontos cujo par ainda depende de um vencedor não são criados agora —
 * eles nascem quando a fase anterior termina (`advanceBracket`).
 */
export async function generateKnockout(
  competitionId: string,
  options: GenerateOptions,
): Promise<GenerateResult> {
  const warnings: string[] = [];

  const [competition] = await db
    .select()
    .from(competitions)
    .where(eq(competitions.id, competitionId))
    .limit(1);

  if (!competition) throw new Error('Competição não encontrada.');

  const config = parseConfig(competition.config);
  if (!config.knockout.enabled) {
    throw new Error('O mata-mata está desativado na configuração desta competição.');
  }

  const plan = planBracket(config.knockout);
  if (plan.errors.length > 0) {
    throw new Error(plan.errors.join(' '));
  }

  const seeds = await resolveSeeds(competition, config.knockout.qualifiers, config.knockout.seeding);

  if (seeds.length < config.knockout.qualifiers) {
    warnings.push(
      `A configuração pede ${config.knockout.qualifiers} classificados, mas só foi possível definir ${seeds.length}. Os confrontos sem clube ficam em aberto.`,
    );
  }

  let removed = 0;
  if (options.replaceExisting) {
    const existingRounds = await db
      .select({ id: competitionRounds.id })
      .from(competitionRounds)
      .where(
        and(
          eq(competitionRounds.competitionId, competitionId),
          eq(competitionRounds.type, 'KNOCKOUT'),
        ),
      );

    if (existingRounds.length > 0) {
      const ids = existingRounds.map((round) => round.id);
      const toRemove = await db
        .select({ id: matches.id })
        .from(matches)
        .where(inArray(matches.roundId, ids));

      if (toRemove.length > 0) {
        await db.delete(matches).where(inArray(matches.id, toRemove.map((m) => m.id)));
        removed = toRemove.length;
      }
      await db.delete(competitionRounds).where(inArray(competitionRounds.id, ids));
    }
  }

  // ── Cria as fases ──
  const roundIds = new Map<number, string>();

  for (const round of plan.rounds) {
    const [created] = await db
      .insert(competitionRounds)
      .values({
        competitionId,
        name: round.name,
        slug: slugify(round.slug),
        type: 'KNOCKOUT',
        order: round.index,
        legs: round.legs,
        slots: round.matches,
      })
      .returning({ id: competitionRounds.id });

    roundIds.set(round.index, created.id);
  }

  // ── Cria os confrontos cujos dois lados já são conhecidos ──
  const created: typeof matches.$inferInsert[] = [];

  for (const match of plan.matches) {
    const home = resolveSource(match.home, seeds);
    const away = resolveSource(match.away, seeds);
    if (!home || !away) continue; // depende de um vencedor ainda indefinido

    created.push({
      seasonId: competition.seasonId,
      competitionId,
      roundId: roundIds.get(match.round),
      homeClubId: home,
      awayClubId: away,
      bracketSlot: match.index,
      kickoffAt: addDays(options.startAt, match.round * options.daysBetweenRounds),
      venue: options.venue ?? null,
      status: 'SCHEDULED',
    });
  }

  if (created.length > 0) {
    await db.insert(matches).values(created);
  }

  await db
    .update(competitions)
    .set({ status: 'IN_PROGRESS' })
    .where(eq(competitions.id, competitionId));

  await recomputeCompetition(competitionId);

  return { created: created.length, removed, warnings };
}

function resolveSource(source: BracketSource, seeds: string[]): string | null {
  if (source.kind === 'SEED') return seeds[source.seed - 1] ?? null;
  return null;
}

/**
 * Ordem de entrada dos clubes no chaveamento.
 * `seed` manual tem prioridade; depois vem a tabela da competição-pai; por
 * último a tabela da própria competição.
 */
async function resolveSeeds(
  competition: typeof competitions.$inferSelect,
  qualifiers: number,
  seeding: 'TABLE_POSITION' | 'SNAKE_CROSS' | 'RANDOM',
): Promise<string[]> {
  const teams = await db
    .select({ clubId: competitionTeams.clubId, seed: competitionTeams.seed })
    .from(competitionTeams)
    .where(eq(competitionTeams.competitionId, competition.id));

  const manual = teams
    .filter((team) => team.seed !== null)
    .sort((a, b) => (a.seed ?? 0) - (b.seed ?? 0));

  if (manual.length >= qualifiers) {
    return manual.slice(0, qualifiers).map((team) => team.clubId);
  }

  // Tabela de referência: a competição-pai, se houver; senão, a própria.
  let sourceCompetitionId = competition.id;

  if (competition.parentSlug) {
    const [parent] = await db
      .select({ id: competitions.id })
      .from(competitions)
      .where(
        and(
          eq(competitions.slug, competition.parentSlug),
          eq(competitions.seasonId, competition.seasonId),
        ),
      )
      .limit(1);
    if (parent) sourceCompetitionId = parent.id;
  }

  const table = await db
    .select({ clubId: clubSeasonStats.clubId })
    .from(clubSeasonStats)
    .where(eq(clubSeasonStats.competitionId, sourceCompetitionId))
    .orderBy(asc(clubSeasonStats.position));

  const participantIds = new Set(teams.map((team) => team.clubId));

  // Só considera clubes que realmente participam desta competição.
  const ordered = table
    .map((row) => row.clubId)
    .filter((clubId) => participantIds.size === 0 || participantIds.has(clubId));

  const pool = ordered.length > 0 ? ordered : teams.map((team) => team.clubId);

  if (seeding === 'RANDOM') {
    // Semente derivada do id da competição: o mesmo sorteio pode ser refeito
    // e auditado depois.
    const seedNumber = [...competition.id].reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return seededShuffle(pool, seedNumber).slice(0, qualifiers);
  }

  return pool.slice(0, qualifiers);
}

/**
 * Avança o chaveamento: cria (ou preenche) os confrontos da fase seguinte com
 * os vencedores já definidos. Chamado sempre que um resultado é registrado.
 */
export async function advanceBracket(competitionId: string): Promise<number> {
  const [competition] = await db
    .select()
    .from(competitions)
    .where(eq(competitions.id, competitionId))
    .limit(1);
  if (!competition) return 0;

  const config = parseConfig(competition.config);
  if (!config.knockout.enabled) return 0;

  const plan = planBracket(config.knockout);
  if (plan.errors.length > 0) return 0;

  const rounds = await db
    .select()
    .from(competitionRounds)
    .where(
      and(
        eq(competitionRounds.competitionId, competitionId),
        eq(competitionRounds.type, 'KNOCKOUT'),
      ),
    )
    .orderBy(asc(competitionRounds.order));

  if (rounds.length === 0) return 0;

  const roundByOrder = new Map(rounds.map((round) => [round.order, round]));

  const existing = await db
    .select()
    .from(matches)
    .where(eq(matches.competitionId, competitionId));

  const seeds = await resolveSeeds(competition, config.knockout.qualifiers, config.knockout.seeding);

  /** Vencedor de um confronto do plano, se já estiver decidido. */
  const winnerOfPlanned = (roundIndex: number, matchIndex: number): string | null => {
    const round = roundByOrder.get(roundIndex);
    if (!round) return null;

    const match = existing.find(
      (item) => item.roundId === round.id && item.bracketSlot === matchIndex,
    );
    if (!match || match.status !== 'FINISHED') return null;

    return winnerOf(match);
  };

  const resolve = (source: BracketSource): string | null => {
    if (source.kind === 'SEED') return seeds[source.seed - 1] ?? null;
    return winnerOfPlanned(source.round, source.match);
  };

  let touched = 0;

  /**
   * Data da fase seguinte: uma semana depois do último jogo da fase anterior.
   * Usar `new Date()` aqui datava a partida no futuro mesmo quando ela já
   * tinha sido disputada — era o que fazia resultados antigos aparecerem com
   * data posterior à de hoje.
   */
  const kickoffForRound = (roundIndex: number): Date => {
    const previous = roundByOrder.get(roundIndex - 1);
    const reference = previous
      ? existing
          .filter((match) => match.roundId === previous.id)
          .map((match) => match.kickoffAt.getTime())
          .sort((a, b) => b - a)[0]
      : undefined;

    return addDays(reference ? new Date(reference) : new Date(), 7);
  };

  for (const planned of plan.matches) {
    const round = roundByOrder.get(planned.round);
    if (!round) continue;

    const home = resolve(planned.home);
    const away = resolve(planned.away);
    if (!home || !away) continue;

    const current = existing.find(
      (item) => item.roundId === round.id && item.bracketSlot === planned.index,
    );

    if (!current) {
      await db.insert(matches).values({
        seasonId: competition.seasonId,
        competitionId,
        roundId: round.id,
        homeClubId: home,
        awayClubId: away,
        bracketSlot: planned.index,
        kickoffAt: kickoffForRound(planned.round),
        status: 'SCHEDULED',
      });
      touched += 1;
      continue;
    }

    // Confronto já existe mas com clubes de placeholder: corrige, desde que
    // ainda não tenha sido jogado — nunca mexemos numa partida encerrada.
    if (
      current.status === 'SCHEDULED' &&
      (current.homeClubId !== home || current.awayClubId !== away)
    ) {
      await db
        .update(matches)
        .set({ homeClubId: home, awayClubId: away })
        .where(eq(matches.id, current.id));
      touched += 1;
    }
  }

  if (touched > 0) await recomputeCompetition(competitionId);
  return touched;
}

/* ══════════════════════════════════════════════════════════════
   CLASSIFICAÇÃO CONTINENTAL (itens 10, 11, 12)
   ══════════════════════════════════════════════════════════════ */

/**
 * Preenche os participantes de uma competição continental a partir das zonas
 * de classificação das ligas. Quem define quantos clubes e de quais ligas é a
 * tabela `qualification_zones`, editável pelo administrador.
 *
 * Exemplo da VFA: a zona "Libertadores" das ligas Brasileira e Argentina tem
 * `targetSlug = 'vfa-libertadores'` e cobre as posições 1 a 4.
 */
export async function populateContinental(competitionId: string): Promise<{
  added: number;
  warnings: string[];
}> {
  const warnings: string[] = [];

  const [competition] = await db
    .select()
    .from(competitions)
    .where(eq(competitions.id, competitionId))
    .limit(1);
  if (!competition) throw new Error('Competição não encontrada.');

  // Zonas que apontam para esta competição.
  const zones = await db
    .select()
    .from(qualificationZones)
    .where(eq(qualificationZones.targetSlug, competition.slug));

  if (zones.length === 0) {
    throw new Error(
      `Nenhuma liga aponta para esta competição. Configure uma zona de classificação com destino "${competition.slug}" em Administração → Competições → Zonas.`,
    );
  }

  const qualified: { clubId: string; position: number }[] = [];

  for (const zone of zones) {
    const leagueCompetition = await db
      .select({ id: competitions.id })
      .from(competitions)
      .where(
        and(
          eq(competitions.leagueId, zone.leagueId),
          eq(competitions.seasonId, competition.seasonId),
          eq(competitions.type, 'LEAGUE'),
        ),
      )
      .limit(1);

    if (leagueCompetition.length === 0) {
      warnings.push('Uma das ligas configuradas não tem competição de pontos corridos nesta temporada.');
      continue;
    }

    const table = await db
      .select({ clubId: clubSeasonStats.clubId, position: clubSeasonStats.position })
      .from(clubSeasonStats)
      .where(eq(clubSeasonStats.competitionId, leagueCompetition[0].id))
      .orderBy(asc(clubSeasonStats.position));

    const slice = table.filter(
      (row) => row.position >= zone.fromPosition && row.position <= zone.toPosition,
    );

    if (slice.length === 0) {
      warnings.push(
        `A zona "${zone.label}" não devolveu nenhum clube — a tabela da liga ainda está vazia.`,
      );
    }

    qualified.push(...slice);
  }

  if (qualified.length === 0) {
    throw new Error(
      'Nenhum clube classificado foi encontrado. Registre resultados nas ligas antes de montar a competição continental.',
    );
  }

  await db.delete(competitionTeams).where(eq(competitionTeams.competitionId, competitionId));

  // Cabeças de chave por posição na liga de origem: campeões primeiro.
  const ordered = [...qualified].sort((a, b) => a.position - b.position);

  await db.insert(competitionTeams).values(
    ordered.map((entry, index) => ({
      competitionId,
      clubId: entry.clubId,
      seed: index + 1,
    })),
  );

  await recomputeCompetition(competitionId);

  return { added: ordered.length, warnings };
}

/**
 * Monta a final Intercontinental com os campeões das duas competições
 * continentais indicadas em `config` (`parentSlug` separado por vírgula).
 */
export async function populateIntercontinental(
  competitionId: string,
  sourceSlugs: string[],
): Promise<{ ready: boolean; warnings: string[] }> {
  const warnings: string[] = [];

  const [competition] = await db
    .select()
    .from(competitions)
    .where(eq(competitions.id, competitionId))
    .limit(1);
  if (!competition) throw new Error('Competição não encontrada.');

  const sources = await db
    .select({ slug: competitions.slug, name: competitions.name, championClubId: competitions.championClubId })
    .from(competitions)
    .where(
      and(
        inArray(competitions.slug, sourceSlugs),
        eq(competitions.seasonId, competition.seasonId),
      ),
    );

  const champions = sources.filter((source) => source.championClubId);

  for (const source of sources) {
    if (!source.championClubId) {
      warnings.push(`A ${source.name} ainda não tem campeão definido.`);
    }
  }

  if (champions.length < 2) {
    return { ready: false, warnings };
  }

  await db.delete(competitionTeams).where(eq(competitionTeams.competitionId, competitionId));
  await db.insert(competitionTeams).values(
    champions.map((source, index) => ({
      competitionId,
      clubId: source.championClubId!,
      seed: index + 1,
    })),
  );

  return { ready: true, warnings };
}

/* ── Utilidades ────────────────────────────────────────────── */

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/** Nomes dos clubes, para mensagens de erro legíveis. */
export async function clubNames(clubIds: string[]): Promise<Map<string, string>> {
  if (clubIds.length === 0) return new Map();
  const rows = await db
    .select({ id: clubs.id, name: clubs.name })
    .from(clubs)
    .where(inArray(clubs.id, clubIds));
  return new Map(rows.map((row) => [row.id, row.name]));
}
