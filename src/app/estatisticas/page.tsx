import { getDictionary } from '@/lib/i18n';
import { BarChart3 } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { ClubCrest, PlayerAvatar } from '@/components/common/remote-image';
import { FilterBar } from '@/components/domain/filter-bar';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardHeader } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import {
  getActiveSeason,
  getPlayerRanking,
  listClubs,
  listCompetitions,
  listLeagues,
  listSeasons,
  type RankingMetric,
} from '@/lib/queries';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Estatísticas',
  description: 'Rankings completos da VFA: artilharia, assistências, presenças, cartões e médias.',
};

type RankingSpec = {
  metric: RankingMetric;
  title: string;
  description: string;
  format: (row: Row) => string;
};

type Row = Awaited<ReturnType<typeof getPlayerRanking>>[number];

const RANKINGS: RankingSpec[] = [
  {
    metric: 'goals',
    title: 'Artilheiros',
    description: 'Gols marcados na temporada',
    format: (row) => String(row.goals),
  },
  {
    metric: 'assists',
    title: 'Assistências',
    description: 'Passes para gol',
    format: (row) => String(row.assists),
  },
  {
    metric: 'matches',
    title: 'Mais jogos',
    description: 'Partidas disputadas',
    format: (row) => String(row.matches),
  },
  {
    metric: 'wins',
    title: 'Mais vitórias',
    description: 'Partidas vencidas',
    format: (row) => String(row.wins),
  },
  {
    metric: 'goalsPerMatch',
    title: 'Melhor média de gols',
    description: 'Gols por partida (mínimo 3 jogos)',
    format: (row) => (row.matches > 0 ? (row.goals / row.matches).toFixed(2) : '0.00'),
  },
  {
    metric: 'cards',
    title: 'Mais cartões',
    description: 'Amarelos e vermelhos somados',
    format: (row) => String(row.yellowCards + row.redCards),
  },
];

export default async function StatisticsPage({
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

  const [seasons, leagues, clubs] = await Promise.all([listSeasons(), listLeagues(), listClubs()]);

  const yearParam = read('temporada') ? Number(read('temporada')) : null;
  const season =
    (yearParam ? seasons.find((item) => item.year === yearParam) : null) ??
    (await getActiveSeason());

  if (!season) {
    return (
      <>
        <PageHeader title={dict.pages.statsTitle} eyebrow={dict.pages.statsEyebrow} />
        <div className="container-vfa py-10">
          <EmptyState
            icon={<BarChart3 className="size-6" />}
            title="Nenhuma temporada cadastrada"
            description="Crie a temporada no painel administrativo para começar."
          />
        </div>
      </>
    );
  }

  const competitions = await listCompetitions(season.id);

  const options = {
    seasonId: season.id,
    competitionId: read('competicao'),
    leagueId: read('liga'),
    clubId: read('clube'),
    limit: 10,
  };

  const results = await Promise.all(
    RANKINGS.map(async (spec) => ({
      spec,
      rows: await getPlayerRanking(spec.metric, options),
    })),
  );

  const hasAny = results.some((result) => result.rows.length > 0);

  return (
    <>
      <PageHeader
        eyebrow={season.name}
        title={dict.pages.statsTitle}
        description="Rankings individuais da temporada. Use os filtros para recortar por liga, competição ou clube."
      />

      <div className="container-vfa space-y-6 py-8">
        <FilterBar
          searchKey={null}
          filters={[
            {
              key: 'temporada',
              label: 'Temporada atual',
              options: seasons.map((item) => ({ value: String(item.year), label: item.name })),
            },
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
          ]}
        />

        {!hasAny ? (
          <EmptyState
            icon={<BarChart3 className="size-6" />}
            title="Sem dados para estes filtros"
            description="Nenhuma estatística foi registrada para a combinação escolhida."
          />
        ) : (
          <div className="grid gap-5 lg:grid-cols-2">
            {results
              .filter((result) => result.rows.length > 0)
              .map(({ spec, rows }) => (
                <Card key={spec.metric}>
                  <CardHeader title={spec.title} description={spec.description} />
                  <ol className="divide-y divide-line">
                    {rows.map((row, index) => (
                      <li key={row.playerId}>
                        <Link
                          href={`/jogadores/${row.playerSlug}`}
                          className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-surface-2"
                        >
                          <span className="w-5 shrink-0 text-center font-mono text-sm font-bold text-subtle tabular-nums">
                            {index + 1}
                          </span>
                          <PlayerAvatar
                            player={{
                              displayName: row.playerName,
                              robloxHeadshotUrl: row.robloxHeadshotUrl,
                              robloxAvatarUrl: row.robloxAvatarUrl,
                            }}
                            size={30}
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-semibold">
                              {row.playerName}
                            </span>
                            <span className="flex items-center gap-1.5 truncate text-xs text-subtle">
                              {row.clubName ? (
                                <>
                                  <ClubCrest
                                    club={{
                                      name: row.clubName,
                                      abbreviation: row.clubAbbr,
                                      logoUrl: row.clubLogo,
                                    }}
                                    size={14}
                                  />
                                  {row.clubName}
                                </>
                              ) : (
                                'sem clube'
                              )}
                            </span>
                          </span>
                          <span className="shrink-0 font-mono text-lg font-black text-accent tabular-nums">
                            {spec.format(row)}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ol>
                </Card>
              ))}
          </div>
        )}
      </div>
    </>
  );
}
