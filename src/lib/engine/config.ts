/**
 * Regras de competição — item 34 do escopo.
 *
 * NADA aqui é fixo no código das páginas. Cada competição guarda o seu próprio
 * `config` (JSONB) no banco, e o administrador altera tudo pelo painel:
 * pontuação, critérios de desempate, número de classificados, formato do
 * mata-mata, byes, ida e volta, fase de grupos.
 *
 * Este módulo define o formato, valida com Zod e fornece os valores padrão.
 * Um `config` inválido ou incompleto no banco não derruba o site: `parseConfig`
 * preenche os buracos com o padrão.
 */

import { z } from 'zod';

/* ── Critérios de desempate ───────────────────────────────────
   A ordem do array define a precedência. O administrador pode reordenar,
   remover ou acrescentar critérios sem tocar no código.               */

export const TIEBREAKERS = [
  'POINTS',
  'WINS',
  'GOAL_DIFFERENCE',
  'GOALS_FOR',
  'GOALS_AGAINST',
  'HEAD_TO_HEAD',
  'FEWEST_RED_CARDS',
  'FEWEST_YELLOW_CARDS',
  'ALPHABETICAL',
] as const;

export type Tiebreaker = (typeof TIEBREAKERS)[number];

export const TIEBREAKER_LABELS: Record<Tiebreaker, string> = {
  POINTS: 'Pontos',
  WINS: 'Número de vitórias',
  GOAL_DIFFERENCE: 'Saldo de gols',
  GOALS_FOR: 'Gols marcados',
  GOALS_AGAINST: 'Gols sofridos (menos é melhor)',
  HEAD_TO_HEAD: 'Confronto direto',
  FEWEST_RED_CARDS: 'Menos cartões vermelhos',
  FEWEST_YELLOW_CARDS: 'Menos cartões amarelos',
  ALPHABETICAL: 'Ordem alfabética',
};

/* ── Desempate de confronto eliminatório ─────────────────────── */

export const KNOCKOUT_TIEBREAKS = ['PENALTIES', 'AWAY_GOALS', 'HIGHER_SEED'] as const;
export type KnockoutTiebreak = (typeof KNOCKOUT_TIEBREAKS)[number];

export const KNOCKOUT_TIEBREAK_LABELS: Record<KnockoutTiebreak, string> = {
  PENALTIES: 'Disputa de pênaltis',
  AWAY_GOALS: 'Gol fora de casa',
  HIGHER_SEED: 'Melhor colocado na fase anterior',
};

/* ── Semeadura do chaveamento ─────────────────────────────────── */

export const SEEDING_RULES = ['TABLE_POSITION', 'SNAKE_CROSS', 'RANDOM'] as const;
export type SeedingRule = (typeof SEEDING_RULES)[number];

export const SEEDING_RULE_LABELS: Record<SeedingRule, string> = {
  TABLE_POSITION: 'Melhor contra pior (1º × último)',
  SNAKE_CROSS: 'Cruzado entre grupos (1ºA × 2ºB)',
  RANDOM: 'Sorteio aleatório',
};

/* ── Schemas ──────────────────────────────────────────────────── */

export const groupStageSchema = z.object({
  enabled: z.boolean().default(false),
  /** Quantidade de grupos. */
  groups: z.number().int().min(1).max(16).default(2),
  /** Quantos clubes se classificam por grupo para o mata-mata. */
  advancePerGroup: z.number().int().min(1).max(16).default(2),
  /** 1 = turno único, 2 = turno e returno dentro do grupo. */
  rounds: z.number().int().min(1).max(4).default(1),
});

export const knockoutSchema = z.object({
  enabled: z.boolean().default(false),
  /**
   * Quantos clubes entram no mata-mata. Com 6 clubes e 2 byes, o chaveamento
   * fica: 3º×6º e 4º×5º nas quartas; 1º e 2º entram direto na semifinal.
   */
  qualifiers: z.number().int().min(2).max(64).default(4),
  /** Clubes mais bem colocados que pulam a primeira fase eliminatória. */
  byes: z.number().int().min(0).max(32).default(0),
  /** 1 = jogo único, 2 = ida e volta. */
  legs: z.number().int().min(1).max(2).default(1),
  /** Disputa de terceiro lugar. */
  thirdPlace: z.boolean().default(false),
  seeding: z.enum(SEEDING_RULES).default('TABLE_POSITION'),
  tiebreak: z.enum(KNOCKOUT_TIEBREAKS).default('PENALTIES'),
});

export const competitionConfigSchema = z.object({
  /** Pontuação. Configurável porque nem toda competição usa 3-1-0. */
  points: z
    .object({
      win: z.number().int().default(3),
      draw: z.number().int().default(1),
      loss: z.number().int().default(0),
    })
    .default({ win: 3, draw: 1, loss: 0 }),

  /** Ordem de precedência dos critérios de desempate da tabela. */
  tiebreakers: z
    .array(z.enum(TIEBREAKERS))
    .min(1)
    .default(['POINTS', 'WINS', 'GOAL_DIFFERENCE', 'GOALS_FOR', 'HEAD_TO_HEAD', 'ALPHABETICAL']),

  /** Turnos na fase de pontos corridos. 2 = todos contra todos, ida e volta. */
  rounds: z.number().int().min(1).max(4).default(2),

  /** Número de clubes esperado. Usado para validação e para os geradores. */
  teamCount: z.number().int().min(2).max(64).default(6),

  groupStage: groupStageSchema.default({
    enabled: false,
    groups: 2,
    advancePerGroup: 2,
    rounds: 1,
  }),

  knockout: knockoutSchema.default({
    enabled: false,
    qualifiers: 4,
    byes: 0,
    legs: 1,
    thirdPlace: false,
    seeding: 'TABLE_POSITION',
    tiebreak: 'PENALTIES',
  }),

  /** Exibe a coluna de aproveitamento (%) na tabela. */
  showEfficiency: z.boolean().default(true),
});

export type CompetitionConfig = z.infer<typeof competitionConfigSchema>;
export type KnockoutConfig = z.infer<typeof knockoutSchema>;
export type GroupStageConfig = z.infer<typeof groupStageSchema>;

/**
 * Lê um `config` vindo do banco. Nunca lança: valores inválidos caem no padrão,
 * porque uma competição com config corrompido não pode derrubar o site inteiro.
 */
export function parseConfig(raw: unknown): CompetitionConfig {
  const result = competitionConfigSchema.safeParse(raw ?? {});
  if (result.success) return result.data;
  return competitionConfigSchema.parse({});
}

export const DEFAULT_COMPETITION_CONFIG: CompetitionConfig = competitionConfigSchema.parse({});

/** Padrão de uma liga nacional da VFA: 6 clubes, turno e returno, playoff de 6. */
export const LEAGUE_PRESET: CompetitionConfig = competitionConfigSchema.parse({
  teamCount: 6,
  rounds: 2,
  knockout: { enabled: false },
});

/** Playoff da liga: 6 clubes, 1º e 2º com bye direto para a semifinal. */
export const LEAGUE_PLAYOFF_PRESET: CompetitionConfig = competitionConfigSchema.parse({
  teamCount: 6,
  rounds: 1,
  knockout: {
    enabled: true,
    qualifiers: 6,
    byes: 2,
    legs: 1,
    thirdPlace: false,
    seeding: 'TABLE_POSITION',
    tiebreak: 'PENALTIES',
  },
});

/**
 * Continental (Libertadores / Champions): 8 clubes em mata-mata direto —
 * quartas, semifinal e final, exatamente as fases pedidas no escopo.
 *
 * A fase de grupos vem desligada de propósito: com 8 clubes em 2 grupos de 4 e
 * quartas de final logo depois, os 8 se classificariam e a fase de grupos não
 * eliminaria ninguém. Se a VFA quiser grupos no futuro, basta habilitar
 * `groupStage` e reduzir `knockout.qualifiers` para 4 pelo painel.
 */
export const CONTINENTAL_PRESET: CompetitionConfig = competitionConfigSchema.parse({
  teamCount: 8,
  rounds: 1,
  groupStage: { enabled: false, groups: 2, advancePerGroup: 2, rounds: 1 },
  knockout: {
    enabled: true,
    qualifiers: 8,
    byes: 0,
    legs: 1,
    thirdPlace: false,
    seeding: 'TABLE_POSITION',
    tiebreak: 'PENALTIES',
  },
});

/** Alternativa: continental com fase de grupos de verdade (2 grupos, 2 avançam). */
export const CONTINENTAL_GROUPS_PRESET: CompetitionConfig = competitionConfigSchema.parse({
  teamCount: 8,
  rounds: 1,
  groupStage: { enabled: true, groups: 2, advancePerGroup: 2, rounds: 1 },
  knockout: {
    enabled: true,
    qualifiers: 4,
    byes: 0,
    legs: 1,
    thirdPlace: false,
    seeding: 'SNAKE_CROSS',
    tiebreak: 'PENALTIES',
  },
});

/** Intercontinental: jogo único entre os dois campeões continentais. */
export const INTERCONTINENTAL_PRESET: CompetitionConfig = competitionConfigSchema.parse({
  teamCount: 2,
  rounds: 1,
  knockout: {
    enabled: true,
    qualifiers: 2,
    byes: 0,
    legs: 1,
    thirdPlace: false,
    seeding: 'TABLE_POSITION',
    tiebreak: 'PENALTIES',
  },
});

export const CONFIG_PRESETS = {
  LEAGUE: LEAGUE_PRESET,
  LEAGUE_PLAYOFF: LEAGUE_PLAYOFF_PRESET,
  CONTINENTAL: CONTINENTAL_PRESET,
  INTERCONTINENTAL: INTERCONTINENTAL_PRESET,
  CUP: DEFAULT_COMPETITION_CONFIG,
} as const;
