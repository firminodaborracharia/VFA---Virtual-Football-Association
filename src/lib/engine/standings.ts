/**
 * Motor de classificação — item 8 do escopo.
 *
 * Funções puras, sem acesso ao banco: recebem a lista de partidas encerradas e
 * a configuração da competição e devolvem a tabela ordenada. Isso torna a
 * lógica testável e garante que a mesma regra vale no site, na API e no seed.
 *
 * O desempate é feito em camadas: os clubes são agrupados pelo critério atual,
 * e só os grupos que continuam empatados descem para o próximo critério. É
 * assim que funciona na prática — inclusive o confronto direto, que num empate
 * de três ou mais clubes usa uma minitabela só entre os envolvidos, e não
 * comparações par a par (que podem ser cíclicas e dar resultado incoerente).
 */

import type { CompetitionConfig, Tiebreaker } from './config';

export type FinishedMatch = {
  homeClubId: string;
  awayClubId: string;
  homeScore: number;
  awayScore: number;
  kickoffAt: Date;
};

export type DisciplineTotals = {
  yellowCards: number;
  redCards: number;
};

export type StandingRow = {
  clubId: string;
  position: number;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
  /** Últimos 5 resultados, do mais recente para o mais antigo: "WDLWW". */
  form: string;
  yellowCards: number;
  redCards: number;
};

type WorkingRow = Omit<StandingRow, 'position' | 'goalDifference' | 'form'> & {
  /** Resultados em ordem cronológica; vira `form` no final. */
  results: ('W' | 'D' | 'L')[];
};

function emptyRow(clubId: string): WorkingRow {
  return {
    clubId,
    played: 0,
    won: 0,
    drawn: 0,
    lost: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    points: 0,
    yellowCards: 0,
    redCards: 0,
    results: [],
  };
}

/**
 * Acumula os resultados. Só partidas com placar definido entram — jogo
 * agendado, adiado ou cancelado não altera a tabela.
 */
function accumulate(
  clubIds: string[],
  matches: FinishedMatch[],
  config: CompetitionConfig,
  discipline: Map<string, DisciplineTotals>,
): Map<string, WorkingRow> {
  const table = new Map<string, WorkingRow>();
  for (const clubId of clubIds) table.set(clubId, emptyRow(clubId));

  const ordered = [...matches].sort((a, b) => a.kickoffAt.getTime() - b.kickoffAt.getTime());

  for (const match of ordered) {
    const home = table.get(match.homeClubId);
    const away = table.get(match.awayClubId);
    // Um clube fora da lista de participantes é ignorado em vez de criar
    // uma linha fantasma na tabela.
    if (!home || !away) continue;

    home.played += 1;
    away.played += 1;
    home.goalsFor += match.homeScore;
    home.goalsAgainst += match.awayScore;
    away.goalsFor += match.awayScore;
    away.goalsAgainst += match.homeScore;

    if (match.homeScore > match.awayScore) {
      home.won += 1;
      home.points += config.points.win;
      home.results.push('W');
      away.lost += 1;
      away.points += config.points.loss;
      away.results.push('L');
    } else if (match.homeScore < match.awayScore) {
      away.won += 1;
      away.points += config.points.win;
      away.results.push('W');
      home.lost += 1;
      home.points += config.points.loss;
      home.results.push('L');
    } else {
      home.drawn += 1;
      away.drawn += 1;
      home.points += config.points.draw;
      away.points += config.points.draw;
      home.results.push('D');
      away.results.push('D');
    }
  }

  for (const [clubId, row] of table) {
    const cards = discipline.get(clubId);
    if (cards) {
      row.yellowCards = cards.yellowCards;
      row.redCards = cards.redCards;
    }
  }

  return table;
}

/**
 * Valor numérico de um critério. Maior é melhor — critérios "menos é melhor"
 * são invertidos com sinal negativo.
 */
function criterionValue(row: WorkingRow, criterion: Tiebreaker): number {
  switch (criterion) {
    case 'POINTS':
      return row.points;
    case 'WINS':
      return row.won;
    case 'GOAL_DIFFERENCE':
      return row.goalsFor - row.goalsAgainst;
    case 'GOALS_FOR':
      return row.goalsFor;
    case 'GOALS_AGAINST':
      return -row.goalsAgainst;
    case 'FEWEST_RED_CARDS':
      return -row.redCards;
    case 'FEWEST_YELLOW_CARDS':
      return -row.yellowCards;
    default:
      return 0;
  }
}

/**
 * Minitabela do confronto direto: só as partidas entre os clubes empatados.
 * Devolve, para cada clube, uma tupla comparável [pontos, saldo, gols pró].
 */
function headToHeadRanking(
  tied: WorkingRow[],
  matches: FinishedMatch[],
  config: CompetitionConfig,
): Map<string, [number, number, number]> {
  const ids = new Set(tied.map((row) => row.clubId));
  const mini = new Map<string, [number, number, number]>();
  for (const id of ids) mini.set(id, [0, 0, 0]);

  for (const match of matches) {
    if (!ids.has(match.homeClubId) || !ids.has(match.awayClubId)) continue;

    const home = mini.get(match.homeClubId)!;
    const away = mini.get(match.awayClubId)!;

    home[1] += match.homeScore - match.awayScore;
    home[2] += match.homeScore;
    away[1] += match.awayScore - match.homeScore;
    away[2] += match.awayScore;

    if (match.homeScore > match.awayScore) {
      home[0] += config.points.win;
      away[0] += config.points.loss;
    } else if (match.homeScore < match.awayScore) {
      away[0] += config.points.win;
      home[0] += config.points.loss;
    } else {
      home[0] += config.points.draw;
      away[0] += config.points.draw;
    }
  }

  return mini;
}

/** Ordena um grupo de clubes empatados aplicando os critérios restantes. */
function rankGroup(
  group: WorkingRow[],
  criteria: Tiebreaker[],
  matches: FinishedMatch[],
  config: CompetitionConfig,
  clubNames: Map<string, string>,
): WorkingRow[] {
  if (group.length <= 1 || criteria.length === 0) {
    // Sem mais critérios: ordem alfabética como desempate final determinístico,
    // para que a tabela não mude de ordem entre dois carregamentos.
    return [...group].sort((a, b) =>
      (clubNames.get(a.clubId) ?? a.clubId).localeCompare(clubNames.get(b.clubId) ?? b.clubId),
    );
  }

  const [criterion, ...rest] = criteria;

  if (criterion === 'ALPHABETICAL') {
    return [...group].sort((a, b) =>
      (clubNames.get(a.clubId) ?? a.clubId).localeCompare(clubNames.get(b.clubId) ?? b.clubId),
    );
  }

  // Chave comparável de cada clube segundo o critério atual.
  let keyOf: (row: WorkingRow) => number[];

  if (criterion === 'HEAD_TO_HEAD') {
    // Confronto direto só faz sentido entre os clubes empatados; com apenas um
    // clube o critério é inócuo e pulamos direto para o próximo.
    const mini = headToHeadRanking(group, matches, config);
    keyOf = (row) => mini.get(row.clubId) ?? [0, 0, 0];
  } else {
    keyOf = (row) => [criterionValue(row, criterion)];
  }

  const buckets = new Map<string, WorkingRow[]>();
  for (const row of group) {
    const key = keyOf(row).join('|');
    const bucket = buckets.get(key);
    if (bucket) bucket.push(row);
    else buckets.set(key, [row]);
  }

  const sortedKeys = [...buckets.keys()].sort((a, b) => {
    const av = a.split('|').map(Number);
    const bv = b.split('|').map(Number);
    for (let i = 0; i < Math.max(av.length, bv.length); i += 1) {
      const diff = (bv[i] ?? 0) - (av[i] ?? 0);
      if (diff !== 0) return diff;
    }
    return 0;
  });

  return sortedKeys.flatMap((key) =>
    rankGroup(buckets.get(key)!, rest, matches, config, clubNames),
  );
}

export type BuildStandingsInput = {
  clubIds: string[];
  matches: FinishedMatch[];
  config: CompetitionConfig;
  /** Nomes dos clubes, usados no desempate alfabético. */
  clubNames?: Map<string, string>;
  /** Totais de cartões por clube, para os critérios disciplinares. */
  discipline?: Map<string, DisciplineTotals>;
};

/**
 * Constrói a tabela de classificação ordenada e com posição preenchida.
 */
export function buildStandings({
  clubIds,
  matches,
  config,
  clubNames = new Map(),
  discipline = new Map(),
}: BuildStandingsInput): StandingRow[] {
  const table = accumulate(clubIds, matches, config, discipline);
  const ranked = rankGroup([...table.values()], config.tiebreakers, matches, config, clubNames);

  return ranked.map((row, index) => ({
    clubId: row.clubId,
    position: index + 1,
    played: row.played,
    won: row.won,
    drawn: row.drawn,
    lost: row.lost,
    goalsFor: row.goalsFor,
    goalsAgainst: row.goalsAgainst,
    goalDifference: row.goalsFor - row.goalsAgainst,
    points: row.points,
    form: row.results.slice(-5).reverse().join(''),
    yellowCards: row.yellowCards,
    redCards: row.redCards,
  }));
}

/**
 * Agrupa a tabela por grupo da fase de grupos (Libertadores / Champions).
 * Cada grupo é classificado de forma independente.
 */
export function buildGroupStandings(
  groups: Map<string, string[]>,
  input: Omit<BuildStandingsInput, 'clubIds'>,
): Map<string, StandingRow[]> {
  const out = new Map<string, StandingRow[]>();
  for (const [groupName, clubIds] of groups) {
    out.set(groupName, buildStandings({ ...input, clubIds }));
  }
  return out;
}

/**
 * Zona de classificação de uma posição, segundo as faixas configuradas pelo
 * administrador. Devolve `null` quando a posição está fora de todas as zonas.
 */
export type Zone = {
  label: string;
  color: string;
  targetSlug: string | null;
};

export function zoneForPosition(
  position: number,
  zones: { label: string; color: string; fromPosition: number; toPosition: number; targetSlug: string | null }[],
): Zone | null {
  const match = zones.find((zone) => position >= zone.fromPosition && position <= zone.toPosition);
  if (!match) return null;
  return { label: match.label, color: match.color, targetSlug: match.targetSlug };
}
