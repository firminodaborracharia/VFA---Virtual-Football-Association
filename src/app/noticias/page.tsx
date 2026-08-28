import { getDictionary, getLocale } from '@/lib/i18n';
import { Newspaper } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { NewsCard } from '@/components/domain/cards';
import { Pagination } from '@/components/domain/filter-bar';
import { PageHeader } from '@/components/layout/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { listNews, listNewsCategories } from '@/lib/queries';
import { getSettings } from '@/lib/settings';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Notícias',
  description: 'Transferências, resultados, comunicados oficiais e tudo que acontece na VFA.',
};

const PER_PAGE = 12;

export default async function NewsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const dict = await getDictionary();
  const locale = await getLocale();
  const params = await searchParams;
  const category = typeof params.categoria === 'string' ? params.categoria : undefined;
  const page = Math.max(1, Number(params.page ?? 1) || 1);

  const [settings, categories, { rows, total }] = await Promise.all([
    getSettings(),
    listNewsCategories(),
    listNews({ limit: PER_PAGE, offset: (page - 1) * PER_PAGE, categorySlug: category, locale }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));
  const [headline, ...rest] = rows;

  return (
    <>
      <PageHeader
        eyebrow={dict.pages.newsEyebrow}
        title={`${settings.site.name} News`}
        description="Tudo o que acontece na liga: transferências, resultados, bastidores e comunicados oficiais."
      />

      <div className="container-vfa space-y-8 py-8">
        {categories.length > 0 ? (
          <nav className="table-scroll flex gap-1.5" aria-label="Categorias">
            <Link
              href="/noticias"
              className={
                !category
                  ? 'shrink-0 rounded-full bg-accent px-4 py-1.5 text-sm font-bold text-black'
                  : 'shrink-0 rounded-full border border-line-strong px-4 py-1.5 text-sm font-semibold text-muted transition-colors hover:text-fg'
              }
            >
              Todas
            </Link>
            {categories.map((item) => (
              <Link
                key={item.id}
                href={`/noticias?categoria=${item.slug}`}
                className={
                  category === item.slug
                    ? 'shrink-0 rounded-full px-4 py-1.5 text-sm font-bold text-black'
                    : 'shrink-0 rounded-full border border-line-strong px-4 py-1.5 text-sm font-semibold text-muted transition-colors hover:text-fg'
                }
                style={category === item.slug ? { backgroundColor: item.color } : undefined}
              >
                {item.name}
              </Link>
            ))}
          </nav>
        ) : null}

        {rows.length === 0 ? (
          <EmptyState
            icon={<Newspaper className="size-6" />}
            title="Nenhuma notícia publicada"
            description="As matérias aparecem aqui assim que forem publicadas no painel administrativo."
          />
        ) : (
          <>
            {page === 1 && headline ? <NewsCard article={headline} featured /> : null}

            <div className="stagger grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {(page === 1 ? rest : rows).map((article) => (
                <NewsCard key={article.id} article={article} />
              ))}
            </div>

            <Pagination page={page} totalPages={totalPages} className="pt-2" />
          </>
        )}
      </div>
    </>
  );
}
