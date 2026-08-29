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

export const POSITION_LABELS = {
  GOALKEEPER: 'Goleiro',
  DEFENDER: 'Zagueiro',
  DEFENSIVE_MIDFIELDER: 'Meio-campo defensivo',
  MIDFIELDER: 'Meio-campo',
  ATTACKING_MIDFIELDER: 'Meio-campo ofensivo',
  FORWARD: 'Atacante',
} as const;

/**
 * Siglas para as etiquetas dos cards, onde não cabe o nome inteiro.
 *
 * VOL e MEA seguem o uso brasileiro de transmissão: volante para o meio-campo
 * defensivo e meia-atacante para o ofensivo. "MED" e "MEO" seriam derivações
 * literais do nome do enum e não significariam nada para quem lê.
 */
export const POSITION_SHORT = {
  GOALKEEPER: 'GOL',
  DEFENDER: 'ZAG',
  DEFENSIVE_MIDFIELDER: 'VOL',
  MIDFIELDER: 'MEI',
  ATTACKING_MIDFIELDER: 'MEA',
  FORWARD: 'ATA',
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

/** Escudo da VFA empacotado com o projeto (public/vfa-logo.webp). */
export const DEFAULT_CREST = '/vfa-logo.webp';
