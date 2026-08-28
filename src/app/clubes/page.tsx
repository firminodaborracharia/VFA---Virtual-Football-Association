import { Trophy } from 'lucide-react';
import type { Metadata } from 'next';

import { ClubCard } from '@/components/domain/cards';
import { FilterBar } from '@/components/domain/filter-bar';
import { PageHeader } from '@/components/layout/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import {
  getActiveSeason,
  getLeagueCompetition,
  getStandings,
  listClubs,
  listLeagues,
} from '@/lib/queries';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Clubes',
  description: 'Todos os clubes da VFA, separados por liga, com posição e elenco.',
};

export default async function ClubsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const read = (key: string) => {
    const value = params[key];
    return typeof value === 'string' && value ? value : undefined;
  };

  const [leagues, season] = await Promise.all([listLeagues(), getActiveSeason()]);
  const clubs = await listClubs({ leagueId: read('liga'), search: read('q') });

  // Posição e pontos de cada clube na sua liga, para o card já dar contexto.
  const positions = new Map<string, { position: number; points: number }>();

  if (season) {
    const tables = await Promise.all(
      leagues.map(async (league) => {
        const competition = await getLeagueCompetition(league.id, season.id);
        if (!competition) return [];
        return getStandings(competition.id);
      }),
    );

    for (const table of tables) {
      for (const row of table) {
        positions.set(row.club.id, { position: row.position, points: row.points });
      }
    }
  }

  const grouped = leagues
    .map((league) => ({
      league,
      clubs: clubs.filter((club) => club.leagueId === league.id),
    }))
    .filter((group) => group.clubs.length > 0);

  return (
    <>
      <PageHeader
        eyebrow="Times da liga"
        title="Clubes"
        description={`${clubs.length} ${clubs.length === 1 ? 'clube' : 'clubes'} distribuídos em ${leagues.length} ${leagues.length === 1 ? 'liga' : 'ligas'}.`}
      />

      <div className="container-vfa space-y-8 py-8">
        <FilterBar
          searchPlaceholder="Buscar clube pelo nome…"
          filters={[
            {
              key: 'liga',
              label: 'Todas as ligas',
              options: leagues.map((league) => ({ value: league.id, label: league.name })),
            },
          ]}
        />

        {grouped.length === 0 ? (
          <EmptyState
            icon={<Trophy className="size-6" />}
            title="Nenhum clube encontrado"
            description="Ajuste os filtros ou cadastre os clubes no painel administrativo."
          />
        ) : (
          grouped.map(({ league, clubs: leagueClubs }) => (
            <section key={league.id}>
              <div className="mb-4 flex items-center gap-3">
                <span
                  className="h-6 w-1 rounded-full"
                  style={{ backgroundColor: league.accent ?? 'var(--vfa-accent)' }}
                />
                <h2 className="display-vfa text-lg">
                  {league.nationFlag ? <span className="mr-2">{league.nationFlag}</span> : null}
                  {league.name}
                </h2>
                <span className="text-sm text-subtle">
                  {leagueClubs.length} {leagueClubs.length === 1 ? 'clube' : 'clubes'}
                </span>
              </div>

              <div className="stagger grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {leagueClubs.map((club) => {
                  const standing = positions.get(club.id);
                  return (
                    <ClubCard
                      key={club.id}
                      club={club}
                      position={standing?.position}
                      points={standing?.points}
                    />
                  );
                })}
              </div>
            </section>
          ))
        )}
      </div>
    </>
  );
}
