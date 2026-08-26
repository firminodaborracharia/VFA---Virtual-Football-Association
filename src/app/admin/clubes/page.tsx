import type { Metadata } from 'next';

import { ClubsManager } from '@/components/admin/clubs-manager';
import { getClubSquad, listClubsAdmin, listLeagues, listNations } from '@/lib/queries';
import { requireAdmin } from '@/lib/rbac';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Clubes' };

export default async function AdminClubsPage() {
  // Checagem obrigatória ANTES de qualquer consulta ao banco.
  //
  // No App Router o `layout` e a `page` renderizam em paralelo: se a proteção
  // ficasse só no layout, os dados desta página já teriam sido buscados e
  // transmitidos no HTML antes de o redirect do layout acontecer. Aqui a
  // função lança o redirect antes de qualquer query, então nada vaza.
  await requireAdmin();

  const [clubs, leagues, nations] = await Promise.all([
    listClubsAdmin(),
    listLeagues(),
    listNations(),
  ]);

  const squadEntries = await Promise.all(
    clubs.map(async (club) => {
      const squad = await getClubSquad(club.id);
      return [club.id, squad.map((player) => ({ id: player.id, displayName: player.displayName }))] as const;
    }),
  );

  return (
    <ClubsManager
      clubs={clubs}
      leagues={leagues.map((league) => ({ id: league.id, name: league.name }))}
      nations={nations.map((nation) => ({
        id: nation.id,
        name: nation.name,
        flagEmoji: nation.flagEmoji,
      }))}
      squads={Object.fromEntries(squadEntries)}
    />
  );
}
