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

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Só aparece para administradores. */
  adminOnly?: boolean;
};

export const NAV_ITEMS: NavItem[] = [
  { href: '/', label: 'Início', icon: Home },
  { href: '/jogadores', label: 'Jogadores', icon: Users },
  { href: '/clubes', label: 'Clubes', icon: Trophy },
  { href: '/classificacao', label: 'Classificação', icon: Table2 },
  { href: '/partidas', label: 'Partidas', icon: CalendarDays },
  { href: '/competicoes', label: 'Competições', icon: Globe2 },
  { href: '/destaques', label: 'Destaques', icon: Star },
  { href: '/noticias', label: 'Notícias', icon: Newspaper },
  { href: '/estatisticas', label: 'Estatísticas', icon: BarChart3 },
  { href: '/admin', label: 'Administração', icon: Settings, adminOnly: true },
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
