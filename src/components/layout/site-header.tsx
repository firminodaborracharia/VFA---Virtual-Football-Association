'use client';

import { LogIn, Menu, Search, ShieldCheck, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

import dynamic from 'next/dynamic';

/**
 * A busca entra sob demanda.
 *
 * O diálogo de busca só existe depois de alguém clicar na lupa ou apertar
 * ⌘K, mas o import estático o colocava — e a biblioteca de animação que ele
 * usa — no pacote da primeira página. Carregar sob demanda tira esse peso de
 * todo visitante e o cobra apenas de quem realmente busca.
 */
const GlobalSearch = dynamic(
  () => import('@/components/layout/global-search').then((mod) => mod.GlobalSearch),
  { ssr: false },
);
import { LocaleSwitcher } from '@/components/layout/locale-switcher';
import { UserMenu } from '@/components/layout/user-menu';
import type { Dictionary, Locale } from '@/lib/i18n/dictionaries';
import { isActivePath, NAV_ITEMS } from '@/lib/nav';
import { cn, DEFAULT_CREST } from '@/lib/utils';

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
  dict,
  locale,
}: {
  user: HeaderUser;
  siteName: string;
  logoUrl: string | null;
  dict: Dictionary;
  locale: Locale;
}) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  const items = NAV_ITEMS.filter((item) => !item.adminOnly || user?.role === 'ADMIN');

  /**
   * O escudo da VFA vem junto do projeto (`public/vfa-logo.webp`), então ele é
   * o padrão — não o desenho genérico de sigla.
   *
   * A configuração do banco continua ganhando: quem trocar a arte pelo painel
   * vê a nova imagem. Este `??` só cobre o caso de o campo nunca ter sido
   * preenchido, que é a situação de qualquer instalação recém-criada.
   */
  const crest = logoUrl ?? DEFAULT_CREST;

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
          // Vidro nos dois estados. A diferença é o quanto ele fecha: no topo
          // da página quase não há o que esconder, e depois da rolagem o
          // conteúdo passa por baixo e precisa de mais desfoque.
          scrolled
            ? 'border-line bg-bg/55 shadow-card backdrop-blur-2xl backdrop-saturate-150'
            : 'border-transparent bg-bg/20 backdrop-blur-md backdrop-saturate-150',
        )}
      >
        {/* Fio de acento no topo absoluto da página. Detalhe pequeno, mas é o
            que faz a barra ler como cabeçalho de emissora esportiva em vez de
            barra de aplicativo. */}
        <div
          className="h-[3px] bg-gradient-to-r from-accent via-accent-alt to-accent"
          aria-hidden
        />

        <div className="container-vfa flex h-16 items-center gap-3">
          <Link href="/" className="flex shrink-0 items-center gap-3" aria-label={siteName}>
            {crest ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={crest} alt={siteName} className="size-10 object-contain" />
            ) : (
              /* Escudo: canto cortado na diagonal e sigla inclinada. */
              <span
                className="flex size-9 items-center justify-center bg-gradient-to-br from-accent to-accent-alt text-[0.8rem] text-black"
                style={{ clipPath: 'polygon(0 0, 100% 0, 100% 72%, 50% 100%, 0 72%)' }}
              >
                <span className="scoreboard -translate-y-px skew-x-[-8deg]">
                  {siteName.slice(0, 3).toUpperCase()}
                </span>
              </span>
            )}
            <span className="display-vfa hidden text-lg sm:block">{siteName}</span>
          </Link>

          {/*
            `min-w-0` + `overflow-hidden` é obrigatório aqui: são dez itens em
            caixa alta, e sem isso o menu empurra a busca e o botão de entrar
            para fora da barra em telas de 1440px. Com o limite, o menu cede
            espaço em vez de atropelar o que está à direita.
          */}
          <nav className="ml-3 hidden min-w-0 flex-1 items-center gap-0 overflow-hidden xl:flex">
            {items.map((item) => {
              const active = isActivePath(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    /* Caixa alta, peso alto e entre-letras aberto: é assim que
                       menu de site de campeonato se lê, e é o que mais afasta
                       do visual de painel. */
                    'relative shrink-0 px-2.5 py-2 text-[0.68rem] font-extrabold tracking-[0.09em] whitespace-nowrap uppercase transition-colors 2xl:px-3 2xl:tracking-[0.13em]',
                    active ? 'text-fg' : 'text-muted hover:text-fg',
                    item.adminOnly && 'text-accent-warm hover:text-accent-warm',
                  )}
                >
                  <span className="flex items-center gap-1.5">
                    {item.adminOnly ? <ShieldCheck className="size-3.5" /> : null}
                    {dict.nav[item.key]}
                  </span>
                  {/*
                    Barra grossa e reta, em CSS.

                    Antes era um `layoutId` do framer-motion, que desliza a
                    barra de um item para o outro. O efeito é bonito e custava
                    a biblioteca inteira no pacote de toda página — inclusive
                    para quem abre o site no celular e nunca vê a barra, porque
                    o menu some abaixo de 1280 pixels.
                  */}
                  <span
                    className={cn(
                      'absolute inset-x-2 -bottom-[9px] h-[3px] origin-left bg-accent transition-transform duration-300 ease-out',
                      active ? 'scale-x-100' : 'scale-x-0',
                    )}
                    aria-hidden
                  />
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="flex h-9 items-center gap-2 rounded-sm border border-line-strong bg-surface-2 px-2.5 text-sm text-subtle transition-colors hover:border-accent/40 hover:text-fg"
              aria-label={dict.nav.searchSite}
            >
              <Search className="size-4" />
              {/* Só a partir de 2xl: entre xl e 2xl o menu já ocupa a barra
                  inteira, e o rótulo aqui era o que empurrava tudo. */}
              <span className="hidden 2xl:inline">{dict.nav.search}</span>
              <kbd className="hidden rounded-sm border border-line px-1 font-mono text-[0.65rem] 2xl:inline">
                ⌘K
              </kbd>
            </button>

            <LocaleSwitcher current={locale} label={dict.nav.language} />

            {user ? (
              <UserMenu user={user} />
            ) : (
              <Link
                href="/entrar"
                className="flex h-9 items-center gap-2 rounded-sm bg-accent px-3.5 text-xs font-extrabold tracking-widest text-black uppercase transition-all hover:brightness-110"
              >
                <LogIn className="size-4" />
                <span className="hidden sm:inline">{dict.nav.signIn}</span>
              </Link>
            )}

            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              className="flex size-9 items-center justify-center rounded-lg border border-line-strong text-muted transition-colors hover:text-fg xl:hidden"
              aria-label={dict.nav.openMenu}
            >
              <Menu className="size-4.5" />
            </button>
          </div>
        </div>
      </header>

      {/*
        ── Menu mobile ──

        Fica SEMPRE no DOM, escondido por `translate-x-full` e
        `pointer-events-none`, em vez de ser montado e desmontado.

        Assim a gaveta desliza para dentro E para fora só com CSS. Era esse o
        motivo de o `AnimatePresence` existir aqui: manter o elemento vivo o
        suficiente para animar a saída. Trocar por visibilidade custa um punhado
        de nós invisíveis no HTML e devolve os ~130 KB da biblioteca de animação
        — que pesavam justamente no aparelho onde este menu é usado, o celular.

        `inert` desliga a gaveta fechada por completo: nada dentro dela recebe
        foco pelo Tab nem é anunciado por leitor de tela.
      */}
      <div
        className={cn(
          'fixed inset-0 z-[70] xl:hidden',
          menuOpen ? 'visible' : 'invisible',
        )}
        inert={!menuOpen}
      >
        <div
          className={cn(
            'absolute inset-0 bg-black/70 backdrop-blur-sm transition-opacity duration-200',
            menuOpen ? 'opacity-100' : 'pointer-events-none opacity-0',
          )}
          onClick={() => setMenuOpen(false)}
        />
        <aside
          className={cn(
            'absolute inset-y-0 right-0 flex w-[min(20rem,85vw)] flex-col border-l border-line bg-bg-elevated',
            'transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]',
            menuOpen ? 'translate-x-0' : 'translate-x-full',
          )}
        >
              <div className="flex h-16 items-center justify-between border-b border-line px-4">
                <span className="text-sm font-bold tracking-widest text-muted uppercase">{dict.nav.menu}</span>
                <button
                  type="button"
                  onClick={() => setMenuOpen(false)}
                  className="rounded-lg p-2 text-muted transition-colors hover:bg-surface-2 hover:text-fg"
                  aria-label={dict.nav.closeMenu}
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
                      {dict.nav[item.key]}
                    </Link>
                  );
                })}
              </nav>
        </aside>
      </div>

      {/*
        Monta só quando abre — e isso é metade do ganho, não um detalhe.

        `dynamic()` separa o código num arquivo à parte, mas renderizar o
        componente fechado ainda obriga o navegador a buscar esse arquivo. Era
        o que mantinha os ~140 KB da busca e da biblioteca de animação no
        primeiro carregamento de toda página. Com a montagem condicional, esse
        peso passa a ser cobrado de quem realmente abre a busca.
      */}
      {searchOpen ? <GlobalSearch open onClose={() => setSearchOpen(false)} /> : null}
    </>
  );
}
