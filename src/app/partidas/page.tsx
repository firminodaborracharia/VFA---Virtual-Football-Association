import { getDictionary } from '@/lib/i18n';
import { CalendarDays } from 'lucide-react';
import type { Metadata } from 'next';

import { FilterBar, Pagination } from '@/components/domain/filter-bar';
import { MatchRowItem } from '@/components/domain/match-card';
import { PageHeader } from '@/components/layout/page-header';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import {
  getActiveSeason,
  listClubs,
  listCompetitions,
  listLeagues,
  listMatches,
  listSeasons,
} from '@/lib/queries';
import { formatLongDate, MATCH_STATUS_LABELS } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Partidas',
  description: 'Central de partidas da VFA: próximos jogos, resultados, adiamentos e jogos ao vivo.',
};

const PER_PAGE = 25;

const CATEGORIES = {
  proximas: { label: 'Próximas', status: 'SCHEDULED' as const, order: 'asc' as const },
  ao_vivo: { label: 'Ao vivo', status: 'LIVE' as const, order: 'asc' as const },
  resultados: { label: 'Resultados', status: 'FINISHED' as const, order: 'desc' as const },
  adiadas: { label: 'Adiadas', status: 'POSTPONED' as const, order: 'asc' as const },
};

type CategoryKey = keyof typeof CATEGORIES;

export default async function MatchesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const dict = await getDictionary();
  const params = await searchParams;
  const read = (key: string) => {
    const value = params[key];
    return typeof value === 'string' && value ? value : undefined;
  };

  const categoryKey = (read('categoria') as CategoryKey) ?? 'proximas';
  const category = CATEGORIES[categoryKey] ?? CATEGORIES.proximas;
  const page = Math.max(1, Number(read('page') ?? 1) || 1);

  const [seasons, leagues, clubs] = await Promise.all([listSeasons(), listLeagues(), listClubs()]);

  const yearParam = read('temporada') ? Number(read('temporada')) : null;
  const season =
    (yearParam ? seasons.find((item) => item.year === yearParam) : null) ??
    (await getActiveSeason());

  const competitions = season ? await listCompetitions(season.id) : [];

  const { rows, total } = await listMatches({
    seasonId: season?.id,
    competitionId: read('competicao'),
    leagueId: read('liga'),
    clubId: read('clube'),
    status: category.status,
    order: category.order,
    limit: PER_PAGE,
    offset: (page - 1) * PER_PAGE,
  });

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));

  // Agrupa por dia para dar ritmo de calendário, como nos sites oficiais.
  const byDay = new Map<string, typeof rows>();
  for (const match of rows) {
    const key = match.kickoffAt.toISOString().slice(0, 10);
    const list = byDay.get(key) ?? [];
    list.push(match);
    byDay.set(key, list);
  }

  return (
    <>
      <PageHeader
        eyebrow={season?.name ?? dict.pages.matchesEyebrow}
        title={dict.pages.matchesTitle}
        description="Todos os confrontos da VFA, com filtros por liga, competição, clube e temporada."
      />

      <div className="container-vfa space-y-6 py-8">
        {/* ── Categorias ── */}
        <div className="table-scroll flex gap-1.5 border-b border-line pb-px">
          {(Object.keys(CATEGORIES) as CategoryKey[]).map((key) => {
            const isActive = key === categoryKey;
            const search = new URLSearchParams();
            for (const [param, value] of Object.entries(params)) {
              if (typeof value === 'string' && value && param !== 'page' && param !== 'categoria') {
                search.set(param, value);
              }
            }
            search.set('categoria', key);

            return (
              <a
                key={key}
                href={`/partidas?${search.toString()}`}
                className={
                  isActive
                    ? 'shrink-0 rounded-t-lg border-b-2 border-accent px-4 py-2.5 text-sm font-bold text-accent'
                    : 'shrink-0 rounded-t-lg border-b-2 border-transparent px-4 py-2.5 text-sm font-semibold text-muted transition-colors hover:text-fg'
                }
              >
                {CATEGORIES[key].label}
              </a>
            );
          })}
        </div>

        <FilterBar
          searchKey={null}
          filters={[
            {
              key: 'liga',
              label: 'Todas as ligas',
              options: leagues.map((league) => ({ value: league.id, label: league.name })),
            },
            {
              key: 'competicao',
              label: 'Todas as competições',
              options: competitions.map((competition) => ({
                value: competition.id,
                label: competition.name,
              })),
            },
            {
              key: 'clube',
              label: 'Todos os clubes',
              options: clubs.map((club) => ({ value: club.id, label: club.name })),
            },
            {
              key: 'temporada',
              label: 'Temporada atual',
              options: seasons.map((item) => ({ value: String(item.year), label: item.name })),
            },
          ]}
        />

        {rows.length === 0 ? (
          <EmptyState
            icon={<CalendarDays className="size-6" />}
            title={`Nenhuma partida ${MATCH_STATUS_LABELS[category.status].toLowerCase()}`}
            description="Ajuste os filtros ou escolha outra categoria acima."
          />
        ) : (
          <>
            <div className="space-y-6">
              {[...byDay.entries()].map(([day, dayMatches]) => (
                <section key={day}>
                  <h2 className="mb-2.5 text-xs font-bold tracking-widest text-subtle uppercase">
                    {formatLongDate(dayMatches[0].kickoffAt)}
                  </h2>
                  <Card className="divide-y divide-line overflow-hidden">
                    {dayMatches.map((match) => (
                      <MatchRowItem key={match.id} match={match} />
                    ))}
                  </Card>
                </section>
              ))}
            </div>

            <Pagination page={page} totalPages={totalPages} className="pt-2" />
          </>
        )}
      </div>
    </>
  );
}
