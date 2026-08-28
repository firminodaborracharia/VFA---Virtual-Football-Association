import { getDictionary } from '@/lib/i18n';
import { Globe2, Trophy } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { ClubCrest } from '@/components/common/remote-image';
import { PageHeader } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { getActiveSeason, listCompetitions, listSeasons } from '@/lib/queries';
import { COMPETITION_TYPE_LABELS } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Competições',
  description: 'Ligas, mata-matas, Libertadores, Champions League e a final Intercontinental da VFA.',
};

const GROUP_ORDER = ['LEAGUE', 'LEAGUE_PLAYOFF', 'CONTINENTAL', 'INTERCONTINENTAL', 'CUP'] as const;

const STATUS_LABELS = {
  DRAFT: 'Rascunho',
  UPCOMING: 'Em breve',
  IN_PROGRESS: 'Em andamento',
  FINISHED: 'Encerrada',
} as const;

export default async function CompetitionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const dict = await getDictionary();
  const params = await searchParams;
  const yearParam = typeof params.temporada === 'string' ? Number(params.temporada) : null;

  const seasons = await listSeasons();
  const season =
    (yearParam ? seasons.find((item) => item.year === yearParam) : null) ??
    (await getActiveSeason());

  if (!season) {
    return (
      <>
        <PageHeader title={dict.pages.competitionsTitle} eyebrow={dict.pages.competitionsEyebrow} />
        <div className="container-vfa py-10">
          <EmptyState
            icon={<Globe2 className="size-6" />}
            title="Nenhuma temporada cadastrada"
            description="Crie a temporada e as competições no painel administrativo."
          />
        </div>
      </>
    );
  }

  const competitions = (await listCompetitions(season.id)).filter(
    (competition) => competition.status !== 'DRAFT',
  );

  const grouped = GROUP_ORDER.map((type) => ({
    type,
    items: competitions.filter((competition) => competition.type === type),
  })).filter((group) => group.items.length > 0);

  return (
    <>
      <PageHeader
        eyebrow={season.name}
        title={dict.pages.competitionsTitle}
        description="Ligas nacionais, mata-matas, torneios continentais e a decisão intercontinental."
        actions={
          seasons.length > 1 ? (
            <div className="flex flex-wrap gap-1.5">
              {seasons.map((item) => (
                <Link
                  key={item.id}
                  href={`/competicoes?temporada=${item.year}`}
                  className={
                    item.id === season.id
                      ? 'rounded-lg bg-accent px-3 py-1.5 text-sm font-bold text-black'
                      : 'rounded-lg border border-line-strong px-3 py-1.5 text-sm font-semibold text-muted transition-colors hover:text-fg'
                  }
                >
                  {item.year}
                </Link>
              ))}
            </div>
          ) : null
        }
      />

      <div className="container-vfa space-y-10 py-8">
        {grouped.length === 0 ? (
          <EmptyState
            icon={<Globe2 className="size-6" />}
            title="Nenhuma competição publicada"
            description="As competições aparecem aqui quando saírem do rascunho no painel."
          />
        ) : (
          grouped.map((group) => (
            <section key={group.type}>
              <h2 className="display-vfa mb-4 text-lg">
                {COMPETITION_TYPE_LABELS[group.type]}
              </h2>

              <div className="stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {group.items.map((competition) => (
                  <Link
                    key={competition.id}
                    href={`/competicoes/${competition.slug}`}
                    className="sheen group flex flex-col overflow-hidden rounded-2xl border border-line bg-surface transition-all duration-300 hover:-translate-y-1 hover:border-accent/40 hover:shadow-pop motion-reduce:hover:translate-y-0"
                  >
                    <div
                      className="h-1.5 w-full"
                      style={{ backgroundColor: competition.accent ?? 'var(--vfa-accent)' }}
                    />
                    <div className="flex flex-1 flex-col p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div
                          className="flex size-12 shrink-0 items-center justify-center rounded-xl text-base font-black"
                          style={{
                            backgroundColor: `${competition.accent ?? '#00e08f'}1a`,
                            color: competition.accent ?? 'var(--vfa-accent)',
                          }}
                        >
                          {(competition.shortName ?? competition.name).slice(0, 2).toUpperCase()}
                        </div>
                        <Badge
                          tone={
                            competition.status === 'IN_PROGRESS'
                              ? 'accent'
                              : competition.status === 'FINISHED'
                                ? 'neutral'
                                : 'warn'
                          }
                        >
                          {STATUS_LABELS[competition.status]}
                        </Badge>
                      </div>

                      <h3 className="mt-4 text-lg leading-tight font-bold transition-colors group-hover:text-accent">
                        {competition.name}
                      </h3>
                      {competition.leagueName ? (
                        <p className="mt-1 text-xs text-subtle">{competition.leagueName}</p>
                      ) : null}

                      <div className="mt-auto pt-4">
                        {competition.championName ? (
                          <div className="flex items-center gap-2 border-t border-line pt-3">
                            <Trophy className="size-4 shrink-0 text-accent-warm" />
                            <ClubCrest
                              club={{
                                name: competition.championName,
                                logoUrl: competition.championLogo,
                              }}
                              size={20}
                            />
                            <span className="truncate text-xs font-semibold text-accent-warm">
                              {competition.championName}
                            </span>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          ))
        )}
      </div>
    </>
  );
}
