'use client';

/**
 * Barra de filtros das listagens.
 *
 * O estado vive na URL (query string), não em `useState`. Assim o filtro
 * sobrevive ao refresh, pode ser compartilhado por link e o botão "voltar" do
 * navegador funciona como o usuário espera.
 */

import { Search, X } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState, useTransition } from 'react';

import { Select } from '@/components/ui/field';
import { cn } from '@/lib/utils';

export type FilterOption = { value: string; label: string };

export type FilterDefinition = {
  key: string;
  label: string;
  options: FilterOption[];
};

export function FilterBar({
  filters,
  searchKey = 'q',
  searchPlaceholder = 'Buscar…',
  className,
}: {
  filters: FilterDefinition[];
  searchKey?: string | null;
  searchPlaceholder?: string;
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  const [term, setTerm] = useState(searchParams.get(searchKey ?? 'q') ?? '');

  const apply = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) params.set(key, value);
      else params.delete(key);
      // Qualquer mudança de filtro volta para a primeira página.
      params.delete('page');
      startTransition(() => {
        router.replace(`${pathname}?${params.toString()}`, { scroll: false });
      });
    },
    [pathname, router, searchParams],
  );

  // Debounce da busca por texto para não disparar uma navegação por tecla.
  useEffect(() => {
    if (!searchKey) return;
    const current = searchParams.get(searchKey) ?? '';
    if (term === current) return;

    const timer = setTimeout(() => apply(searchKey, term), 350);
    return () => clearTimeout(timer);
  }, [term, searchKey, searchParams, apply]);

  const activeCount =
    filters.filter((filter) => searchParams.get(filter.key)).length +
    (searchKey && searchParams.get(searchKey) ? 1 : 0);

  const clear = () => {
    setTerm('');
    startTransition(() => router.replace(pathname, { scroll: false }));
  };

  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-2.5 rounded-2xl border border-line bg-surface p-3',
        pending && 'opacity-70',
        className,
      )}
    >
      {searchKey ? (
        <div className="relative min-w-[14rem] flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-subtle" />
          <input
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            placeholder={searchPlaceholder}
            className="h-10 w-full rounded-xl border border-line-strong bg-surface-2 pr-3 pl-9 text-sm text-fg placeholder:text-subtle focus:border-accent/60 focus:outline-none"
            aria-label={searchPlaceholder}
          />
        </div>
      ) : null}

      {filters.map((filter) => (
        <Select
          key={filter.key}
          value={searchParams.get(filter.key) ?? ''}
          onChange={(event) => apply(filter.key, event.target.value)}
          className="w-auto min-w-[9rem]"
          aria-label={filter.label}
        >
          <option value="">{filter.label}</option>
          {filter.options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      ))}

      {activeCount > 0 ? (
        <button
          type="button"
          onClick={clear}
          className="flex h-10 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-muted transition-colors hover:bg-surface-2 hover:text-loss"
        >
          <X className="size-3.5" />
          Limpar ({activeCount})
        </button>
      ) : null}
    </div>
  );
}

/** Paginação simples baseada em query string. */
export function Pagination({
  page,
  totalPages,
  className,
}: {
  page: number;
  totalPages: number;
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  if (totalPages <= 1) return null;

  const goTo = (target: number) => {
    const params = new URLSearchParams(searchParams.toString());
    if (target <= 1) params.delete('page');
    else params.set('page', String(target));
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <nav
      className={cn('flex items-center justify-center gap-2', className)}
      aria-label="Paginação"
    >
      <button
        type="button"
        onClick={() => goTo(page - 1)}
        disabled={page <= 1}
        className="h-9 rounded-lg border border-line-strong px-3 text-sm font-semibold text-muted transition-colors hover:text-fg disabled:opacity-40"
      >
        Anterior
      </button>
      <span className="px-2 font-mono text-sm text-subtle tabular-nums">
        {page} / {totalPages}
      </span>
      <button
        type="button"
        onClick={() => goTo(page + 1)}
        disabled={page >= totalPages}
        className="h-9 rounded-lg border border-line-strong px-3 text-sm font-semibold text-muted transition-colors hover:text-fg disabled:opacity-40"
      >
        Próxima
      </button>
    </nav>
  );
}
