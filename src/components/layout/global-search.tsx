'use client';

/**
 * Busca global — item 26 do escopo.
 * Abre com ⌘K/Ctrl+K, consulta /api/search com debounce e navega pelo teclado.
 */

import { AnimatePresence, motion } from 'framer-motion';
import { CalendarDays, Globe2, Loader2, Newspaper, Search, Trophy, Users } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { cn } from '@/lib/utils';

export type SearchResult = {
  type: 'player' | 'club' | 'match' | 'competition' | 'news';
  id: string;
  title: string;
  subtitle: string | null;
  href: string;
  imageUrl: string | null;
};

const GROUP_LABELS: Record<SearchResult['type'], string> = {
  player: 'Jogadores',
  club: 'Clubes',
  match: 'Partidas',
  competition: 'Competições',
  news: 'Notícias',
};

const GROUP_ICONS = {
  player: Users,
  club: Trophy,
  match: CalendarDays,
  competition: Globe2,
  news: Newspaper,
} as const;

const GROUP_ORDER: SearchResult['type'][] = ['player', 'club', 'competition', 'match', 'news'];

/**
 * O diálogo só é montado quando `open` fica verdadeiro.
 *
 * Isso evita ter um efeito que "zera" o estado a cada abertura: montar de novo
 * já começa com os valores iniciais. Um efeito que chama setState de forma
 * síncrona dispara renderizações em cascata e é justamente o que o lint do
 * React aponta.
 */
export function GlobalSearch({ open, onClose }: { open: boolean; onClose: () => void }) {
  return <AnimatePresence>{open ? <SearchDialog onClose={onClose} /> : null}</AnimatePresence>;
}

function SearchDialog({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [cursor, setCursor] = useState(0);

  const term = query.trim();
  const isSearchable = term.length >= 2;

  useEffect(() => {
    if (!isSearchable) return;

    const controller = new AbortController();

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(term)}`, {
          signal: controller.signal,
        });
        const payload = await response.json();
        setResults(payload?.ok ? (payload.data as SearchResult[]) : []);
        setCursor(0);
      } catch (error) {
        if ((error as Error).name !== 'AbortError') setResults([]);
      } finally {
        setLoading(false);
      }
    }, 220);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [term, isSearchable]);

  const grouped = useMemo(() => {
    // Enquanto o termo for curto demais, ignoramos qualquer resultado antigo
    // aqui mesmo, em tempo de renderização — sem precisar limpá-lo com
    // setState dentro de um efeito.
    const source = isSearchable ? results : [];

    const map = new Map<SearchResult['type'], SearchResult[]>();
    for (const item of source) {
      const list = map.get(item.type) ?? [];
      list.push(item);
      map.set(item.type, list);
    }
    return GROUP_ORDER.filter((type) => map.has(type)).map((type) => ({
      type,
      items: map.get(type)!,
    }));
  }, [results, isSearchable]);

  // Ordem achatada, para que as setas percorram os grupos na mesma sequência
  // em que aparecem na tela.
  const flat = useMemo(() => grouped.flatMap((group) => group.items), [grouped]);

  const go = useCallback(
    (result: SearchResult) => {
      onClose();
      router.push(result.href);
    },
    [onClose, router],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') return onClose();
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setCursor((value) => Math.min(value + 1, Math.max(0, flat.length - 1)));
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setCursor((value) => Math.max(value - 1, 0));
      }
      if (event.key === 'Enter' && flat[cursor]) {
        event.preventDefault();
        go(flat[cursor]);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [flat, cursor, go, onClose]);

  let flatIndex = -1;

  return (
    <div className="fixed inset-0 z-[95] flex items-start justify-center p-4 pt-[10vh]">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.16 }}
        className="absolute inset-0 bg-black/75 backdrop-blur-sm"
        onClick={onClose}
      />

      <motion.div
        initial={{ opacity: 0, y: -12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -8, scale: 0.98 }}
        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
        className="relative flex max-h-[70dvh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-pop"
        role="dialog"
        aria-modal="true"
        aria-label="Busca global"
      >
        <div className="flex items-center gap-3 border-b border-line px-4 py-3.5">
          <Search className="size-4.5 shrink-0 text-subtle" />
          <input
            ref={inputRef}
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar jogador, clube, partida, competição ou notícia…"
            className="w-full bg-transparent text-sm text-fg placeholder:text-subtle focus:outline-none"
            aria-label="Termo de busca"
          />
          {loading ? <Loader2 className="size-4 shrink-0 animate-spin text-subtle" /> : null}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {!isSearchable ? (
            <p className="px-4 py-8 text-center text-sm text-subtle">
              Digite pelo menos 2 caracteres para buscar.
            </p>
          ) : !loading && grouped.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-subtle">
              Nenhum resultado para “{term}”.
            </p>
          ) : (
            grouped.map((group) => {
              const Icon = GROUP_ICONS[group.type];
              return (
                <div key={group.type} className="py-2">
                  <div className="flex items-center gap-2 px-4 py-1.5 text-[0.7rem] font-bold tracking-widest text-subtle uppercase">
                    <Icon className="size-3.5" />
                    {GROUP_LABELS[group.type]}
                  </div>
                  {group.items.map((item) => {
                    flatIndex += 1;
                    const active = flatIndex === cursor;
                    return (
                      <button
                        key={`${item.type}-${item.id}`}
                        type="button"
                        onClick={() => go(item)}
                        onMouseEnter={() => setCursor(flat.indexOf(item))}
                        className={cn(
                          'flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors',
                          active ? 'bg-accent/10' : 'hover:bg-surface-2',
                        )}
                      >
                        {item.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={item.imageUrl}
                            alt=""
                            className="size-8 shrink-0 rounded-lg bg-surface-2 object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-xs font-bold text-subtle">
                            {item.title.slice(0, 2).toUpperCase()}
                          </span>
                        )}
                        <span className="min-w-0 flex-1">
                          <span
                            className={cn(
                              'block truncate text-sm font-semibold',
                              active ? 'text-accent' : 'text-fg',
                            )}
                          >
                            {item.title}
                          </span>
                          {item.subtitle ? (
                            <span className="block truncate text-xs text-muted">
                              {item.subtitle}
                            </span>
                          ) : null}
                        </span>
                      </button>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>

        <div className="hidden items-center gap-4 border-t border-line bg-surface-2 px-4 py-2 text-[0.7rem] text-subtle sm:flex">
          <span>
            <kbd className="rounded border border-line px-1 font-mono">↑↓</kbd> navegar
          </span>
          <span>
            <kbd className="rounded border border-line px-1 font-mono">Enter</kbd> abrir
          </span>
          <span>
            <kbd className="rounded border border-line px-1 font-mono">Esc</kbd> fechar
          </span>
        </div>
      </motion.div>
    </div>
  );
}
