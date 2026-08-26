import { Users } from 'lucide-react';
import type { Metadata } from 'next';

import { PlayerCard } from '@/components/domain/cards';
import { FilterBar, Pagination } from '@/components/domain/filter-bar';
import { PageHeader } from '@/components/layout/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { listClubs, listLeagues, listNations, listPlayers } from '@/lib/queries';
import { POSITION_LABELS } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Jogadores',
  description: 'Todos os jogadores registrados na VFA, com estatísticas e perfil do Roblox.',
};

const PER_PAGE = 24;

export default async function PlayersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const read = (key: string) => {
    const value = params[key];
    return typeof value === 'string' && value ? value : undefined;
  };

  const page = Math.max(1, Number(read('page') ?? 1) || 1);
  const position = read('posicao');

  const [leagues, clubs, nations] = await Promise.all([listLeagues(), listClubs(), listNations()]);

  const { rows, total } = await listPlayers({
    search: read('q'),
    leagueId: read('liga'),
    clubId: read('clube'),
    nationId: read('nacionalidade'),
    position: (position as keyof typeof POSITION_LABELS | undefined) ?? undefined,
    limit: PER_PAGE,
    offset: (page - 1) * PER_PAGE,
  });

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));

  return (
    <>
      <PageHeader
        eyebrow="Elenco da liga"
        title="Jogadores"
        description={`${total} ${total === 1 ? 'jogador registrado' : 'jogadores registrados'} na VFA.`}
      />

      <div className="container-vfa space-y-6 py-8">
        <FilterBar
          searchPlaceholder="Buscar por nome, username do Roblox ou clube…"
          filters={[
            {
              key: 'liga',
              label: 'Todas as ligas',
              options: leagues.map((league) => ({ value: league.id, label: league.name })),
            },
            {
              key: 'clube',
              label: 'Todos os clubes',
              options: clubs.map((club) => ({ value: club.id, label: club.name })),
            },
            {
              key: 'posicao',
              label: 'Todas as posições',
              options: Object.entries(POSITION_LABELS).map(([value, label]) => ({ value, label })),
            },
            {
              key: 'nacionalidade',
              label: 'Todas as nacionalidades',
              options: nations.map((nation) => ({
                value: nation.id,
                label: `${nation.flagEmoji} ${nation.name}`,
              })),
            },
          ]}
        />

        {rows.length === 0 ? (
          <EmptyState
            icon={<Users className="size-6" />}
            title="Nenhum jogador encontrado"
            description="Ajuste os filtros ou limpe a busca para ver todos os jogadores da liga."
          />
        ) : (
          <>
            <div className="stagger grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {rows.map((player) => (
                <PlayerCard
                  key={player.id}
                  player={{
                    slug: player.slug,
                    displayName: player.displayName,
                    shirtNumber: player.shirtNumber,
                    position: player.position,
                    robloxUsername: player.robloxUsername,
                    robloxHeadshotUrl: player.robloxHeadshotUrl,
                    robloxAvatarUrl: player.robloxAvatarUrl,
                    isDemo: player.isDemo,
                    clubSlug: player.clubSlug,
                    clubName: player.clubName,
                    clubAbbreviation: player.clubAbbreviation,
                    clubLogo: player.clubLogo,
                    nationFlag: player.nationFlag,
                    nationName: player.nationName,
                  }}
                />
              ))}
            </div>

            <Pagination page={page} totalPages={totalPages} className="pt-2" />
          </>
        )}
      </div>
    </>
  );
}
