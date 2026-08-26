/**
 * Gerador de chaveamento — itens 9, 11, 12 e 13 do escopo.
 *
 * Funções puras: descrevem a estrutura do mata-mata a partir da configuração da
 * competição, sem tocar no banco. `src/lib/engine/generate.ts` transforma essa
 * descrição em partidas reais.
 *
 * O caso da VFA: 6 clubes por liga com 2 byes. Como 6 não preenche uma chave
 * de quartas (que pede 8), o 1º e o 2º colocados entram direto na semifinal e
 * os quatro seguintes disputam a fase anterior — 3º×6º e 4º×5º. O número de
 * byes é configurável, então trocar para "só os 4 primeiros" é mudar
 * `qualifiers` para 4 e `byes` para 0 no painel, sem alterar código.
 */

import type { KnockoutConfig } from './config';

export type BracketSource =
  | { kind: 'SEED'; seed: number }
  | { kind: 'WINNER'; round: number; match: number };

export type BracketMatchPlan = {
  /** Índice da fase, 0 = primeira fase eliminatória. */
  round: number;
  /** Posição do confronto dentro da fase. */
  index: number;
  home: BracketSource;
  away: BracketSource;
};

export type BracketRoundPlan = {
  index: number;
  name: string;
  slug: string;
  /** Quantos confrontos esta fase tem. */
  matches: number;
  legs: number;
};

export type BracketPlan = {
  rounds: BracketRoundPlan[];
  matches: BracketMatchPlan[];
  /** Fase de disputa de terceiro lugar, quando habilitada. */
  thirdPlace: BracketMatchPlan | null;
  /** Problemas de configuração encontrados. Vazio = chave válida. */
  errors: string[];
};

/** Nomes contados de trás para frente a partir da final. */
const ROUND_NAMES_FROM_FINAL = [
  { name: 'Final', slug: 'final' },
  { name: 'Semifinal', slug: 'semifinal' },
  { name: 'Quartas de final', slug: 'quartas-de-final' },
  { name: 'Oitavas de final', slug: 'oitavas-de-final' },
  { name: 'Dezesseis avos', slug: 'dezesseis-avos' },
  { name: 'Trinta e dois avos', slug: 'trinta-e-dois-avos' },
];

function roundName(indexFromEnd: number): { name: string; slug: string } {
  return (
    ROUND_NAMES_FROM_FINAL[indexFromEnd] ?? {
      name: `Fase ${indexFromEnd + 1}`,
      slug: `fase-${indexFromEnd + 1}`,
    }
  );
}

/**
 * Emparelha uma lista de vagas: primeira com última, segunda com penúltima.
 * É essa regra que faz o melhor colocado enfrentar o pior sobrevivente em
 * todas as fases, e ela vale igual para 4, 6, 8 ou 16 clubes.
 */
function pair(sources: BracketSource[]): [BracketSource, BracketSource][] {
  const out: [BracketSource, BracketSource][] = [];
  for (let i = 0; i < sources.length / 2; i += 1) {
    out.push([sources[i], sources[sources.length - 1 - i]]);
  }
  return out;
}

/**
 * Monta o plano do chaveamento. Nunca lança: uma configuração impossível
 * devolve `errors` preenchido para o painel mostrar a mensagem ao admin.
 */
export function planBracket(config: KnockoutConfig): BracketPlan {
  const errors: string[] = [];
  const { qualifiers, byes, legs, thirdPlace } = config;

  if (qualifiers < 2) {
    errors.push('O mata-mata precisa de pelo menos 2 clubes classificados.');
    return { rounds: [], matches: [], thirdPlace: null, errors };
  }
  if (byes >= qualifiers) {
    errors.push(`Byes (${byes}) não pode ser maior ou igual ao número de classificados (${qualifiers}).`);
    return { rounds: [], matches: [], thirdPlace: null, errors };
  }

  const firstRoundTeams = qualifiers - byes;
  if (firstRoundTeams % 2 !== 0) {
    errors.push(
      `Com ${qualifiers} classificados e ${byes} bye(s), sobram ${firstRoundTeams} clubes para a primeira fase — um número ímpar não forma confrontos. Ajuste os byes.`,
    );
    return { rounds: [], matches: [], thirdPlace: null, errors };
  }

  const firstRoundMatches = firstRoundTeams / 2;
  const secondRoundTeams = byes + firstRoundMatches;

  // A partir da segunda fase o chaveamento tem que halvar até chegar em 1.
  if (secondRoundTeams > 1 && (secondRoundTeams & (secondRoundTeams - 1)) !== 0) {
    errors.push(
      `Depois da primeira fase sobrariam ${secondRoundTeams} clubes, que não é potência de 2 e não forma uma chave completa. Ajuste classificados ou byes (ex.: 6 classificados com 2 byes, ou 8 sem byes).`,
    );
    return { rounds: [], matches: [], thirdPlace: null, errors };
  }

  // ── Quantidade de confrontos por fase ──
  const matchesPerRound: number[] = [firstRoundMatches];
  let remaining = secondRoundTeams;
  while (remaining > 1) {
    matchesPerRound.push(remaining / 2);
    remaining /= 2;
  }

  const totalRounds = matchesPerRound.length;

  const rounds: BracketRoundPlan[] = matchesPerRound.map((count, index) => {
    const naming = roundName(totalRounds - 1 - index);
    return {
      index,
      name: naming.name,
      slug: naming.slug,
      matches: count,
      // A final costuma ser em jogo único mesmo quando as fases anteriores
      // têm ida e volta; isso fica explícito aqui em vez de escondido.
      legs,
    };
  });

  // ── Confrontos ──
  const matches: BracketMatchPlan[] = [];

  // Primeira fase: os clubes que não têm bye, do melhor contra o pior.
  const firstRoundSeeds: BracketSource[] = [];
  for (let seed = byes + 1; seed <= qualifiers; seed += 1) {
    firstRoundSeeds.push({ kind: 'SEED', seed });
  }
  pair(firstRoundSeeds).forEach(([home, away], index) => {
    matches.push({ round: 0, index, home, away });
  });

  // Segunda fase: os byes entram primeiro na lista, seguidos dos vencedores.
  // Com o emparelhamento primeiro-com-último, o 1º colocado cai contra o
  // vencedor do confronto entre os piores classificados.
  if (totalRounds > 1) {
    const secondRoundSources: BracketSource[] = [];
    for (let seed = 1; seed <= byes; seed += 1) {
      secondRoundSources.push({ kind: 'SEED', seed });
    }
    for (let index = 0; index < firstRoundMatches; index += 1) {
      secondRoundSources.push({ kind: 'WINNER', round: 0, match: index });
    }
    pair(secondRoundSources).forEach(([home, away], index) => {
      matches.push({ round: 1, index, home, away });
    });
  }

  // Demais fases: só vencedores.
  for (let round = 2; round < totalRounds; round += 1) {
    const sources: BracketSource[] = [];
    for (let index = 0; index < matchesPerRound[round - 1]; index += 1) {
      sources.push({ kind: 'WINNER', round: round - 1, match: index });
    }
    pair(sources).forEach(([home, away], index) => {
      matches.push({ round, index, home, away });
    });
  }

  // ── Disputa de terceiro lugar ──
  let third: BracketMatchPlan | null = null;
  if (thirdPlace && totalRounds >= 2) {
    const semifinalRound = totalRounds - 2;
    if (matchesPerRound[semifinalRound] === 2) {
      third = {
        round: totalRounds - 1,
        index: 1,
        home: { kind: 'WINNER', round: semifinalRound, match: 0 },
        away: { kind: 'WINNER', round: semifinalRound, match: 1 },
      };
    } else {
      errors.push('A disputa de terceiro lugar exige uma semifinal com exatamente 2 confrontos.');
    }
  }

  return { rounds, matches, thirdPlace: third, errors };
}

/**
 * Emparelhamento cruzado entre grupos: 1º do A × 2º do B, 1º do B × 2º do A.
 * Usado quando a competição continental tem fase de grupos.
 */
export function crossGroupPairs(
  qualifiedByGroup: Map<string, string[]>,
): [string, string][] {
  const groups = [...qualifiedByGroup.keys()].sort();
  const pairs: [string, string][] = [];

  for (let i = 0; i < groups.length; i += 2) {
    const a = qualifiedByGroup.get(groups[i]) ?? [];
    const b = qualifiedByGroup.get(groups[i + 1]) ?? [];
    const depth = Math.min(a.length, b.length);
    for (let rank = 0; rank < depth; rank += 1) {
      // 1º de A contra o último classificado de B, e vice-versa.
      pairs.push([a[rank], b[depth - 1 - rank]]);
    }
  }

  return pairs;
}

/** Embaralhamento determinístico a partir de uma semente (sorteio reproduzível). */
export function seededShuffle<T>(items: T[], seed: number): T[] {
  const out = [...items];
  let state = seed || 1;
  const next = () => {
    // xorshift32 — suficiente para sorteio de chaveamento e reproduzível,
    // o que permite auditar o sorteio depois.
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return Math.abs(state) / 2 ** 31;
  };
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(next() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Gera as rodadas de um turno de pontos corridos (algoritmo do círculo).
 * Com número ímpar de clubes, um deles folga a cada rodada.
 */
export function roundRobin(
  clubIds: string[],
  rounds: number,
): { matchday: number; home: string; away: string }[] {
  const BYE = '__BYE__';
  const teams = [...clubIds];
  if (teams.length < 2) return [];
  if (teams.length % 2 !== 0) teams.push(BYE);

  const n = teams.length;
  const fixtures: { matchday: number; home: string; away: string }[] = [];
  let matchday = 1;

  for (let round = 0; round < rounds; round += 1) {
    // Método do círculo: o primeiro clube fica fixo e os demais giram.
    let arr = [...teams];

    for (let r = 0; r < n - 1; r += 1) {
      for (let i = 0; i < n / 2; i += 1) {
        const a = arr[i];
        const b = arr[n - 1 - i];
        if (a === BYE || b === BYE) continue;

        // Alterna o mando de campo entre confrontos da mesma rodada e entre
        // turnos, para que o returno seja de fato o returno.
        const swap = (round + i) % 2 === 1;
        fixtures.push({ matchday, home: swap ? b : a, away: swap ? a : b });
      }

      arr = [arr[0], arr[n - 1], ...arr.slice(1, n - 1)];
      matchday += 1;
    }
  }

  return fixtures;
}
