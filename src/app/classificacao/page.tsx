import { Table2 } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { StandingsTable } from '@/components/domain/standings-table';
import { PageHeader } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { parseConfig, TIEBREAKER_LABELS } from '@/lib/engine/config';
import {
  getLeagueCompetition,
  getQualificationZones,
  getStandings,
  listLeagues,
  listSeasons,
} from '@/lib/queries';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Classificação',
  description: 'Tabelas de classificação de todas as ligas da VFA, atualizadas a cada resultado.',
};

export default async function StandingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const yearParam = typeof params.temporada === 'string' ? Number(params.temporada) : null;

  const [leagues, seasons] = await Promise.all([listLeagues(), listSeasons()]);

  const season =
    (yearParam ? seasons.find((item) => item.year === yearParam) : null) ??
    seasons.find((item) => item.isActive) ??
    seasons[0] ??
    null;

  if (!season) {
    return (
      <>
        <PageHeader title="Classificação" eyebrow="Tabelas" />
        <div className="container-vfa py-10">
          <EmptyState
            icon={<Table2 className="size-6" />}
            title="Nenhuma temporada cadastrada"
            description="Crie uma temporada no painel administrativo para começar."
          />
        </div>
      </>
    );
  }

  const tables = await Promise.all(
    leagues.map(async (league) => {
      const competition = await getLeagueCompetition(league.id, season.id);
      const [rows, zones] = await Promise.all([
        competition ? getStandings(competition.id) : Promise.resolve([]),
        getQualificationZones(league.id),
      ]);
      return { league, competition, rows, zones };
    }),
  );

  const withData = tables.filter((table) => table.rows.length > 0);

  return (
    <>
      <PageHeader
        eyebrow={season.name}
        title="Classificação"
        description="As tabelas são recalculadas automaticamente a cada resultado registrado."
        actions={
          seasons.length > 1 ? (
            <div className="flex flex-wrap gap-1.5">
              {seasons.map((item) => (
                <Link
                  key={item.id}
                  href={`/classificacao?temporada=${item.year}`}
                  scroll={false}
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
        {withData.length === 0 ? (
          <EmptyState
            icon={<Table2 className="size-6" />}
            title="Nenhuma tabela disponível"
            description="As classificações aparecem assim que as primeiras partidas da temporada forem encerradas."
          />
        ) : (
          withData.map(({ league, competition, rows, zones }) => {
            const config = competition ? parseConfig(competition.config) : null;

            return (
              <section key={league.id}>
                <div className="mb-4 flex flex-wrap items-center gap-3">
                  <span
                    className="h-7 w-1 rounded-full"
                    style={{ backgroundColor: league.accent ?? 'var(--vfa-accent)' }}
                  />
                  <h2 className="text-xl font-black tracking-tight">
                    {league.nationFlag ? <span className="mr-2">{league.nationFlag}</span> : null}
                    {league.name}
                  </h2>
                  {competition ? (
                    <Link href={`/competicoes/${competition.slug}`}>
                      <Badge tone="accent" className="cursor-pointer hover:brightness-125">
                        Ver competição
                      </Badge>
                    </Link>
                  ) : null}
                </div>

                <StandingsTable
                  rows={rows}
                  zones={zones}
                  pointsPerWin={config?.points.win ?? 3}
                />

                {config ? (
                  <p className="mt-2.5 text-xs text-subtle">
                    Pontuação: vitória {config.points.win}, empate {config.points.draw}, derrota{' '}
                    {config.points.loss}. Desempate:{' '}
                    {config.tiebreakers
                      .map((criterion) => TIEBREAKER_LABELS[criterion].toLowerCase())
                      .join(' → ')}
                    .
                  </p>
                ) : null}
              </section>
            );
          })
        )}
      </div>
    </>
  );
}
