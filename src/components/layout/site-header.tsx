'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { LogIn, Menu, Search, ShieldCheck, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

import { GlobalSearch } from '@/components/layout/global-search';
import { UserMenu } from '@/components/layout/user-menu';
import { isActivePath, NAV_ITEMS } from '@/lib/nav';
import { cn } from '@/lib/utils';

export type HeaderUser = {
  name: string | null;
  image: string | null;
  role: 'USER' | 'ADMIN';
  discordUsername: string | null;
} | null;

export function SiteHeader({
  user,
  siteName,
  logoUrl,
}: {
  user: HeaderUser;
  siteName: string;
  logoUrl: string | null;
}) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  const items = NAV_ITEMS.filter((item) => !item.adminOnly || user?.role === 'ADMIN');

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Atalho global de busca.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [menuOpen]);

  return (
    <>
      <header
        className={cn(
          'sticky top-0 z-50 border-b transition-all duration-300',
          scrolled
            ? 'border-line bg-bg/85 shadow-card backdrop-blur-xl'
            : 'border-transparent bg-bg/40 backdrop-blur-sm',
        )}
      >
        <div className="container-vfa flex h-16 items-center gap-3">
          <Link href="/" className="flex shrink-0 items-center gap-2.5" aria-label={siteName}>
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt={siteName} className="size-9 rounded-lg object-contain" />
            ) : (
              <span className="flex size-9 items-center justify-center rounded-lg bg-gradient-to-br from-accent to-accent-alt text-sm font-black text-black">
                {siteName.slice(0, 3).toUpperCase()}
              </span>
            )}
            <span className="hidden text-lg leading-none font-black tracking-tight sm:block">
              {siteName}
            </span>
          </Link>

          <nav className="ml-2 hidden min-w-0 flex-1 items-center gap-0.5 xl:flex">
            {items.map((item) => {
              const active = isActivePath(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'relative rounded-lg px-3 py-2 text-sm font-semibold transition-colors',
                    active ? 'text-accent' : 'text-muted hover:bg-surface-2 hover:text-fg',
                    item.adminOnly && 'text-accent-warm hover:text-accent-warm',
                  )}
                >
                  <span className="flex items-center gap-1.5">
                    {item.adminOnly ? <ShieldCheck className="size-3.5" /> : null}
                    {item.label}
                  </span>
                  {active ? (
                    <motion.span
                      layoutId="nav-underline"
                      className="absolute inset-x-2.5 -bottom-px h-0.5 rounded-full bg-accent"
                      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                    />
                  ) : null}
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="flex h-9 items-center gap-2 rounded-lg border border-line-strong bg-surface-2 px-2.5 text-sm text-subtle transition-colors hover:border-accent/40 hover:text-fg"
              aria-label="Buscar no site"
            >
              <Search className="size-4" />
              <span className="hidden lg:inline">Buscar</span>
              <kbd className="hidden rounded border border-line px-1 font-mono text-[0.65rem] lg:inline">
                ⌘K
              </kbd>
            </button>

            {user ? (
              <UserMenu user={user} />
            ) : (
              <Link
                href="/entrar"
                className="flex h-9 items-center gap-2 rounded-lg bg-accent px-3 text-sm font-bold text-black transition-all hover:brightness-110"
              >
                <LogIn className="size-4" />
                <span className="hidden sm:inline">Entrar</span>
              </Link>
            )}

            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              className="flex size-9 items-center justify-center rounded-lg border border-line-strong text-muted transition-colors hover:text-fg xl:hidden"
              aria-label="Abrir menu"
            >
              <Menu className="size-4.5" />
            </button>
          </div>
        </div>
      </header>

      {/* ── Menu mobile ── */}
      <AnimatePresence>
        {menuOpen ? (
          <div className="fixed inset-0 z-[70] xl:hidden">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
              onClick={() => setMenuOpen(false)}
            />
            <motion.aside
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="absolute inset-y-0 right-0 flex w-[min(20rem,85vw)] flex-col border-l border-line bg-bg-elevated"
            >
              <div className="flex h-16 items-center justify-between border-b border-line px-4">
                <span className="text-sm font-bold tracking-widest text-muted uppercase">Menu</span>
                <button
                  type="button"
                  onClick={() => setMenuOpen(false)}
                  className="rounded-lg p-2 text-muted transition-colors hover:bg-surface-2 hover:text-fg"
                  aria-label="Fechar menu"
                >
                  <X className="size-4" />
                </button>
              </div>

              <nav className="stagger flex-1 space-y-1 overflow-y-auto p-3">
                {items.map((item) => {
                  const Icon = item.icon;
                  const active = isActivePath(pathname, item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      // Fecha o drawer no clique. Antes isso era um efeito
                      // reagindo à mudança de rota, o que causava uma
                      // renderização extra a cada navegação.
                      onClick={() => setMenuOpen(false)}
                      className={cn(
                        'flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition-colors',
                        active
                          ? 'bg-accent/10 text-accent'
                          : 'text-muted hover:bg-surface-2 hover:text-fg',
                        item.adminOnly && !active && 'text-accent-warm',
                      )}
                    >
                      <Icon className="size-4.5" />
                      {item.label}
                    </Link>
                  );
                })}
              </nav>
            </motion.aside>
          </div>
        ) : null}
      </AnimatePresence>

      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
}
