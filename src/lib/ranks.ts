/**
 * Rank dos jogadores — faixas definidas pela VFA.
 *
 * O overall é digitado pelo administrador no cadastro do jogador; a faixa é
 * DERIVADA dele, nunca guardada. Guardar as duas coisas criaria a chance de
 * ficarem em desacordo: alguém edita o overall de 87 para 84 e o rank continua
 * "Elite S" porque ninguém lembrou de mexer no segundo campo. Derivando, isso
 * é impossível.
 *
 * As faixas têm um buraco proposital entre 78 e 79? Não — 74-78 e 79-81 são
 * contínuas. O que existe é um piso: abaixo de 74 não há faixa definida, e o
 * site mostra "Sem rank" em vez de inventar uma. Se a VFA quiser cobrir esses
 * casos, é acrescentar uma linha em RANKS.
 */

export type Rank = {
  /** Identificador estável, usado em classes de CSS e filtros. */
  id: string;
  /** Nome mostrado na tela. */
  label: string;
  /** Letra ou símbolo do selo. */
  badge: string;
  /** Overall mínimo, inclusivo. */
  min: number;
  /** Overall máximo, inclusivo. `null` = sem teto. */
  max: number | null;
  /** Cor do selo. */
  color: string;
};

/**
 * Da faixa mais alta para a mais baixa.
 *
 * A ordem importa: `rankFor` devolve a PRIMEIRA faixa cujo mínimo o overall
 * alcança. Ordenado assim, um 90 encontra Elite X antes de qualquer outra, e
 * acrescentar uma faixa no meio não exige mexer nas comparações.
 */
export const RANKS: Rank[] = [
  { id: 'elite-x', label: 'Elite X', badge: 'X', min: 88, max: null, color: '#ffd24a' },
  { id: 'elite-s', label: 'Elite S', badge: 'S', min: 86, max: 87, color: '#c9a6ff' },
  { id: 'gold-a', label: 'Gold A', badge: 'A', min: 84, max: 85, color: '#f0b429' },
  { id: 'silver-b', label: 'Silver B', badge: 'B', min: 82, max: 83, color: '#cbd5e1' },
  { id: 'bronze-c', label: 'Bronze C', badge: 'C', min: 79, max: 81, color: '#d98b5f' },
  { id: 'beginner', label: 'Beginner', badge: 'I', min: 74, max: 78, color: '#8fa39c' },
];

/** Menor overall com faixa definida. Abaixo disto, o jogador fica sem rank. */
export const MIN_RANKED_OVERALL = Math.min(...RANKS.map((rank) => rank.min));

/** Limites aceitos no formulário. */
export const OVERALL_MIN = 1;
export const OVERALL_MAX = 99;

/**
 * A faixa de um overall, ou `null` quando não há nota cadastrada ou ela fica
 * abaixo da menor faixa.
 */
export function rankFor(overall: number | null | undefined): Rank | null {
  if (overall === null || overall === undefined) return null;
  return RANKS.find((rank) => overall >= rank.min) ?? null;
}

/** Texto curto para tabelas e listas: "Elite X · 91". */
export function rankSummary(overall: number | null | undefined): string {
  const rank = rankFor(overall);
  if (!rank) return overall ? String(overall) : '—';
  return `${rank.label} · ${overall}`;
}
