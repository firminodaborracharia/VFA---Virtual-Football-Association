import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Gera um slug seguro para URL a partir de qualquer texto. */
export function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove acentos
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

/** Slug único: acrescenta sufixo numérico enquanto o slug já existir. */
export function uniqueSlug(base: string, taken: Set<string>): string {
  const slug = slugify(base) || 'item';
  if (!taken.has(slug)) return slug;
  let n = 2;
  while (taken.has(`${slug}-${n}`)) n += 1;
  return `${slug}-${n}`;
}

/** Aproveitamento em % — pontos conquistados sobre pontos disputados. */
export function efficiency(points: number, played: number, pointsPerWin = 3): number {
  if (played <= 0) return 0;
  return Math.round((points / (played * pointsPerWin)) * 1000) / 10;
}

export function goalDifference(goalsFor: number, goalsAgainst: number): number {
  return goalsFor - goalsAgainst;
}

/** "+4", "-2", "0" — como aparece na tabela do Brasileirão. */
export function formatDiff(value: number): string {
  if (value > 0) return `+${value}`;
  return String(value);
}

export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return '—';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(d);
}

export function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return '—';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

export function formatTime(date: Date | string | null | undefined): string {
  if (!date) return '—';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(d);
}

export function formatLongDate(date: Date | string | null | undefined): string {
  if (!date) return '—';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(d);
}

/** "há 3 dias", "em 2 horas". */
export function relativeTime(date: Date | string | null | undefined): string {
  if (!date) return '—';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return '—';

  const diff = d.getTime() - Date.now();
  const abs = Math.abs(diff);
  const rtf = new Intl.RelativeTimeFormat('pt-BR', { numeric: 'auto' });

  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ['year', 365 * 24 * 60 * 60 * 1000],
    ['month', 30 * 24 * 60 * 60 * 1000],
    ['day', 24 * 60 * 60 * 1000],
    ['hour', 60 * 60 * 1000],
    ['minute', 60 * 1000],
  ];

  for (const [unit, ms] of units) {
    if (abs >= ms) return rtf.format(Math.round(diff / ms), unit);
  }
  return 'agora';
}

/**
 * Ordem de exibição das posições: do ataque para o gol.
 *
 * Esta constante existe porque a ordem no menu NÃO precisa ser a ordem do
 * enum no banco. Mudar o enum exigiria recriar o tipo no PostgreSQL; mudar
 * esta lista é editar uma linha. Toda lista de posições do site passa por
 * aqui.
 */
export const POSITION_ORDER = [
  'FORWARD',
  'MIDFIELDER',
  'ATTACKING_MIDFIELDER',
  'DEFENSIVE_MIDFIELDER',
  'DEFENDER',
  'GOALKEEPER',
] as const;

export const POSITION_LABELS = {
  FORWARD: 'Atacante',
  MIDFIELDER: 'Meio-campo',
  ATTACKING_MIDFIELDER: 'Meio-campo ofensivo',
  DEFENSIVE_MIDFIELDER: 'Meio-campo defensivo',
  DEFENDER: 'Zagueiro',
  GOALKEEPER: 'Goleiro',
} as const;

/**
 * Siglas para as etiquetas dos cards, onde não cabe o nome inteiro.
 *
 * Derivadas dos nomes acima, não de jargão de transmissão. Eu havia usado VOL
 * e MEA — volante e meia-atacante —, que são o uso corrente no Brasil mas não
 * correspondem ao que está escrito no resto do site. Se a posição se chama
 * "Meio-campo ofensivo", a sigla precisa ser MEO: quem lê a etiqueta tem de
 * conseguir ligá-la ao nome sem traduzir nada.
 */
export const POSITION_SHORT = {
  FORWARD: 'ATA',
  MIDFIELDER: 'MEI',
  ATTACKING_MIDFIELDER: 'MEO',
  DEFENSIVE_MIDFIELDER: 'MED',
  DEFENDER: 'ZAG',
  GOALKEEPER: 'GOL',
} as const;

export const MATCH_STATUS_LABELS = {
  SCHEDULED: 'Agendada',
  LIVE: 'Ao vivo',
  FINISHED: 'Encerrada',
  POSTPONED: 'Adiada',
  CANCELLED: 'Cancelada',
} as const;

export const COMPETITION_TYPE_LABELS = {
  LEAGUE: 'Liga',
  LEAGUE_PLAYOFF: 'Mata-mata da liga',
  CONTINENTAL: 'Continental',
  INTERCONTINENTAL: 'Intercontinental',
  CUP: 'Copa',
} as const;

export const TRANSFER_TYPE_LABELS = {
  SIGNING: 'Contratação',
  TRANSFER: 'Transferência',
  LOAN: 'Empréstimo',
  RELEASE: 'Saída',
} as const;

/** Iniciais para o fallback de escudo/avatar quando não há imagem. */
export function initials(name: string, max = 2): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, max)
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('');
}

/** Divide um array em blocos de tamanho fixo. */
export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** Clamp numérico. */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function pluralize(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

/**
 * Escudo da VFA empacotado com o projeto.
 *
 * Duas versões, e a diferença importa: a arte original tem 172 KB e o
 * cabeçalho a desenha com 40 pixels. Baixar 172 KB em toda página, em todo
 * dispositivo, para exibir num quadrado do tamanho de uma unha é desperdício
 * puro — a versão de 96 pixels tem 6 KB e é indistinguível nesse tamanho.
 *
 * `DEFAULT_CREST_FULL` continua disponível para onde o escudo aparece grande.
 */
export const DEFAULT_CREST = '/vfa-logo-96.webp';
export const DEFAULT_CREST_FULL = '/vfa-logo.webp';
