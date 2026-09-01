import type { Metadata } from 'next';

import { PlayersManager } from '@/components/admin/players-manager';
import { listClubs, listNations, listPlayers } from '@/lib/queries';
import { requireAdmin } from '@/lib/rbac';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Jogadores' };

export default async function AdminPlayersPage() {
  // Checagem obrigatória ANTES de qualquer consulta ao banco.
  //
  // No App Router o `layout` e a `page` renderizam em paralelo: se a proteção
  // ficasse só no layout, os dados desta página já teriam sido buscados e
  // transmitidos no HTML antes de o redirect do layout acontecer. Aqui a
  // função lança o redirect antes de qualquer query, então nada vaza.
  await requireAdmin();

  const [{ rows }, clubs, nations] = await Promise.all([
    listPlayers({ limit: 500 }),
    listClubs(),
    listNations(),
  ]);

  return (
    <PlayersManager
      players={rows.map((player) => ({
        id: player.id,
        slug: player.slug,
        displayName: player.displayName,
        robloxUsername: player.robloxUsername,
        robloxUserId: player.robloxUserId,
        robloxHeadshotUrl: player.robloxHeadshotUrl,
        robloxAvatarUrl: player.robloxAvatarUrl,
        overall: player.overall,
        robloxSyncError: null,
        robloxSyncedAt: null,
        shirtNumber: player.shirtNumber,
        position: player.position,
        isActive: player.isActive,
        nationId: player.nationId,
        clubId: player.clubId,
        clubName: player.clubName,
      }))}
      clubs={clubs.map((club) => ({ id: club.id, name: club.name }))}
      nations={nations.map((nation) => ({
        id: nation.id,
        name: nation.name,
        flagEmoji: nation.flagEmoji,
      }))}
    />
  );
}
