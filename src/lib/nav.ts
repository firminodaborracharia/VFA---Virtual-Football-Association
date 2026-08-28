/**
 * Navegação do site — item 25 do escopo.
 * Fonte única para navbar, menu mobile e rodapé.
 */

import {
  BarChart3,
  CalendarDays,
  Globe2,
  Home,
  Newspaper,
  Settings,
  Star,
  Table2,
  Trophy,
  Users,
  type LucideIcon,
} from 'lucide-react';

import type { Dictionary } from '@/lib/i18n/dictionaries';

export type NavItem = {
  href: string;
  /** Chave no dicionário (`dict.nav[key]`), não o texto em si. */
  key: keyof Dictionary['nav'];
  icon: LucideIcon;
  /** Só aparece para administradores. */
  adminOnly?: boolean;
};

/**
 * O menu guarda CHAVES, não textos.
 *
 * Com o rótulo escrito aqui, traduzir o site exigiria uma lista de menu por
 * idioma — três listas para manter em sincronia, e a certeza de que uma delas
 * ficaria para trás. Guardando a chave, o texto sai do dicionário no momento
 * de desenhar, e acrescentar um idioma não toca neste arquivo.
 */
export const NAV_ITEMS: NavItem[] = [
  { href: '/', key: 'home', icon: Home },
  { href: '/jogadores', key: 'players', icon: Users },
  { href: '/clubes', key: 'clubs', icon: Trophy },
  { href: '/classificacao', key: 'standings', icon: Table2 },
  { href: '/partidas', key: 'matches', icon: CalendarDays },
  { href: '/competicoes', key: 'competitions', icon: Globe2 },
  { href: '/destaques', key: 'highlights', icon: Star },
  { href: '/noticias', key: 'news', icon: Newspaper },
  { href: '/estatisticas', key: 'stats', icon: BarChart3 },
  { href: '/admin', key: 'admin', icon: Settings, adminOnly: true },
];

/** A rota atual corresponde a este item de menu? */
export function isActivePath(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

export const ADMIN_NAV: { href: string; label: string; icon: LucideIcon }[] = [
  { href: '/admin', label: 'Visão geral', icon: BarChart3 },
  { href: '/admin/jogadores', label: 'Jogadores', icon: Users },
  { href: '/admin/clubes', label: 'Clubes', icon: Trophy },
  { href: '/admin/partidas', label: 'Partidas', icon: CalendarDays },
  { href: '/admin/competicoes', label: 'Competições', icon: Globe2 },
  { href: '/admin/temporadas', label: 'Temporadas', icon: CalendarDays },
  { href: '/admin/noticias', label: 'Notícias', icon: Newspaper },
  { href: '/admin/usuarios', label: 'Usuários', icon: Users },
  { href: '/admin/configuracoes', label: 'Configurações', icon: Settings },
];
